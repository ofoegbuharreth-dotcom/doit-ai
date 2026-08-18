import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import type { User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { authRememberKey, emailVerificationRedirectUrl, isPasswordRecoveryUrl, isSupabaseConfigured, passwordRecoveryRedirectUrl, resendSignupVerification, stripeReturnSessionKey, supabase } from '@/services';
import { clearPendingReferralCode, getPendingReferralCode } from '@/services/growth';
import { track } from '@/services/observability';

type AuthResult = { error?: string; requiresEmailVerification?: boolean };
interface AuthContextValue {
  user: User | { id: string; email: string } | null;
  loading: boolean;
  demoMode: boolean;
  signIn: (email: string, password: string, rememberMe: boolean) => Promise<AuthResult>;
  signUp: (email: string, password: string, name: string, rememberMe: boolean) => Promise<AuthResult>;
  resendVerification: (email: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
async function saveRememberPreference(rememberMe: boolean) {
  await AsyncStorage.setItem(authRememberKey, rememberMe ? 'true' : 'false');
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthContextValue['user']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    const initialize = async () => {
      try {
        const rememberMe = await AsyncStorage.getItem(authRememberKey) === 'true';
        const initialUrl = await Linking.getInitialURL();
        let returningFromStripe = false;
        const desktopExternalReturn = typeof window !== 'undefined'
          && Boolean(window.doitDesktop?.isDesktop)
          && Boolean(initialUrl && (/[?&]checkout=(?:success|cancelled)/.test(initialUrl) || /[?&]stripe_return=/.test(initialUrl)));
        if (typeof window !== 'undefined' && initialUrl?.includes('stripe_return=cancelled')) {
          try {
            returningFromStripe = window.sessionStorage.getItem(stripeReturnSessionKey) === 'true';
            window.sessionStorage.removeItem(stripeReturnSessionKey);
          } catch { /* Treat unavailable session storage as a normal fresh load. */ }
        }
        if (!rememberMe && !isPasswordRecoveryUrl(initialUrl) && !returningFromStripe && !desktopExternalReturn) {
          await supabase.auth.signOut({ scope: 'local' });
          if (active) setUser(null);
        } else {
          const { data: sessionData } = await supabase.auth.getSession();
          if (active) setUser(sessionData.session?.user ?? null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    initialize();
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const signIn = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    if (!email.trim() || !password) return { error: 'Enter your email and password.' };
    if (!isSupabaseConfigured) {
      await saveRememberPreference(rememberMe);
      setUser({ id: 'demo-user', email });
      return {};
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (data.user) {
      await saveRememberPreference(rememberMe);
      setUser(data.user);
    }
    return { error: error?.message, requiresEmailVerification: error?.code === 'email_not_confirmed' };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string, rememberMe: boolean) => {
    if (!name.trim() || !email.trim() || password.length < 8) return { error: 'Add your name and use at least 8 characters.' };
    if (!isSupabaseConfigured) {
      await saveRememberPreference(rememberMe);
      setUser({ id: 'demo-user', email });
      return {};
    }
    const referralCode = await getPendingReferralCode();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { name: name.trim(), ...(referralCode ? { referral_code: referralCode } : {}) },
        emailRedirectTo: emailVerificationRedirectUrl,
      },
    });
    const isRepeatedSignup = Boolean(data.user && !data.session && data.user.identities?.length === 0);
    if (!error && isRepeatedSignup) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInData.user) {
        await saveRememberPreference(rememberMe);
        setUser(signInData.user);
        return {};
      }
      if (signInError?.code === 'email_not_confirmed') {
        await saveRememberPreference(rememberMe);
        return { requiresEmailVerification: true };
      }
      return { error: 'This email may already have an account. Try logging in instead.' };
    }
    if (!error && data.user) {
      await saveRememberPreference(rememberMe);
      await clearPendingReferralCode();
    }
    if (data.session?.user) setUser(data.session.user);
    return { error: error?.message, requiresEmailVerification: Boolean(data.user && !data.session) };
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    if (!email.trim()) return { error: 'Enter your email first.' };
    if (!isSupabaseConfigured) return {};
    const { error } = await resendSignupVerification(email);
    return { error: error?.message };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!email.trim()) return { error: 'Enter your email first.' };
    if (!isSupabaseConfigured) return {};
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: passwordRecoveryRedirectUrl });
    return { error: error?.message };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (password.length < 8) return { error: 'Use at least 8 characters.' };
    if (!isSupabaseConfigured) return {};
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    track('password reset completed');
    await supabase.auth.signOut({ scope: 'local' });
    await AsyncStorage.removeItem(authRememberKey);
    setUser(null);
    return {};
  }, []);

  const signOut = useCallback(async () => {
    track('account signed out');
    if (isSupabaseConfigured) await supabase.auth.signOut({ scope: 'local' });
    await AsyncStorage.removeItem(authRememberKey);
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.rpc('delete_user_account');
      if (error) return { error: error.message };
    }
    await AsyncStorage.removeItem(authRememberKey);
    setUser(null);
    return {};
  }, []);

  const value = useMemo(() => ({ user, loading, demoMode: !isSupabaseConfigured, signIn, signUp, resendVerification, resetPassword, updatePassword, signOut, deleteAccount }), [deleteAccount, loading, resendVerification, resetPassword, signIn, signOut, signUp, updatePassword, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
