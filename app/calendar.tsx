import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { timeBlockTask } from '@/services/calendar';
import { useAppStore } from '@/stores';
import { useSubscription } from '@/hooks';
import { buildMaxPortfolio } from '@/services/max';
import { colors, radius, spacing } from '@/theme';
import type { Task } from '@/types';
import { today } from '@/utils';

export default function CalendarScreen() {
  const { tasks, goals, milestones, focusSessions, taskDependencies, calendarItems, weeklyReviews } = useAppStore();
  const { isMax } = useSubscription();
  const [selected, setSelected] = useState<Task | null>(null);
  const [startTime, setStartTime] = useState('18:00');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState('');
  const upcoming = useMemo(() => tasks.filter((task) => task.status === 'pending' && task.scheduledDate >= today()).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)).slice(0, 20), [tasks]);
  const portfolio = useMemo(() => buildMaxPortfolio(goals, tasks, milestones, focusSessions, taskDependencies, { calendarItems, weeklyReviews }), [calendarItems, focusSessions, goals, milestones, taskDependencies, tasks, weeklyReviews]);

  const open = (task: Task) => { setSelected(task); setDuration(String(task.estimatedMinutes || 25)); setError(''); };
  const save = async () => {
    if (!selected || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) return setError('Use a 24-hour time such as 18:30.');
    const minutes = Number(duration);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 240) return setError('Choose between 5 and 240 minutes.');
    try { await timeBlockTask(selected, startTime, minutes); setSelected(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not open your calendar.'); }
  };

  return <>
    <Screen scrollable contentContainerStyle={styles.screen}>
      <ScreenHeader title="Time blocking" />
      <Card style={styles.intro}><View style={styles.icon}><Ionicons name="calendar" color={colors.accent} size={22} /></View><View style={styles.flex}><Text variant="heading">Protect time for the work.</Text><Text variant="caption" color="secondary">{Platform.OS === 'web' ? 'Choose an action and download an event that opens in your calendar.' : 'Choose an action, then Android opens your calendar so you can review and save the event.'}</Text></View></Card>
      {isMax ? <Card style={styles.maxPlan}><View style={styles.maxTop}><Ionicons name="flash" color={colors.accent} size={20} /><View style={styles.flex}><Text variant="eyebrow" color="accent">MAX CALENDAR-AWARE PLAN</Text><Text variant="heading">Workload before time blocks.</Text></View></View><Text variant="caption" color="secondary">{portfolio.overloadedDays.length ? `${portfolio.overloadedDays.length} overloaded day${portfolio.overloadedDays.length === 1 ? '' : 's'} detected. Review those before adding more blocks.` : 'No overloaded days detected from your scheduled DOIT actions.'}</Text>{portfolio.priorities.find((item) => !item.blocked) ? <Text variant="caption">Best next block: {portfolio.priorities.find((item) => !item.blocked)!.task.title} · {portfolio.priorities.find((item) => !item.blocked)!.task.estimatedMinutes || 25} min</Text> : null}</Card> : <Pressable onPress={() => router.push('/pro?tier=max')}><Card style={styles.maxLocked}><Ionicons name="lock-closed-outline" color={colors.accent} size={19} /><View style={styles.flex}><Text variant="label">Calendar-aware planning · MAX</Text><Text variant="caption" color="muted">Detect overload and block the strongest action across every goal.</Text></View></Card></Pressable>}
      <View style={styles.heading}><Text variant="eyebrow" color="accent">UPCOMING ACTIONS</Text><Text variant="title">Put it on the calendar</Text></View>
      {upcoming.length ? upcoming.map((task) => <Card key={task.id} style={styles.task}><View style={styles.taskTop}><View style={styles.flex}><Text variant="heading">{task.title}</Text><Text variant="caption" color="muted">{goals.find((goal) => goal.id === task.goalId)?.title ?? 'DOIT action'} · {task.scheduledDate} · {task.estimatedMinutes} min</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Time block ${task.title}`} onPress={() => open(task)} style={styles.add}><Ionicons name="calendar-outline" color={colors.onAccent} size={19} /></Pressable></View></Card>) : <Card><Text variant="heading">No actions waiting.</Text><Text color="secondary">Your next generated action will appear here.</Text></Card>}
    </Screen>
    <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
      <View style={styles.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} /><View style={styles.sheet}><View style={styles.grabber} /><Text variant="eyebrow" color="accent">NEW TIME BLOCK</Text><Text variant="title">{selected?.title}</Text><Text color="secondary">Scheduled for {selected?.scheduledDate}. You can change the final date inside your calendar.</Text><Input label="Start time" value={startTime} onChangeText={setStartTime} placeholder="18:00" keyboardType="numbers-and-punctuation" /><Input label="Duration (minutes)" value={duration} onChangeText={setDuration} placeholder="25" keyboardType="numeric" error={error} /><Button label={Platform.OS === 'web' ? 'Download calendar event' : 'Review in calendar'} icon="calendar" onPress={save} /><Button label="Cancel" variant="ghost" onPress={() => setSelected(null)} /></View></View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({ screen: { gap: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.md }, intro: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, icon: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.md, height: 48, justifyContent: 'center', width: 48 }, flex: { flex: 1 }, maxPlan: { borderColor: colors.accent, gap: spacing.sm }, maxTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, maxLocked: { alignItems: 'center', borderColor: colors.accentMuted, flexDirection: 'row', gap: spacing.sm }, heading: { gap: spacing.xs }, task: { gap: spacing.sm }, taskTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, add: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 }, overlay: { flex: 1, justifyContent: 'flex-end' }, sheet: { backgroundColor: colors.surface, borderColor: colors.border, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: 1, gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl }, grabber: { alignSelf: 'center', backgroundColor: colors.border, borderRadius: 2, height: 4, width: 42 },
});
