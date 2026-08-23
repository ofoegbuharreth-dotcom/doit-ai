import type { EmailOtpType } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { supabase } from './client';
export { desktopAuthDeepLink, isAuthCallbackUrl, isPasswordRecoveryUrl } from './auth-url';

const authCodeExchanges = new Map<string, ReturnType<typeof supabase.auth.exchangeCodeForSession>>();

function exchangeAuthCodeOnce(code: string) {
  const existing = authCodeExchanges.get(code);
  if (existing) return existing;
  const exchange = supabase.auth.exchangeCodeForSession(code);
  authCodeExchanges.set(code, exchange);
  // Keep the result briefly so duplicate protocol launches and React effect
  // replays receive the original result instead of consuming the code again.
  setTimeout(() => authCodeExchanges.delete(code), 2 * 60 * 1000);
  return exchange;
}

// Keep auth emails independent from Metro's changing LAN URL. This route is
// registered by the `doit` scheme in app.json and handled by Expo Router.
const isInstalledDesktop = Platform.OS === 'web'
  && typeof window !== 'undefined'
  && Boolean(window.doitDesktop?.isDesktop);

// Installed desktop builds must leave the email client through the registered
// OS protocol. Browser users stay on the HTTPS origin they started from.
export const emailVerificationRedirectUrl = isInstalledDesktop
  ? 'doit://auth/callback'
  : Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : 'doit://auth/callback';

export const passwordRecoveryRedirectUrl = isInstalledDesktop
  ? 'doit://auth/reset-password'
  : Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/auth/reset-password`
    : 'doit://auth/reset-password';

export async function resendSignupVerification(email: string) {
  return supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: emailVerificationRedirectUrl },
  });
}

export async function completeEmailVerification(url: string) {
  const parsed = new URL(url);
  const query = parsed.searchParams;
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const get = (key: string) => query.get(key) ?? fragment.get(key);

  const callbackError = get('error_description') ?? get('error');
  if (callbackError) return { error: callbackError.replace(/\+/g, ' ') };

  const code = get('code');
  if (code) {
    const { data, error } = await exchangeAuthCodeOnce(code);
    if (error) {
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) return { session: existing.session };
    }
    return { session: data.session, error: error?.message };
  }

  const tokenHash = get('token_hash');
  const type = get('type') as EmailOtpType | null;
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    return { session: data.session, error: error?.message };
  }

  const accessToken = get('access_token');
  const refreshToken = get('refresh_token');
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    return { session: data.session, error: error?.message };
  }

  const { data } = await supabase.auth.getSession();
  return data.session
    ? { session: data.session }
    : { error: 'This verification link is invalid or has expired.' };
}

export async function completePasswordRecovery(url: string) {
  const parsed = new URL(url);
  const query = parsed.searchParams;
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const get = (key: string) => query.get(key) ?? fragment.get(key);

  const callbackError = get('error_description') ?? get('error');
  if (callbackError) return { error: callbackError.replace(/\+/g, ' ') };

  const code = get('code');
  if (code) {
    const { data, error } = await exchangeAuthCodeOnce(code);
    return { session: data.session, error: error?.message };
  }

  const tokenHash = get('token_hash');
  if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    return { session: data.session, error: error?.message };
  }

  const accessToken = get('access_token');
  const refreshToken = get('refresh_token');
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    return { session: data.session, error: error?.message };
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) return { error: error.message };
  return data.session
    ? { session: data.session }
    : { error: 'This password reset link is invalid or has expired. Request a new one.' };
}
