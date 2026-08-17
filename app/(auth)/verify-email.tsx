import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { useAuth } from '@/hooks';
import { colors, radius, spacing } from '@/theme';

export default function VerifyEmailScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string | string[] }>();
  const rawEmail = Array.isArray(emailParam) ? emailParam[0] : emailParam;
  const email = rawEmail ?? '';
  const { resendVerification, demoMode } = useAuth();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const resend = async () => {
    setSending(true);
    setMessage('');
    setError('');
    const result = await resendVerification(email);
    setSending(false);
    if (result.error) setError(result.error);
    else setMessage('A fresh verification email is on its way.');
  };

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.iconWrap}>
        <Ionicons name="mail-unread-outline" color={colors.accent} size={34} />
      </View>
      <View style={styles.copy}>
        <Text variant="eyebrow" color="accent">VERIFY YOUR EMAIL</Text>
        <Text variant="title">Check your inbox.</Text>
        <Text color="secondary">
          We sent a verification link to {email || 'your email address'}. Open it on this device to finish creating your account.
        </Text>
      </View>
      <View style={styles.actions}>
        {message ? <Text variant="caption" color="accent">{message}</Text> : null}
        {error ? <Text variant="caption" color="danger">{error}</Text> : null}
        <Button label={sending ? 'Sending…' : 'Resend verification email'} disabled={sending || demoMode || !email} onPress={resend} />
        <Button label="Back to log in" variant="ghost" onPress={() => router.replace('/(auth)/login')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.xl, justifyContent: 'center' },
  iconWrap: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.accentMuted, borderRadius: radius.lg, height: 68, justifyContent: 'center', width: 68 },
  copy: { gap: spacing.sm },
  actions: { gap: spacing.md },
});
