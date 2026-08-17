import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button, Input, Screen, Text } from '@/components/ui';
import { useAuth } from '@/hooks';
import { track } from '@/services/observability';
import { colors, radius, spacing } from '@/theme';

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const initialEmail = Array.isArray(params.email) ? params.email[0] : params.email;
  const { resetPassword, demoMode } = useAuth();
  const [email, setEmail] = useState(initialEmail ?? '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    setSending(true);
    setError('');
    const result = await resetPassword(email);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    track('password reset requested');
    setSent(true);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentContainerStyle={styles.screen}>
        <View style={styles.iconWrap}>
          <Ionicons name={sent ? 'mail-open-outline' : 'key-outline'} color={colors.accent} size={34} />
        </View>
        <View style={styles.copy}>
          <Text variant="eyebrow" color="accent">PASSWORD RECOVERY</Text>
          <Text variant="title">{sent ? 'Check your inbox.' : 'Reset your password.'}</Text>
          <Text color="secondary">
            {sent
              ? `If an account exists for ${email.trim()}, we sent it a secure reset link. The link expires, so open it soon.`
              : 'Enter the email connected to your DOIT account. We’ll send you a secure link to choose a new password.'}
          </Text>
        </View>
        <View style={styles.actions}>
          {!sent ? <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={error} /> : null}
          {!sent ? <Button label={sending ? 'Sending…' : 'Send reset link'} disabled={sending || demoMode || !email.trim()} icon="arrow-forward" onPress={send} /> : null}
          {sent ? <Button label="Back to log in" onPress={() => router.replace('/(auth)/login')} /> : null}
          {sent ? <Button label="Use a different email" variant="secondary" onPress={() => { setSent(false); setError(''); }} /> : null}
          {!sent ? <Button label="Back to log in" variant="ghost" onPress={() => router.back()} /> : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { gap: spacing.xl, justifyContent: 'center' },
  iconWrap: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.accentMuted, borderRadius: radius.lg, height: 68, justifyContent: 'center', width: 68 },
  copy: { gap: spacing.sm },
  actions: { gap: spacing.md },
});
