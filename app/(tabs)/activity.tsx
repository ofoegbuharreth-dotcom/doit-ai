import Ionicons from '@expo/vector-icons/Ionicons';
import { router as expoRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, ProgressBar, Screen, SectionHeader, Text } from '@/components/ui';
import { useSubscription } from '@/hooks';
import { buildInsights } from '@/services/insights';
import { buildMaxPortfolio } from '@/services/max';
import { useAppStore } from '@/stores';
import { colors, radius, spacing } from '@/theme';

const iconMap = { task_completed: 'checkmark', milestone_reached: 'flag', plan_adjusted: 'sparkles', goal_created: 'add', task_skipped: 'play-skip-forward', task_moved: 'calendar', check_in: 'moon', progress_logged: 'trending-up' } as const;
const router = expoRouter as unknown as { push: (href: string) => void };

export default function InsightsScreen() {
  const store = useAppStore();
  const { tasks, goals, focusSessions, checkIns, activity, milestones, taskDependencies, calendarItems, weeklyReviews } = store;
  const { isPro, isMax } = useSubscription();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const insights = useMemo(() => buildInsights(tasks, goals, focusSessions, checkIns), [checkIns, focusSessions, goals, tasks]);
  const portfolio = useMemo(() => buildMaxPortfolio(goals, tasks, milestones, focusSessions, taskDependencies, { calendarItems, weeklyReviews }), [calendarItems, focusSessions, goals, milestones, taskDependencies, tasks, weeklyReviews]);
  const maxBar = Math.max(1, ...insights.days.map((day) => day.minutes || day.completed * 10));
  const visibleActivity = isPro ? activity : activity.filter((item) => new Date(item.createdAt).getTime() >= Date.now() - 7 * 86400000);
  const hidden = activity.length - visibleActivity.length;
  const changeLabel = insights.previousCompletionRate === 0
    ? 'First measured week'
    : `${insights.completionChange >= 0 ? '+' : ''}${insights.completionChange}% vs last week`;

  return <Screen scrollable contentContainerStyle={styles.screen}>
    <View style={styles.header}>
      <Text variant="eyebrow" color="accent">DOIT INSIGHTS</Text>
      <Text variant="title">Your momentum.</Text>
      <Text color="secondary">See what is working, then make the next week easier.</Text>
    </View>

    <View style={styles.stats}>
      <Card style={styles.stat}><Text variant="heading" color="accent">{insights.focusMinutes}</Text><Text variant="caption" color="muted">focus min</Text></Card>
      <Card style={styles.stat}><Text variant="heading">{insights.completedCount}</Text><Text variant="caption" color="muted">completed</Text></Card>
      <Card style={styles.stat}><View style={styles.streak}><Ionicons name="flame" color={colors.warning} size={18} /><Text variant="heading">{insights.streak}</Text></View><Text variant="caption" color="muted">day streak</Text></Card>
    </View>

    <Card style={styles.execution}>
      <View style={styles.cardTop}><View style={styles.cardTitle}><Text variant="eyebrow" color="accent">LAST 7 DAYS</Text><Text variant="heading">{insights.completionRate}% execution</Text></View><Text variant="caption" color={insights.completionChange >= 0 ? 'accent' : 'secondary'}>{changeLabel}</Text></View>
      <ProgressBar progress={insights.completionRate} height={9} />
      <Text variant="caption" color="secondary">{insights.completedCount} of {insights.plannedCount} planned actions completed</Text>
      <View style={styles.chart}>
        {insights.days.map((day) => {
          const value = day.minutes || day.completed * 10;
          const height = value ? Math.max(8, (value / maxBar) * 82) : 4;
          return <View key={day.date} style={styles.day}><View style={styles.barSlot}><View style={[styles.bar, { height }, day.date === insights.days.at(-1)?.date && styles.barToday]} /></View><Text variant="caption" color="muted">{day.label}</Text></View>;
        })}
      </View>
      <View style={styles.todayLine}><Ionicons name="timer-outline" color={colors.accent} size={18} /><Text variant="caption" color="secondary">Today: {insights.todayFocusMinutes} focused minute{insights.todayFocusMinutes === 1 ? '' : 's'}</Text></View>
    </Card>

    {isMax ? <Card style={styles.maxCard}>
      <View style={styles.coachTop}><View style={styles.maxIcon}><Ionicons name="flash" color={colors.onAccent} size={21} /></View><View style={styles.flex}><Text variant="eyebrow" color="accent">MAX PORTFOLIO INTELLIGENCE</Text><Text variant="heading">Every goal. One priority system.</Text></View></View>
      {portfolio.priorities.filter((item) => !item.blocked).slice(0, 3).map((item, index) => <View key={item.task.id} style={styles.priorityRow}><View style={styles.rank}><Text variant="label" color="accent">{index + 1}</Text></View><View style={styles.flex}><Text variant="label">{item.task.title}</Text><Text variant="caption" color="muted">{item.goal?.title ?? 'General'} · {item.task.estimatedMinutes || 25} min · {item.reasons.join(' · ')}</Text></View></View>)}
      <View style={styles.maxStats}><View style={styles.maxStat}><Text variant="heading">{portfolio.consistency}%</Text><Text variant="caption" color="muted">consistency</Text></View><View style={styles.maxStat}><Text variant="heading">{portfolio.forecasts.filter((item) => item.status === 'behind').length}</Text><Text variant="caption" color="muted">goals behind</Text></View><View style={styles.maxStat}><Text variant="heading">{portfolio.overloadedDays.length}</Text><Text variant="caption" color="muted">overloaded days</Text></View></View>
      {portfolio.suggestions.filter((item) => !dismissed.includes(item.id)).map((suggestion) => <View key={suggestion.id} style={styles.rebuild}><View style={styles.flex}><Text variant="label">{suggestion.title}</Text><Text variant="caption" color="secondary">{suggestion.reason}</Text><Text variant="caption" color="muted">{suggestion.impact}</Text></View><View style={styles.rebuildActions}><Pressable onPress={() => setDismissed((items) => [...items, suggestion.id])}><Text variant="caption" color="muted">Reject</Text></Pressable><Pressable onPress={async () => { const result = await store.applyAgentActions([{ type: 'ADJUST_PLAN', reason: suggestion.reason, taskChanges: [{ taskId: suggestion.taskId, ...suggestion.changes }] }]); if (!result.error) setDismissed((items) => [...items, suggestion.id]); }}><Text variant="label" color="accent">Accept</Text></Pressable></View></View>)}
    </Card> : isPro ? <Pressable onPress={() => router.push('/pro?tier=max')}><Card style={styles.maxLocked}><Ionicons name="flash-outline" color={colors.accent} size={22} /><View style={styles.flex}><Text variant="label">Unlock cross-goal intelligence</Text><Text variant="caption" color="muted">MAX ranks every active goal, forecasts deadlines, and proposes reviewable rebuilds.</Text></View><Ionicons name="chevron-forward" color={colors.accent} size={18} /></Card></Pressable> : null}

    {isPro ? <>
      <Card style={styles.coachCard}>
        <View style={styles.coachTop}><View style={styles.coachIcon}><Ionicons name="sparkles" color={colors.onAccent} size={21} /></View><View style={styles.flex}><Text variant="eyebrow" color="accent">WEEKLY COACH READ</Text><Text variant="heading">{insights.coachHeadline}</Text></View></View>
        <Text color="secondary">{insights.coachSummary}</Text>
        <View style={styles.changeList}>{insights.nextWeekChanges.map((change, index) => <View key={change} style={styles.change}><View style={styles.number}><Text variant="caption" color="accent">{index + 1}</Text></View><Text variant="caption" style={styles.flex}>{change}</Text></View>)}</View>
        <Button label="Open full weekly review" variant="secondary" icon="analytics" onPress={() => router.push('/pro/weekly-review')} />
      </Card>

      <SectionHeader eyebrow="YOUR PATTERNS" title="Work with yourself" />
      <View style={styles.patterns}>
        <Card style={styles.pattern}><Ionicons name="sunny-outline" color={colors.accent} size={22} /><Text variant="label">Best focus window</Text><Text variant="caption" color="secondary">{insights.bestTimeLabel}</Text></Card>
        <Card style={styles.pattern}><Ionicons name="trophy-outline" color={colors.warning} size={22} /><Text variant="label">Personal best</Text><Text variant="caption" color="secondary">{insights.personalBestMinutes} min in one day</Text></Card>
      </View>

      {insights.goalStats.length ? <><SectionHeader title="Goals this week" detail={`${insights.goalStats.length} active`} /><View style={styles.goalList}>{insights.goalStats.map((goal) => <Pressable key={goal.id} onPress={() => router.push(`/goal/${goal.id}`)}><Card style={styles.goalCard}><View style={styles.goalTop}><Text variant="label" style={styles.flex} numberOfLines={1}>{goal.title}</Text><Text variant="label" color="accent">{goal.progress}%</Text></View><ProgressBar progress={goal.progress} /><Text variant="caption" color="muted">{goal.completed} of {goal.total} weekly actions complete</Text></Card></Pressable>)}</View></> : null}
    </> : <Card style={styles.proCard}>
      <View style={styles.proTop}><View style={styles.lock}><Ionicons name="diamond" color={colors.accent} size={21} /></View><View style={styles.flex}><Text variant="eyebrow" color="accent">DOIT PRO INSIGHTS</Text><Text variant="heading">Understand your patterns.</Text></View></View>
      <Text color="secondary">Unlock your best focus time, personal records, goal breakdowns, and a weekly Coach plan based on what actually happened.</Text>
      <View style={styles.previewRows}><LockedRow label="Best focus window" /><LockedRow label="Weekly Coach recommendations" /><LockedRow label="Goal-by-goal execution" /></View>
      <Button label="Explore DOIT Pro" icon="diamond" onPress={() => router.push('/pro')} />
    </Card>}

    <SectionHeader eyebrow="RECENT" title="Activity timeline" />
    {visibleActivity.length ? <View>{visibleActivity.map((item, index) => <View key={item.id} style={styles.event}><View style={styles.track}><View style={styles.dot}><Ionicons name={iconMap[item.type]} size={16} color={colors.accent} /></View>{index < visibleActivity.length - 1 ? <View style={styles.line} /> : null}</View><View style={styles.copy}><Text variant="label">{item.title}</Text>{item.detail ? <Text variant="caption" color="muted">{item.detail}</Text> : null}<Text variant="caption" color="muted">{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(item.createdAt))}</Text></View></View>)}</View> : <Card style={styles.empty}><Ionicons name="pulse" color={colors.accent} size={24} /><Text variant="heading">Your momentum starts here.</Text><Text color="secondary">Complete an action or create a goal and it will appear here.</Text></Card>}
    {!isPro && hidden ? <Text variant="caption" color="muted" style={styles.hidden}>{hidden} older {hidden === 1 ? 'event' : 'events'} included with Pro</Text> : null}
  </Screen>;
}

