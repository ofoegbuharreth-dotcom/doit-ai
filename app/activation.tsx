import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { useAuth } from '@/hooks';
import { getFirstRunActivation } from '@/services';
import { useAppStore } from '@/stores';
import { colors, radius, spacing } from '@/theme';

export default function ActivationScreen() {
  const { user, loading: authLoading } = useAuth();
  const { setDraft } = useAppStore();
  const [error, setError] = useState('');

  const continueSetup = async () => {
    const activation = await getFirstRunActivation();
    if (!activation?.prompt) return router.replace('/create-goal');
    if (activation.phase === 'plan_ready' && activation.goalId) return router.replace({ pathname: '/activation-action', params: { goalId: activation.goalId, taskId: activation.taskId } } as never);
    if (activation.phase === 'completed') return router.replace('/(tabs)/home');
    setDraft({ prompt: activation.prompt });
    router.replace({ pathname: '/ai-plan', params: { activation: '1' } });
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/(auth)/login'); return; }
    continueSetup().catch(() => setError('Your setup could not resume automatically.'));
  }, [authLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Screen contentContainerStyle={styles.screen}>
    <View style={styles.progress}><View style={styles.progressFill} /></View>
    <Card style={styles.card}>
      <View style={styles.icon}><Ionicons name="sparkles" color={colors.accent} size={30} /></View>
      <Text variant="eyebrow" color="accent">STEP 2 OF 3</Text>
      <Text variant="title">Building around your outcome.</Text>
      <Text color="secondary">DOIT is carrying your goal into a focused plan. You won’t need to type it again.</Text>
      {error ? <Button label="Resume setup" onPress={continueSetup} /> : null}
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({ screen: { gap: spacing.xl, justifyContent: 'center' }, progress: { backgroundColor: colors.border, borderRadius: radius.pill, height: 5, overflow: 'hidden' }, progressFill: { backgroundColor: colors.accent, height: '100%', width: '66%' }, card: { alignItems: 'flex-start', gap: spacing.md }, icon: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.lg, height: 64, justifyContent: 'center', width: 64 } });
