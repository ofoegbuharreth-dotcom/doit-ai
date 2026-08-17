import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { motion, staggeredFadeIn } from '@/animations';
import { Card, PressableScale, ProgressBar, Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { Goal, Milestone, Task } from '@/types';
import type { GoalHealth } from '@/services';
import { formatShortDate, goalProgress } from '@/utils';

export function GoalCard({ goal, milestones, tasks, health, index = 0 }: { goal: Goal; milestones: Milestone[]; tasks: Task[]; health?: GoalHealth; index?: number }) {
  const progress = goalProgress(goal);
  const next = milestones.sort((a, b) => a.sortOrder - b.sortOrder).find((item) => item.status !== 'completed');
  return (
    <Animated.View entering={staggeredFadeIn(index)}>
      <PressableScale accessibilityRole="button" pressedScale={motion.scale.cardPressed} onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } })}>
        <Card style={styles.card}>
          <View style={styles.top}><Text variant="heading" style={styles.title}>{goal.title}</Text><Ionicons name="arrow-up" style={styles.arrow} size={20} color={colors.textSecondary} /></View>
          <View style={styles.value}><Text variant="title">{formatValue(goal.currentValue, goal.unit)}</Text><Text variant="body" color="muted"> / {formatValue(goal.targetValue, goal.unit)}</Text></View>
          <ProgressBar progress={progress} />
          <View style={styles.meta}><Text variant="caption" color="accent">{progress}%</Text><Text variant="caption" color="muted">{tasks.length} today{goal.targetDate ? ` · ${formatShortDate(goal.targetDate)}` : ''}</Text></View>
          {health && health.level !== 'healthy' ? <View style={[styles.health, health.level === 'at-risk' ? styles.healthRisk : styles.healthWatch]}><Ionicons name={health.level === 'at-risk' ? 'warning' : 'pulse'} color={health.level === 'at-risk' ? colors.danger : colors.warning} size={17} /><View style={styles.healthCopy}><Text variant="label" color={health.level === 'at-risk' ? 'danger' : 'secondary'}>{health.title}</Text><Text variant="caption" color="muted">{health.message}</Text></View></View> : null}
          {next ? <View style={styles.next}><Text variant="eyebrow" color="muted">NEXT MILESTONE</Text><Text variant="label">{next.title}</Text></View> : null}
        </Card>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing.md }, top: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm }, title: { flex: 1 }, arrow: { transform: [{ rotate: '45deg' }] }, value: { alignItems: 'baseline', flexDirection: 'row' }, meta: { flexDirection: 'row', justifyContent: 'space-between' }, health: { alignItems: 'flex-start', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm }, healthWatch: { backgroundColor: colors.warningMuted, borderColor: colors.warning }, healthRisk: { backgroundColor: colors.dangerMuted, borderColor: colors.danger }, healthCopy: { flex: 1, gap: spacing.xxs }, next: { borderTopColor: colors.borderSubtle, borderTopWidth: 1, gap: spacing.xs, paddingTop: spacing.md } });
const formatValue = (value: number, unit: string) => unit === '%' ? `${value}%` : `${unit}${value}`;