function LockedRow({ label }: { label: string }) {
  return <View style={styles.lockedRow}><Ionicons name="lock-closed" size={15} color={colors.textMuted} /><Text variant="caption" color="secondary">{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.lg }, header: { gap: spacing.xs },
  stats: { flexDirection: 'row', gap: spacing.sm }, stat: { alignItems: 'center', flex: 1, gap: spacing.xxs, justifyContent: 'center', minHeight: 96, paddingHorizontal: spacing.xs }, streak: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxs },
  execution: { gap: spacing.md }, cardTop: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }, cardTitle: { flex: 1, gap: spacing.xxs }, chart: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.xs, height: 118, justifyContent: 'space-between', paddingTop: spacing.sm }, day: { alignItems: 'center', flex: 1, gap: spacing.xs }, barSlot: { alignItems: 'center', height: 84, justifyContent: 'flex-end', width: '100%' }, bar: { backgroundColor: colors.surfacePressed, borderRadius: radius.pill, maxWidth: 26, width: '64%' }, barToday: { backgroundColor: colors.accent }, todayLine: { alignItems: 'center', borderTopColor: colors.borderSubtle, borderTopWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md },
  coachCard: { backgroundColor: colors.accentMuted, borderColor: colors.accent, gap: spacing.md }, coachTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, coachIcon: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 }, changeList: { gap: spacing.sm }, change: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, number: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, height: 26, justifyContent: 'center', width: 26 }, flex: { flex: 1 },
  patterns: { flexDirection: 'row', gap: spacing.sm }, pattern: { flex: 1, gap: spacing.sm, minHeight: 126 }, goalList: { gap: spacing.sm }, goalCard: { gap: spacing.sm }, goalTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  proCard: { gap: spacing.md }, proTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, lock: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 }, previewRows: { gap: spacing.xs }, lockedRow: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  event: { flexDirection: 'row', minHeight: 92 }, track: { alignItems: 'center', marginRight: spacing.md, width: 38 }, dot: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: 19, height: 38, justifyContent: 'center', width: 38 }, line: { backgroundColor: colors.border, flex: 1, width: 1 }, copy: { flex: 1, gap: spacing.xxs, paddingBottom: spacing.lg, paddingTop: spacing.xs }, empty: { gap: spacing.sm }, hidden: { textAlign: 'center' },
  maxCard: { borderColor: colors.accent, gap: spacing.md }, maxIcon: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 }, priorityRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, rank: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.pill, height: 30, justifyContent: 'center', width: 30 }, maxStats: { flexDirection: 'row', gap: spacing.xs }, maxStat: { backgroundColor: colors.surfaceElevated, borderRadius: radius.md, flex: 1, gap: 2, padding: spacing.sm }, rebuild: { borderTopColor: colors.borderSubtle, borderTopWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md }, rebuildActions: { alignItems: 'flex-end', gap: spacing.sm, justifyContent: 'center' }, maxLocked: { alignItems: 'center', borderColor: colors.accentMuted, flexDirection: 'row', gap: spacing.md },
});
