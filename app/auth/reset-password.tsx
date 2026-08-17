import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button, Input, Screen, Text } from '@/components/ui';
import { useAuth } from '@/hooks';
import { completePasswordRecovery, isSupabaseConfigured } from '@/services';
import { colors, radius, spacing } from '@/theme';

type RecoveryState = 'verifying' | 'ready' | 'saving' | 'success' | 'error';

export default function ResetPasswordScreen() {
  const linkingUrl = Linking.useLinkingURL();
  const callbackUrl = useMemo(() => linkingUrl ?? (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null), [linkingUrl]);
  const { updatePassword } = useAuth();
  const [state, setState] = useState<RecoveryState>('verifying');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState('ready');
      return;
    }
    if (!callbackUrl) return;
    let active = true;
    completePasswordRecovery(callbackUrl).then((result) => {
      if (!active) return;
      if (result.error) {
        setError(result.error);
        setState('error');
      } else {
        setState('ready');
      }
    }).catch(() => {
      if (!active) return;
      setError('We could not verify this reset link. Request a new one.');
      setState('error');
    });
    return () => { active = false; };
  }, [callbackUrl]);

  const save = async () => {
    setError('');
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setState('saving');
    const result = await updatePassword(password);
    if (result.error) {
      setError(result.error);
      setState('ready');
      return;
    }
    setPassword('');
    setConfirmation('');
    setState('success');
  };

  const title = state === 'verifying' ? 'Checking your reset link…' : state === 'success' ? 'Password updated.' : state === 'error' ? 'That link didn’t work.' : 'Choose a new password.';
  const body = state === 'verifying'
    ? 'Just a moment while we securely open your account recovery session.'
    : state === 'success'
      ? 'Your new password is ready. Log in again to continue with your goals.'
      : state === 'error'
        ? error
        : 'Use at least 8 characters. A longer, unique password is easier to protect.';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentContainerStyle={styles.screen}>
        <View style={[styles.iconWrap, state === 'error' && styles.errorIcon]}>
          <Ionicons name={state === 'success' ? 'checkmark' : state === 'error' ? 'close' : 'lock-closed-outline'} color={state === 'error' ? colors.danger : colors.accent} size={34} />
        </View>
        <View style={styles.copy}>
          <Text variant="eyebrow" color={state === 'error' ? 'danger' : 'accent'}>PASSWORD RECOVERY</Text>
          <Text variant="title">{title}</Text>
          <Text color="secondary">{body}</Text>
        </View>
        {state === 'ready' || state === 'saving' ? <View style={styles.actions}>
          <Input label="New password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoComplete="new-password" />
          <Input label="Confirm new password" value={confirmation} onChangeText={setConfirmation} placeholder="Type it again" secureTextEntry autoComplete="new-password" error={error} />
          <Button label={state === 'saving' ? 'Updating…' : 'Update password'} disabled={state === 'saving'} icon="checkmark" onPress={save} />
        </View> : null}
        {state === 'success' ? <Button label="Log in with new password" onPress={() => router.replace('/(auth)/login')} /> : null}
        {state === 'error' ? <View style={styles.actions}>
          <Button label="Request a new link" onPress={() => router.replace('/(auth)/forgot-password' as Href)} />
          <Button label="Back to log in" variant="ghost" onPress={() => router.replace('/(auth)/login')} />
        </View> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { gap: spacing.xl, justifyContent: 'center' },
  iconWrap: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.accentMuted, borderRadius: radius.lg, height: 68, justifyContent: 'center', width: 68 },
  errorIcon: { backgroundColor: colors.surfaceElevated },
  copy: { gap: spacing.sm },
  actions: { gap: spacing.md },
});
