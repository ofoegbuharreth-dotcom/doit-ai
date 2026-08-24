import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Button, Card, Input, Text } from '@/components/ui';
import { useAdaptivePlan, type DailyEnergy, type DailyPlanSettings } from '@/hooks/use-adaptive-plan';
import { openTimeBlockEditor } from '@/services/calendar';
import { useAppStore } from '@/stores';
import { colors, radius, spacing } from '@/theme';

const capacityOptions = [30, 60, 90, 120] as const;
const energyOptions: { value: DailyEnergy; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'low', label: 'Low', icon: 'battery-dead-outline' },
  { value: 'steady', label: 'Steady', icon: 'battery-half-outline' },
  { value: 'high', label: 'High', icon: 'flash-outline' },
];

export function AdaptiveDailyPlan() {
  const { tasks, goals } = useAppStore();
  const { plan, loading, build, rebalance } = useAdaptivePlan();
  const [open, setOpen] = useState(false);
  const [availableMinutes, setAvailableMinutes] = useState(60);
  const [energy, setEnergy] = useState<DailyEnergy>('steady');
  const [startTime, setStartTime] = useState(() => {
    const next = new Date(Date.now() + 15 * 60_000);
    next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15, 0, 0);
    return `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
  });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const goalById = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);
  const planTasks = plan?.items.map((item) => ({ item, task: taskById.get(item.taskId) })).filter((entry) => entry.task) ?? [];
  const completed = planTasks.filter(({ task }) => task?.status === 'completed').length;

  const create = async () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) return setError('Use a time such as 09:00 or 18:30.');
    setWorking(true); setError('');
    const settings: DailyPlanSettings = { availableMinutes, energy, startTime };
    const next = await build(settings);
    setWorking(false);
    if (!next.items.length) return setError('Create an active goal first so DOIT has something meaningful to plan.');
    setOpen(false);
  };

  if (loading) return null;
  return <>
    {plan?.items.length ? <Card style={styles.planCard}>
      <View style={styles.planHeader}><View style={styles.planMark}><Ionicons name="sparkles" color={colors.accent} size={20} /></View><View style={styles.flex}><Text variant="eyebrow" color="accent">ADAPTIVE DAY</Text><Text variant="heading">Your best {plan.items.length} move{plan.items.length === 1 ? '' : 's'}</Text></View><Pressable accessibilityLabel="Edit daily plan" onPress={() => setOpen(true)} style={styles.edit}><Ionicons name="options-outline" color={colors.textSecondary} size={19} /></Pressable></View>
      <View style={styles.summary}><Text variant="caption" color="secondary">{plan.availableMinutes} min available</Text><View style={styles.dot} /><Text variant="caption" color="secondary">{plan.energy} energy</Text><View style={styles.dot} /><Text variant="caption" color="accent">{completed}/{plan.items.length} done</Text></View>
      <View style={styles.timeline}>{planTasks.map(({ item, task }, index) => {
        if (!task) return null;
        const goal = goalById.get(task.goalId ?? '');
        const done = task.status === 'completed';
        return <View key={task.id} style={styles.planRow}><View style={styles.time}><Text variant="caption" color={done ? 'muted' : 'accent'}>{item.startTime}</Text><View style={[styles.line, index === planTasks.length - 1 && styles.lineLast]} /></View><View style={[styles.planCopy, done && styles.done]}><View style={styles.rowTop}><Text variant="label" style={styles.flex}>{task.title}</Text>{item.risk ? <View style={[styles.risk, item.risk === 'urgent' && styles.riskUrgent]}><Text variant="caption" style={item.risk === 'urgent' ? styles.riskUrgentText : styles.riskWatchText}>{item.risk === 'urgent' ? 'AT RISK' : 'WATCH'}</Text></View> : null}</View><Text variant="caption" color="muted">{item.startTime}–{item.endTime} · {goal?.title ?? 'DOIT action'}</Text></View><Pressable accessibilityLabel={`Add ${task.title} to calendar`} onPress={() => openTimeBlockEditor({ title: task.title, date: plan.date, startTime: item.startTime, durationMinutes: task.estimatedMinutes || 25, notes: task.description })} style={styles.calendar}><Ionicons name="calendar-outline" color={colors.textSecondary} size={18} /></Pressable></View>;
      })}</View>
      <View style={styles.actions}><Button label="Rebalance" variant="secondary" icon="refresh" onPress={rebalance} /><Button label="Change capacity" variant="ghost" onPress={() => setOpen(true)} /></View>
    </Card> : <Pressable onPress={() => setOpen(true)} style={styles.prompt}><View style={styles.promptIcon}><Ionicons name="sunny-outline" color={colors.accent} size={22} /></View><View style={styles.flex}><Text variant="label">Plan around your real day</Text><Text variant="caption" color="secondary">Tell DOIT your time and energy. Get up to three realistic moves.</Text></View><Ionicons name="arrow-forward" color={colors.accent} size={20} /></Pressable>}

    <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}><Animated.View entering={FadeIn.duration(160)} style={styles.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} /><Animated.View entering={SlideInDown.springify().damping(22)} style={styles.sheet}><View style={styles.handle} /><View style={styles.modalHeading}><Text variant="eyebrow" color="accent">PLAN MY DAY</Text><Text variant="title">What can today hold?</Text><Text color="secondary">DOIT will prioritise deadlines, match your energy and protect you from overcommitting.</Text></View><Text variant="label">Available focus time</Text><View style={styles.choices}>{capacityOptions.map((minutes) => <Pressable key={minutes} onPress={() => setAvailableMinutes(minutes)} style={[styles.choice, availableMinutes === minutes && styles.choiceActive]}><Text variant="label" color={availableMinutes === minutes ? 'accent' : 'secondary'}>{minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}</Text></Pressable>)}</View><Text variant="label">Energy right now</Text><View style={styles.choices}>{energyOptions.map((option) => <Pressable key={option.value} onPress={() => setEnergy(option.value)} style={[styles.energyChoice, energy === option.value && styles.choiceActive]}><Ionicons name={option.icon} color={energy === option.value ? colors.accent : colors.textMuted} size={19} /><Text variant="caption" color={energy === option.value ? 'accent' : 'secondary'}>{option.label}</Text></Pressable>)}</View><Input label="Start around" value={startTime} onChangeText={setStartTime} placeholder="09:00" keyboardType="numbers-and-punctuation" error={error} /><Button label={working ? 'Building your day…' : 'Build adaptive plan'} disabled={working} icon="sparkles" onPress={create} /><Button label="Not now" variant="ghost" onPress={() => setOpen(false)} /></Animated.View></Animated.View></Modal>
  </>;
}

const styles = StyleSheet.create({
  planCard: { backgroundColor: colors.surfaceElevated, gap: spacing.md }, planHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, planMark: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.md, height: 42, justifyContent: 'center', width: 42 }, flex: { flex: 1 }, edit: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 }, summary: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, dot: { backgroundColor: colors.textMuted, borderRadius: radius.pill, height: 3, width: 3 }, timeline: { gap: 0 }, planRow: { alignItems: 'stretch', flexDirection: 'row', gap: spacing.sm, minHeight: 66 }, time: { alignItems: 'center', paddingTop: 2, width: 42 }, line: { backgroundColor: colors.border, flex: 1, marginTop: spacing.xs, width: 1 }, lineLast: { backgroundColor: 'transparent' }, planCopy: { flex: 1, gap: 3, paddingBottom: spacing.md }, done: { opacity: 0.48 }, rowTop: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, risk: { backgroundColor: colors.warningMuted, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 3 }, riskUrgent: { backgroundColor: colors.dangerMuted }, riskWatchText: { color: colors.warning }, riskUrgentText: { color: colors.danger }, calendar: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 }, actions: { gap: spacing.xs }, prompt: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md }, promptIcon: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 }, overlay: { alignItems: 'center', backgroundColor: colors.overlay, flex: 1, justifyContent: 'flex-end' }, sheet: { alignSelf: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: 1, gap: spacing.md, maxHeight: '94%', maxWidth: 720, padding: spacing.lg, paddingBottom: spacing.xl, width: '100%' }, handle: { alignSelf: 'center', backgroundColor: colors.border, borderRadius: radius.pill, height: 4, width: 42 }, modalHeading: { gap: spacing.xs }, choices: { flexDirection: 'row', gap: spacing.xs }, choice: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 }, energyChoice: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flex: 1, gap: 3, justifyContent: 'center', minHeight: 58 }, choiceActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
});
