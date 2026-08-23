import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button, Input, PressableScale, Screen, Text } from '@/components/ui';
import { useAuth } from '@/hooks';
import { track } from '@/services/observability';
import { getFirstRunActivation, getPendingReferralCode } from '@/services';
import { colors, radius, spacing } from '@/theme';
import { GoogleLogo } from './GoogleLogo';

export function AuthScreen({ mode }: { mode: 'login' | 'signup' }) {
  const { signIn, signUp, signInWithGoogle, demoMode } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleNotice, setGoogleNotice] = useState('');
  const [googleError, setGoogleError] = useState('');
  const [invited, setInvited] = useState(false);
  useEffect(() => { if (mode === 'signup') getPendingReferralCode().then((code) => setInvited(Boolean(code))).catch(() => undefined); }, [mode]);

  const submit = async () => {
    setLoading(true);
    setError('');
    const result = mode === 'login'
      ? await signIn(email, password, rememberMe)
      : await signUp(email, password, name, rememberMe);
    setLoading(false);
    if (result.requiresEmailVerification) {
      if (mode === 'signup') track('account signed up', { verification_required: true });
      router.replace({ pathname: '/(auth)/verify-email', params: { email: email.trim() } });
      return;
    }
    if (result.error) return setError(result.error);
    track(mode === 'login' ? 'account signed in' : 'account signed up');
    const activation = await getFirstRunActivation();
    router.replace((activation && activation.phase !== 'completed' ? '/activation' : mode === 'signup' ? '/create-goal' : '/(tabs)/home') as never);
  };

  const continueWithGoogle = async () => {
    setGoogleLoading(true); setGoogleNotice(''); setGoogleError(''); setError('');
    const result = await signInWithGoogle(rememberMe);
    if (result.error) { setGoogleError(result.error); setGoogleLoading(false); return; }
    if (result.oauthOpened && typeof window !== 'undefined' && window.doitDesktop?.isDesktop) {
      setGoogleNotice('Finish securely in the browser. DOIT will reopen automatically.');
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scrollable contentContainerStyle={styles.screen}>
        <View style={styles.heading}>
          <Text variant="eyebrow" color="accent">{mode === 'login' ? 'WELCOME BACK' : 'START EXECUTING'}</Text>
          <Text variant="title">{mode === 'login' ? 'Pick up the plan.' : 'Create your account.'}</Text>
          <Text color="secondary">{demoMode ? 'Demo mode is active. Any valid details will let you explore.' : 'Your goals stay private and sync securely.'}</Text>
        </View>
        <Animated.View entering={FadeInDown.delay(80).duration(360)} style={styles.form}>
          {mode === 'signup' && invited ? <View style={styles.invite}><Ionicons name="rocket" color={colors.accent} size={19} /><View style={styles.inviteCopy}><Text variant="label" color="accent">Founding 50 invite detected</Text><Text variant="caption" color="muted">Your account will be linked to the member who invited you.</Text></View></View> : null}
          <PressableScale accessibilityRole="button" disabled={googleLoading || loading} haptic="selection" onPress={continueWithGoogle} style={[styles.google, (googleLoading || loading) && styles.disabled]}>
            <View style={styles.googleIcon}><GoogleLogo size={22} /></View>
            <Text variant="label" style={styles.googleText}>{googleLoading ? 'Opening Google…' : mode === 'login' ? 'Log in with Google' : 'Sign up with Google'}</Text>
            <Ionicons name="arrow-forward" color={colors.textMuted} size={18} />
          </PressableScale>
          {googleError ? <Animated.View entering={FadeInDown.duration(220)}><Text variant="caption" color="danger">{googleError}</Text></Animated.View> : null}
          {googleNotice ? <Animated.View entering={FadeInDown.duration(220)} style={styles.googleNotice}><Ionicons name="open-outline" color={colors.accent} size={18} /><Text variant="caption" color="secondary" style={styles.inviteCopy}>{googleNotice}</Text></Animated.View> : null}
          <View style={styles.divider}><View style={styles.dividerLine} /><Text variant="caption" color="muted">OR CONTINUE WITH EMAIL</Text><View style={styles.dividerLine} /></View>
          {mode === 'signup' ? <Input label="Name" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" /> : null}
          <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Input label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} error={error} />
          {mode === 'login' ? <Pressable hitSlop={12} onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: { email: email.trim() } } as unknown as Href)}><Text variant="caption" color="accent">Forgot password?</Text></Pressable> : null}
          <PressableScale accessibilityRole="checkbox" accessibilityState={{ checked: rememberMe }} haptic="selection" onPress={() => setRememberMe((value) => !value)} style={styles.remember}>
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe ? <Ionicons name="checkmark" color={colors.onAccent} size={16} /> : null}
            </View>
            <View style={styles.rememberCopy}>
              <Text variant="label">Remember me</Text>
              <Text variant="caption" color="muted">Stay signed in on this device</Text>
            </View>
          </PressableScale>
          <Button label={loading ? 'Working…' : mode === 'login' ? 'Log in' : 'Create account'} disabled={loading} onPress={submit} />
        </Animated.View>
        <Pressable onPress={() => router.replace(mode === 'login' ? '/(auth)/signup' : '/(auth)/login')}>
          <Text variant="caption" color="secondary">{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}</Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flexGrow: 1, gap: spacing.xl, justifyContent: 'center' },
  heading: { gap: spacing.sm },
  form: { gap: spacing.md },
  google: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 58, paddingHorizontal: spacing.sm },
  googleIcon: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#DADCE0', borderRadius: radius.sm, borderWidth: 1, height: 38, justifyContent: 'center', width: 38 },
  googleText: { flex: 1, textAlign: 'center' },
  googleNotice: { alignItems: 'center', backgroundColor: colors.accentMuted, borderColor: colors.accentBorder, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  divider: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.xs },
  dividerLine: { backgroundColor: colors.borderSubtle, flex: 1, height: 1 },
  disabled: { opacity: 0.6 },
  invite: { alignItems: 'center', backgroundColor: colors.accentMuted, borderColor: colors.accentBorder, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md }, inviteCopy: { flex: 1, gap: spacing.xxs },
  remember: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  checkbox: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, height: 24, justifyContent: 'center', width: 24 },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  rememberCopy: { gap: spacing.xxs },
});
