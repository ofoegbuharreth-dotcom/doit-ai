import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Button, Card, Screen, Text } from '@/components/ui';
import { completeFirstRunActivation } from '@/services';
import { track } from '@/services/observability';
import { useAppStore } from '@/stores';
import { colors, radius, spacing } from '@/theme';

export default function ActivationActionScreen() {
  const params = useLocalSearchParams<{ goalId?: string; taskId?: string }>();
  const { goals, tasks, completeFocusedTask, syncing } = useAppStore();
  const task = useMemo(() => tasks.find((item) => item.id === params.taskId) ?? tasks.find((item) => item.goalId === params.goalId && item.status === 'pending'), [params.goalId, params.taskId, tasks]);
  const goal = goals.find((item) => item.id === (params.goalId ?? task?.goalId));
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!running || completed) return;
    const timer = setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [completed, running]);

  const start = () => {
    startedAt.current = Date.now();
    setRunning(true);
    track('activation first action started', { estimated_minutes: task?.estimatedMinutes ?? 5 });
  };

  const finish = async () => {
    if (!task) return;
    setSaving(true); setError('');
    const elapsedMinutes = Math.max(1, Math.ceil(((startedAt.current ? Date.now() - startedAt.current : 60000) / 60000)));
    const result = await completeFocusedTask(task.id, elapsedMinutes);
    setSaving(false);
    if (result.error) return setError(result.error);
    await completeFirstRunActivation();
    track('activation completed', { elapsed_seconds: Math.max(1, Math.round((Date.now() - (startedAt.current ?? Date.now())) / 1000)), goal_created: true });
    setCompleted(true);
  };

  if (!task && syncing) return <Screen contentContainerStyle={styles.center}><Text variant="heading">Preparing your first move…</Text></Screen>;
  if (!task) return <Screen contentContainerStyle={styles.center}><Text variant="title">Your plan is ready.</Text><Text color="secondary">Open Today to choose the first action.</Text><Button label="Go to Today" onPress={() => router.replace('/(tabs)/home')} /></Screen>;

  if (completed) return <Screen contentContainerStyle={styles.completedScreen}>
    <Animated.View entering={ZoomIn.springify()} style={styles.successIcon}><Ionicons name="checkmark" color={colors.onAccent} size={42} /></Animated.View>
    <Animated.View entering={FadeInDown.delay(120)} style={styles.completedCopy}><Text variant="eyebrow" color="accent">FIRST WIN COMPLETE</Text><Text variant="display">You didn’t just set a goal. You started it.</Text><Text color="secondary">“{goal?.title ?? 'Your goal'}” is live, your first action is done, and DOIT will recommend what comes next.</Text></Animated.View>
    <Card style={styles.momentum}><Ionicons name="trending-up" color={colors.accent} size={23} /><View style={styles.flex}><Text variant="label">Momentum +1</Text><Text variant="caption" color="muted">Your progress started today.</Text></View></Card>
    <Button label="Open my Today plan" icon="arrow-forward" onPress={() => router.replace('/(tabs)/home')} />
  </Screen>;

  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const seconds = (secondsLeft % 60).toString().padStart(2, '0');
  return <Screen scrollable contentContainerStyle={styles.screen}>
    <View style={styles.progress}><View style={styles.progressFill} /></View>
    <View style={styles.heading}><Text variant="eyebrow" color="accent">STEP 3 OF 3 · TAKE ACTION</Text><Text variant="title">Make the goal real.</Text><Text color="secondary">This is intentionally small. Finish one visible starting point, then you’re done for setup.</Text></View>
    <Card style={styles.actionCard}>
      <View style={styles.actionTop}><View style={styles.bolt}><Ionicons name="flash" color={colors.accent} size={23} /></View><View style={styles.flex}><Text variant="caption" color="muted">FOR {goal?.title?.toUpperCase() ?? 'YOUR GOAL'}</Text><Text variant="heading">{task.title}</Text></View></View>
      <Text color="secondary">{task.description}</Text>
      <View style={styles.timer}><Text style={styles.timerText}>{minutes}:{seconds}</Text><Text variant="caption" color="muted">A focused five-minute start</Text></View>
      {!running ? <Button label="Start my first move" icon="play" onPress={start} /> : <Button label={saving ? 'Saving your win…' : 'I finished the first move'} icon="checkmark" disabled={saving} onPress={finish} />}
      {error ? <Text variant="caption" color="danger">{error}</Text> : null}
    </Card>
    <Button label="Finish this later" variant="ghost" onPress={() => router.replace('/(tabs)/home')} />
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.lg }, center: { alignItems: 'center', gap: spacing.md, justifyContent: 'center' }, progress: { backgroundColor: colors.border, borderRadius: radius.pill, height: 5, overflow: 'hidden' }, progressFill: { backgroundColor: colors.accent, height: '100%', width: '100%' }, heading: { gap: spacing.sm, maxWidth: 700 }, actionCard: { gap: spacing.lg }, actionTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, bolt: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.md, height: 50, justifyContent: 'center', width: 50 }, flex: { flex: 1 }, timer: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.xs, padding: spacing.lg }, timerText: { color: colors.textPrimary, fontFamily: 'Manrope_800ExtraBold', fontSize: 46, fontVariant: ['tabular-nums'], lineHeight: 54 }, completedScreen: { gap: spacing.xl, justifyContent: 'center' }, successIcon: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.pill, height: 78, justifyContent: 'center', width: 78 }, completedCopy: { gap: spacing.md, maxWidth: 760 }, momentum: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
});
