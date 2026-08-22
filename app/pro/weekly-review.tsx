import Ionicons from '@expo/vector-icons/Ionicons';
import { router as expoRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { Button, Card, ProgressBar, Screen, Text } from '@/components/ui';
import { useSubscription } from '@/hooks';
import { buildInsights } from '@/services/insights';
import { buildMaxPortfolio } from '@/services/max';
import { useAppStore } from '@/stores';
import { colors, radius, spacing } from '@/theme';

const router = expoRouter as unknown as { push: (href: string) => void };

export default function WeeklyReviewScreen() {
  const { isPro, isMax } = useSubscription();
  const { tasks, goals, milestones, focusSessions, checkIns, taskDependencies, calendarItems, weeklyReviews } = useAppStore();
  if (!isPro) return <Screen contentContainerStyle={styles.screen}><ScreenHeader title="Weekly Review" /><Card style={styles.locked}><View style={styles.lockIcon}><Ionicons name="lock-closed" color={colors.accent} size={24} /></View><Text variant="title">A clearer week starts here.</Text><Text color="secondary">Weekly AI Review is a DOIT Pro benefit.</Text><Button label="Explore DOIT Pro" icon="diamond" onPress={() => router.push('/pro')} /></Card></Screen>;

  const insights = buildInsights(tasks, goals, focusSessions, checkIns);
  const portfolio = buildMaxPortfolio(goals, tasks, milestones, focusSessions, taskDependencies, { calendarItems, weeklyReviews });
  const cutoff = Date.now() - 6 * 86400000;
  const wins = tasks.filter((task) => task.status === 'completed' && new Date(task.completedAt ?? `${task.scheduledDate}T12:00:00`).getTime() >= cutoff);

  return <Screen scrollable contentContainerStyle={styles.screen}>
    <ScreenHeader title="Weekly Review" />
    <View style={styles.heading}><Text variant="eyebrow" color="accent">DOIT PRO</Text><Text variant="title">Your week, decoded.</Text><Text color="secondary">A practical review based on what you completed—not guilt.</Text></View>
    <View style={styles.stats}><Card style={styles.stat}><Text variant="title" color="accent">{insights.completionRate}%</Text><Text variant="caption" color="muted">completion</Text></Card><Card style={styles.stat}><Text variant="title">{wins.length}</Text><Text variant="caption" color="muted">wins</Text></Card><Card style={styles.stat}><Text variant="title">{insights.focusMinutes}</Text><Text variant="caption" color="muted">focus min</Text></Card></View>
    <Card style={styles.card}><Text variant="eyebrow" color="accent">COACH READ</Text><Text variant="heading">{insights.coachHeadline}</Text><ProgressBar progress={insights.completionRate} height={9} /><Text>{insights.coachSummary}</Text></Card>
    <Card style={styles.card}><Text variant="heading">Wins</Text>{wins.length ? wins.slice(0, 5).map((task) => <View key={task.id} style={styles.row}><Ionicons name="checkmark-circle" color={colors.success} size={18} /><Text variant="caption" style={styles.flex}>{task.title}</Text></View>) : <Text color="secondary">Complete your first action and it will appear here.</Text>}</Card>
    <Card style={styles.card}><Text variant="heading">Patterns to fix</Text>{insights.blockers.length ? insights.blockers.slice(0, 3).map((blocker, index) => <View key={`${blocker}-${index}`} style={styles.row}><Ionicons name="alert-circle" color={colors.warning} size={18} /><Text variant="caption" color="secondary" style={styles.flex}>{blocker}</Text></View>) : <Text color="secondary">No blockers were recorded this week.</Text>}</Card>
    <Card style={styles.card}><Text variant="heading">Change next week</Text>{insights.nextWeekChanges.map((change) => <View key={change} style={styles.row}><Ionicons name="arrow-forward-circle" color={colors.accent} size={18} /><Text variant="caption" style={styles.flex}>{change}</Text></View>)}</Card>
    {isMax ? <>
      <View style={styles.heading}><Text variant="eyebrow" color="accent">MAX WEEKLY INTELLIGENCE</Text><Text variant="title">Your whole portfolio.</Text><Text color="secondary">Deadline pace, workload, consistency, and neglected goals analysed together.</Text></View>
      <View style={styles.stats}><Card style={styles.stat}><Text variant="title" color="accent">{portfolio.consistency}%</Text><Text variant="caption" color="muted">consistency</Text></Card><Card style={styles.stat}><Text variant="title">{portfolio.strongestDay.slice(0, 3)}</Text><Text variant="caption" color="muted">strongest day</Text></Card><Card style={styles.stat}><Text variant="title">{portfolio.overloadedDays.length}</Text><Text variant="caption" color="muted">overloaded days</Text></Card></View>
      <Card style={styles.card}><Text variant="heading">Deadline forecast</Text>{portfolio.forecasts.map((forecast) => { const milestone = portfolio.milestoneProgress.find((item) => item.goalId === forecast.goal.id); return <View key={forecast.goal.id} style={styles.forecast}><View style={styles.flex}><Text variant="label">{forecast.goal.title}</Text><Text variant="caption" color="muted">{forecast.progress}% complete{milestone?.total ? ` · ${milestone.completed}/${milestone.total} milestones` : ''}{forecast.goal.targetDate ? ` · due ${forecast.goal.targetDate}` : ''}{forecast.requiredWeeklyProgress ? ` · needs ${forecast.requiredWeeklyProgress} ${forecast.goal.unit}/week` : ''}</Text></View><Text variant="caption" color={forecast.status === 'behind' ? 'danger' : forecast.status === 'ahead' ? 'accent' : 'secondary'}>{forecast.status.replace('-', ' ')}</Text></View>; })}</Card>
      <Card style={styles.card}><Text variant="heading">Attention map</Text>{portfolio.neglectedGoals.length ? portfolio.neglectedGoals.map((goal) => <View key={goal.id} style={styles.row}><Ionicons name="eye-off-outline" color={colors.warning} size={18} /><Text variant="caption" style={styles.flex}>{goal.title} has had no completed action for more than seven days.</Text></View>) : <Text color="secondary">Every active goal received attention recently.</Text>}{portfolio.overloadedDays.map((day) => <View key={day.date} style={styles.row}><Ionicons name="calendar-outline" color={colors.warning} size={18} /><Text variant="caption" style={styles.flex}>{day.date}: {day.count} actions · {day.minutes} planned minutes</Text></View>)}</Card>
    </> : <Card style={styles.maxLocked}><Ionicons name="flash-outline" color={colors.accent} size={23} /><View style={styles.flex}><Text variant="label">MAX sees across every goal</Text><Text variant="caption" color="muted">Add deadline forecasting, overloaded-day detection, neglect warnings, and cross-goal recommendations.</Text></View><Button label="See MAX" variant="ghost" onPress={() => router.push('/pro?tier=max')} /></Card>}
  </Screen>;
}

const styles = StyleSheet.create({ screen: { gap: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.md }, heading: { gap: spacing.sm }, stats: { flexDirection: 'row', gap: spacing.sm }, stat: { alignItems: 'center', flex: 1, gap: spacing.xxs, paddingHorizontal: spacing.xs }, card: { gap: spacing.md }, row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, forecast: { alignItems: 'center', borderBottomColor: colors.borderSubtle, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm }, flex: { flex: 1 }, locked: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl }, lockIcon: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.pill, height: 52, justifyContent: 'center', width: 52 }, maxLocked: { alignItems: 'center', borderColor: colors.accentMuted, flexDirection: 'row', gap: spacing.sm } });
