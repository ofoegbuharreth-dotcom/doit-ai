import Ionicons from '@expo/vector-icons/Ionicons';
import { router as expoRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOutUp, ZoomIn } from 'react-native-reanimated';

import { NewGoalButton } from './_layout';
import { DailyCheckIn } from '@/components/checkins/DailyCheckIn';
import { AdaptiveDailyPlan } from '@/components/planning/AdaptiveDailyPlan';
import { ProgressLogSheet } from '@/components/progress/ProgressLogSheet';
import { SyncStatus } from '@/components/sync';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Button, Card, ProgressBar, Screen, SectionHeader, Text } from '@/components/ui';
import { useAuth, useSubscription } from '@/hooks';
import { useAppStore } from '@/stores';
import { confirmStripeCancellation } from '@/services/purchases';
import { getFirstRunActivation, type FirstRunActivation } from '@/services';
import { colors, radius, spacing } from '@/theme';
import type { TaskStatus } from '@/types';
import { completionStreak, greeting, taskProgress, today } from '@/utils';

const priorityRank = { high: 0, medium: 1, low: 2 };
const router = expoRouter as unknown as { push: (href: string) => void };

export default function TodayScreen() {
  const params = useLocalSearchParams<{ stripe_return?: string }>();
  const { user } = useAuth();
  const { adaptationLimit, planName } = useSubscription();
  const { goals, tasks, activity, updateTask, replaceTask, replacingTaskId, checkIns, submitCheckIn, syncing, syncError, refreshWorkspace, planningToday, dailyPlanError, ensureTodayPlan } = useAppStore();
  const [checkIn, setCheckIn] = useState(false);
  const [progressGoalId, setProgressGoalId] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [cancellationNotice, setCancellationNotice] = useState<'sending' | 'sent' | 'error'>();
  const [activation, setActivation] = useState<FirstRunActivation | null>(null);
  useEffect(() => { getFirstRunActivation().then((value) => setActivation(value?.phase === 'plan_ready' ? value : null)).catch(() => undefined); }, []);
  useEffect(() => { if (!celebrating) return; const timer = setTimeout(() => setCelebrating(false), 1750); return () => clearTimeout(timer); }, [celebrating]);
  useEffect(() => {
    if (params.stripe_return !== 'cancelled') return;
    let active = true;
    setCancellationNotice('sending');
    confirmStripeCancellation()
      .then(() => { if (active) setCancellationNotice('sent'); })
      .catch(() => { if (active) setCancellationNotice('error'); })
      .finally(() => { expoRouter.setParams({ stripe_return: undefined }); });
    return () => { active = false; };
  }, [params.stripe_return]);

  const activeGoalIds = useMemo(() => new Set(goals.filter((goal) => goal.status === 'active').map((goal) => goal.id)), [goals]);
  const todayTasks = useMemo(() => tasks.filter((task) => task.scheduledDate === today() && task.status !== 'moved' && task.status !== 'skipped' && (!task.goalId || activeGoalIds.has(task.goalId))), [activeGoalIds, tasks]);
  const pending = todayTasks.filter((task) => task.status === 'pending').sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
  const recommended = pending[0];
  const queue = pending.slice(1);
  const done = todayTasks.filter((task) => task.status === 'completed').length;
  const progress = taskProgress(todayTasks);
  const streak = completionStreak(tasks);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const replacementsThisMonth = activity.filter((item) => item.title === 'DOIT created an easier next move' && new Date(item.createdAt) >= monthStart).length;
  const metadataName = user && 'user_metadata' in user ? user.user_metadata?.name : undefined;
  const personName = String(metadataName || user?.email?.split('@')[0] || 'there').trim().split(/\s+/)[0];
  const act = (taskId: string, status: TaskStatus) => { updateTask(taskId, status); if (status === 'completed') setCelebrating(true); };
  const adaptationLimitReached = replacementsThisMonth >= adaptationLimit;
  const requestReplacement = (taskId: string) => { if (adaptationLimitReached) router.push('/pro'); else replaceTask(taskId, 'This action felt blocked or too difficult'); };
  useEffect(() => {
    if (!syncing) ensureTodayPlan();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active' && !syncing) ensureTodayPlan(); });
    return () => subscription.remove();
  }, [ensureTodayPlan, syncing]);

  return <>
    <Screen scrollable refreshing={syncing} onRefresh={refreshWorkspace} contentContainerStyle={styles.screen}>
      <View style={styles.heroTop}><View style={styles.hero}><Text variant="body" color="secondary">{greeting()}, {personName}!</Text><Text variant="title">Today</Text><Text color="secondary">One clear move. Then the next.</Text></View><SyncStatus /></View>
      {cancellationNotice ? <Card style={styles.cancellationNotice}><Ionicons name={cancellationNotice === 'sent' ? 'checkmark-circle' : cancellationNotice === 'error' ? 'alert-circle' : 'mail-outline'} color={cancellationNotice === 'error' ? colors.danger : cancellationNotice === 'sent' ? colors.success : colors.accent} size={22} /><View style={styles.cancellationCopy}><Text variant="label">{cancellationNotice === 'sending' ? 'Confirming your cancellation…' : cancellationNotice === 'sent' ? 'Cancellation confirmed' : 'Cancellation confirmed, but the email needs another try'}</Text><Text variant="caption" color="secondary">{cancellationNotice === 'sending' ? 'DOIT is checking Stripe and sending the cancellation email.' : cancellationNotice === 'sent' ? 'The owner notification was sent successfully.' : 'Open Manage subscription and return here to retry, or contact support.'}</Text></View></Card> : null}
      {syncError ? <Card style={styles.syncError}><Text variant="label" color="danger">Couldn’t sync your data</Text><Text variant="caption" color="secondary">{syncError}</Text><Button label="Try again" variant="secondary" onPress={refreshWorkspace} /></Card> : null}
      {dailyPlanError ? <Card style={styles.syncError}><Text variant="label" color="danger">Today’s plan needs another try</Text><Text variant="caption" color="secondary">{dailyPlanError}</Text><Button label="Build today’s plan" variant="secondary" onPress={() => ensureTodayPlan(true)} /></Card> : null}
      {activation?.goalId ? <Card style={styles.activationCard}><View style={styles.activationIcon}><Ionicons name="rocket" color={colors.accent} size={22} /></View><View style={styles.activationCopy}><Text variant="eyebrow" color="accent">FINISH YOUR 5-MINUTE SETUP</Text><Text variant="heading">Your first move is waiting.</Text><Text variant="caption" color="secondary">Complete it now to turn your new goal into real momentum.</Text></View><Button label="Finish setup" icon="arrow-forward" onPress={() => router.push(`/activation-action?goalId=${encodeURIComponent(activation.goalId!)}${activation.taskId ? `&taskId=${encodeURIComponent(activation.taskId)}` : ''}`)} /></Card> : null}
      <View style={styles.stats}>
        <Card style={styles.stat}><Ionicons name="flame" color={colors.warning} size={22} /><Text variant="heading">{streak}</Text><Text variant="caption" color="muted">day streak</Text></Card>
        <Card style={styles.statWide}><View style={styles.overviewTop}><Text variant="eyebrow" color="accent">DAILY PROGRESS</Text><Text variant="label" color="accent">{progress}%</Text></View><ProgressBar progress={progress} height={8} /><Text variant="caption" color="muted">{syncing ? 'Syncing…' : `${done} of ${todayTasks.length} complete`}</Text></Card>
      </View>

      <AdaptiveDailyPlan />

      <SectionHeader eyebrow="RECOMMENDED" title="Your next action" />
      {planningToday && !recommended ? <Card style={styles.planning}><View style={styles.focusIcon}><Ionicons name="sparkles" color={colors.accent} size={22} /></View><View style={styles.planningCopy}><Text variant="heading">Building your morning plan…</Text><Text color="secondary">DOIT is choosing the most useful actions across your active goals.</Text></View></Card> : recommended ? <Card style={styles.focusCard}>
        <View style={styles.focusIcon}><Ionicons name="sparkles" color={colors.accent} size={22} /></View>
        <Text variant="heading">{recommended.title}</Text>
        <Text color="secondary">{recommended.description}</Text>
        <View style={styles.meta}><Text variant="caption" color="accent">{recommended.estimatedMinutes} MIN</Text><Text variant="caption" color="muted">{goals.find((goal) => goal.id === recommended.goalId)?.title}</Text></View>
        <Button label="Start focus" icon="play" onPress={() => router.push(`/focus/${recommended.id}`)} />
        <Button label="Complete action" variant="secondary" icon="checkmark" onPress={() => act(recommended.id, 'completed')} />
        {recommended.goalId ? <Button label="Log real progress" variant="secondary" icon="trending-up" onPress={() => setProgressGoalId(recommended.goalId!)} /> : null}
        <Button label="Time block this action" variant="secondary" icon="calendar-outline" onPress={() => router.push('/calendar')} />
        <View style={styles.focusActions}>
          <SmallAction icon="play-skip-forward" label="Skip" onPress={() => act(recommended.id, 'skipped')} />
          <SmallAction icon="calendar" label="Tomorrow" onPress={() => act(recommended.id, 'moved')} />
          <SmallAction icon={adaptationLimitReached ? 'diamond' : 'sparkles'} label={replacingTaskId === recommended.id ? 'Adapting…' : adaptationLimitReached ? `${planName} limit` : "I'm stuck"} disabled={Boolean(replacingTaskId)} onPress={() => requestReplacement(recommended.id)} />
        </View>
      </Card> : <Card style={styles.empty}><Text variant="heading">{todayTasks.length ? 'Today is complete.' : 'Today is clear.'}</Text><Text color="secondary">{todayTasks.length ? 'That’s enough. Protect the momentum and come back tomorrow.' : goals.some((goal) => goal.status === 'active') ? 'Your plan can be rebuilt whenever you’re ready.' : 'Create a goal and DOIT will choose your first move.'}</Text>{!todayTasks.length && goals.some((goal) => goal.status === 'active') ? <Button label="Build today’s plan" variant="secondary" icon="sparkles" onPress={() => ensureTodayPlan(true)} /> : null}</Card>}

      {queue.length ? <><SectionHeader title="Up next" detail={`${queue.length}`} /><View style={styles.list}>{queue.map((task) => <TaskCard key={task.id} task={task} goal={goals.find((goal) => goal.id === task.goalId)} onAction={(status) => act(task.id, status)} />)}</View></> : null}
      {done ? <><SectionHeader title="Completed today" detail={`${done}`} /><View style={styles.list}>{todayTasks.filter((task) => task.status === 'completed').map((task) => <TaskCard key={task.id} task={task} goal={goals.find((goal) => goal.id === task.goalId)} onAction={(status) => act(task.id, status)} />)}</View></> : null}
      {!checkIns.some((item) => item.date === today()) ? <Button label="Evening check-in" variant="secondary" icon="moon-outline" onPress={() => setCheckIn(true)} /> : <Card style={styles.checkedIn}><Ionicons name="checkmark-circle" color={colors.success} size={20} /><Text variant="caption" color="secondary">Today’s reflection is saved.</Text></Card>}
      <View style={styles.bottomSpace} />
    </Screen>
    {celebrating ? <Animated.View pointerEvents="none" entering={FadeInDown.duration(260).easing(Easing.out(Easing.cubic))} exiting={FadeOutUp.duration(210).easing(Easing.in(Easing.cubic))} style={styles.celebration}>
      <Animated.View entering={ZoomIn.delay(70).springify().damping(14).stiffness(180)} style={styles.celebrationIcon}><Ionicons name="checkmark" color={colors.onAccent} size={20} /></Animated.View>
      <View style={styles.celebrationCopy}><Text variant="label">Momentum +1</Text><Text variant="caption" color="secondary">Your goal moved forward.</Text></View>
    </Animated.View> : null}
    <NewGoalButton />
    <DailyCheckIn visible={checkIn} onClose={() => setCheckIn(false)} onSubmit={submitCheckIn} />
    <ProgressLogSheet visible={Boolean(progressGoalId)} goal={goals.find((goal) => goal.id === progressGoalId)} onClose={() => setProgressGoalId(null)} onSaved={(result) => { if (result.goalCompleted || result.milestone) setCelebrating(true); }} />
  </>;
}

