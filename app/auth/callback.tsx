import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { completeEmailVerification, desktopAuthDeepLink, getFirstRunActivation } from '@/services';
import { track } from '@/services/observability';
import { colors, radius, spacing } from '@/theme';

type VerificationState = 'working' | 'handoff' | 'success' | 'error';

export default function AuthCallbackScreen() {
  const url = Linking.useLinkingURL();
  const google = Boolean(url?.includes('provider=google'));
  const desktopBrowserHandoff = Boolean(url?.includes('desktop=1'))
    && typeof window !== 'undefined'
    && !window.doitDesktop?.isDesktop;
  const [state, setState] = useState<VerificationState>('working');
  const [error, setError] = useState('');

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
        setState('success');
      }
    }).catch(() => {
      if (!active) return;
      setError('We could not verify this link. Please request a new one.');
      setState('error');
    });
    return () => { active = false; };
  }, [desktopBrowserHandoff, google, url]);

  const reopenDesktop = () => {
    if (!url || typeof window === 'undefined') return;
    window.location.assign(desktopAuthDeepLink(url));
  };

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={[styles.iconWrap, state === 'error' && styles.errorIcon]}>
        <Ionicons
          name={state === 'working' ? 'hourglass-outline' : state === 'handoff' ? 'desktop-outline' : state === 'success' ? 'checkmark' : 'close'}
          color={state === 'error' ? colors.danger : colors.accent}
          size={34}
        />
      </View>
      <View style={styles.copy}>
        <Text variant="eyebrow" color={state === 'error' ? 'danger' : 'accent'}>{google ? 'GOOGLE SIGN-IN' : 'EMAIL VERIFICATION'}</Text>
        <Text variant="title">{state === 'working' ? google ? 'Signing you in…' : 'Verifying your email…' : state === 'handoff' ? 'Returning to DOIT AI…' : state === 'success' ? google ? 'Welcome to DOIT.' : 'You’re verified.' : 'That link didn’t work.'}</Text>
        <Text color="secondary">
          {state === 'working' ? 'Just a moment while we secure your account.' : state === 'handoff' ? 'Your browser is handing the secure sign-in back to the installed app.' : state === 'success' ? google ? 'Google sign-in is complete. Continue to your plan.' : 'Your account is ready. You can start building your goals.' : error}
        </Text>
      </View>
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
});
