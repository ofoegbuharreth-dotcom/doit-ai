import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Input, Screen, Text } from '@/components/ui';
import { useAuth } from '@/hooks';
import { completeEmailVerification, desktopAuthDeepLink, getFirstRunActivation, shouldCreatePasswordAfterGoogleSignup } from '@/services';
import { track } from '@/services/observability';
import { colors, radius, spacing } from '@/theme';

type VerificationState = 'working' | 'handoff' | 'password' | 'success' | 'error';

export default function AuthCallbackScreen() {
  const url = Linking.useLinkingURL();
  const google = Boolean(url?.includes('provider=google'));
  const intent = (() => { try { return url ? new URL(url).searchParams.get('intent') : null; } catch { return null; } })();
  const desktopBrowserHandoff = Boolean(url?.includes('desktop=1'))
    && typeof window !== 'undefined'
    && !window.doitDesktop?.isDesktop;
  const [state, setState] = useState<VerificationState>('working');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const { setInitialPassword } = useAuth();

  const continueAfterVerification = async () => {
    const activation = await getFirstRunActivation();
    router.replace((activation && activation.phase !== 'completed' ? '/activation' : '/create-goal') as never);
  };

  useEffect(() => {
    if (!url) return;
    if (desktopBrowserHandoff) {
      setState('handoff');
      window.location.assign(desktopAuthDeepLink(url));
      return;
    }
    let active = true;
    completeEmailVerification(url).then((result) => {
      if (!active) return;
      if (result.error) {
        setError(result.error);
        setState('error');
      } else {
        if (google) track('account signed in', { provider: 'google' });
        setState(google && shouldCreatePasswordAfterGoogleSignup(result.session, intent) ? 'password' : 'success');
      }
    }).catch(() => {
      if (!active) return;
      setError('We could not verify this link. Please request a new one.');
      setState('error');
    });
    return () => { active = false; };
  }, [desktopBrowserHandoff, google, intent, url]);

  const createPassword = async () => {
    setError('');
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirmation) return setError('Those passwords do not match.');
    setPasswordSaving(true);
    const result = await setInitialPassword(password);
    setPasswordSaving(false);
    if (result.error) return setError(result.error);
    setPassword(''); setConfirmation(''); setState('success');
  };

  const reopenDesktop = () => {
    if (!url || typeof window === 'undefined') return;
    window.location.assign(desktopAuthDeepLink(url));
  };

  return (
    <Screen scrollable contentContainerStyle={styles.screen}>
      <View style={[styles.iconWrap, state === 'error' && styles.errorIcon]}>
        <Ionicons
          name={state === 'working' ? 'hourglass-outline' : state === 'handoff' ? 'desktop-outline' : state === 'password' ? 'key-outline' : state === 'success' ? 'checkmark' : 'close'}
          color={state === 'error' ? colors.danger : colors.accent}
          size={34}
        />
      </View>
      <View style={styles.copy}>
        <Text variant="eyebrow" color={state === 'error' ? 'danger' : 'accent'}>{state === 'password' ? 'SECURE YOUR ACCOUNT' : google ? 'GOOGLE SIGN-IN' : 'EMAIL VERIFICATION'}</Text>
        <Text variant="title">{state === 'working' ? google ? 'Signing you in…' : 'Verifying your email…' : state === 'handoff' ? 'Returning to DOIT AI…' : state === 'password' ? 'Create your DOIT password.' : state === 'success' ? google ? 'Welcome to DOIT.' : 'You’re verified.' : 'That link didn’t work.'}</Text>
        <Text color="secondary">
          {state === 'working' ? 'Just a moment while we secure your account.' : state === 'handoff' ? 'Your browser is handing the secure sign-in back to the installed app.' : state === 'password' ? 'Use this password whenever Google is unavailable, or when you want to log in directly with your email.' : state === 'success' ? google ? 'Your Google account is ready. Continue to your plan.' : 'Your account is ready. You can start building your goals.' : error}
        </Text>
      </View>
      {state === 'password' ? <View style={styles.passwordForm}>
        <Input label="Create password" value={password} onChangeText={(value) => { setPassword(value); setError(''); }} placeholder="At least 8 characters" secureTextEntry autoComplete="new-password" />
        <Input label="Confirm password" value={confirmation} onChangeText={(value) => { setConfirmation(value); setError(''); }} placeholder="Enter it again" secureTextEntry autoComplete="new-password" onSubmitEditing={createPassword} />
        {error ? <Text variant="caption" color="danger">{error}</Text> : null}
        <Button label={passwordSaving ? 'Creating password…' : 'Create password'} icon="shield-checkmark-outline" disabled={passwordSaving} onPress={createPassword} />
      </View> : null}
      {state === 'handoff' ? <Button label="Open DOIT AI" icon="open-outline" onPress={reopenDesktop} /> : null}
      {state === 'success' ? <Button label="Continue my setup" onPress={continueAfterVerification} /> : null}
      {state === 'error' ? <Button label="Return to log in" onPress={() => router.replace('/(auth)/login')} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.xl, justifyContent: 'center' },
  iconWrap: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.accentMuted, borderRadius: radius.lg, height: 68, justifyContent: 'center', width: 68 },
  errorIcon: { backgroundColor: colors.surfaceElevated },
  copy: { gap: spacing.sm },
  passwordForm: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md, maxWidth: 620, padding: spacing.lg, width: '100%' },
});