function SmallAction({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.smallAction, pressed && styles.pressed, disabled && styles.disabled]}><Ionicons name={icon} color={colors.textSecondary} size={17} /><Text variant="caption" color="secondary">{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg, paddingTop: spacing.lg }, heroTop: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }, hero: { flex: 1, gap: spacing.xs }, syncError: { borderColor: colors.danger, gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm }, stat: { alignItems: 'center', gap: spacing.xxs, justifyContent: 'center', minWidth: 96 }, statWide: { flex: 1, gap: spacing.sm }, overviewTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  focusCard: { backgroundColor: colors.surfaceElevated, borderColor: colors.accent, gap: spacing.md }, focusIcon: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 }, meta: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  planning: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, planningCopy: { flex: 1, gap: spacing.xs }, cancellationNotice: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, cancellationCopy: { flex: 1, gap: spacing.xxs },
  activationCard: { backgroundColor: colors.accentMuted, borderColor: colors.accentBorder, gap: spacing.md }, activationIcon: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 }, activationCopy: { gap: spacing.xs },
  focusActions: { flexDirection: 'row', gap: spacing.xs }, smallAction: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flex: 1, gap: spacing.xxs, justifyContent: 'center', minHeight: 62, padding: spacing.xs }, pressed: { opacity: 0.7 }, disabled: { opacity: 0.45 },
  list: { gap: spacing.sm }, empty: { gap: spacing.xs }, checkedIn: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }, bottomSpace: { height: 84 },
  celebration: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.accentBorder, borderRadius: radius.lg, borderWidth: 1, bottom: 104, flexDirection: 'row', gap: spacing.sm, maxWidth: 380, paddingHorizontal: spacing.md, paddingVertical: 12, position: 'absolute', width: '88%' }, celebrationIcon: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.pill, height: 38, justifyContent: 'center', width: 38 }, celebrationCopy: { flex: 1, gap: 1 },
});
