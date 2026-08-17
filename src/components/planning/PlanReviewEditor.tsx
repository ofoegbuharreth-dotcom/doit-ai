import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Input, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { GoalPlanResponse } from '@/types';

type Intensity = 'light' | 'balanced' | 'ambitious';
const intensityFactor: Record<Intensity, number> = { light: 0.65, balanced: 1, ambitious: 1.35 };

export function PlanReviewEditor({ plan, onChange }: { plan: GoalPlanResponse; onChange: (plan: GoalPlanResponse) => void }) {
  const [open, setOpen] = useState(false);
  const [intensity, setIntensity] = useState<Intensity>('balanced');

  const updateGoal = (key: keyof GoalPlanResponse['goal'], value: string) => {
    const parsed = key === 'targetValue' ? Math.max(1, Number(value) || 1) : value;
    onChange({ ...plan, goal: { ...plan.goal, [key]: parsed } });
  };
  const changeIntensity = (next: Intensity) => {
    const ratio = intensityFactor[next] / intensityFactor[intensity];
    onChange({ ...plan, todayTasks: plan.todayTasks.map((task) => ({ ...task, estimatedMinutes: Math.max(5, Math.round(task.estimatedMinutes * ratio / 5) * 5) })) });
    setIntensity(next);
  };
  const updateMilestone = (index: number, key: 'title' | 'description' | 'targetValue', value: string) => onChange({ ...plan, milestones: plan.milestones.map((item, itemIndex) => itemIndex !== index ? item : { ...item, [key]: key === 'targetValue' ? Math.max(1, Number(value) || 1) : value }) });
  const updateTask = (index: number, key: 'title' | 'description' | 'estimatedMinutes', value: string) => onChange({ ...plan, todayTasks: plan.todayTasks.map((item, itemIndex) => itemIndex !== index ? item : { ...item, [key]: key === 'estimatedMinutes' ? Math.max(5, Number(value) || 5) : value }) });
  const move = <T,>(items: T[], from: number, direction: -1 | 1) => { const to = from + direction; if (to < 0 || to >= items.length) return items; const result = [...items]; [result[from], result[to]] = [result[to]!, result[from]!]; return result; };

  return <Card style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((value) => !value)} style={styles.header}>
      <View style={styles.icon}><Ionicons name="options-outline" color={colors.accent} size={21} /></View>
      <View style={styles.flex}><Text variant="label">Review and personalise</Text><Text variant="caption" color="muted">Edit the outcome, milestones, actions, and workload before starting.</Text></View>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} color={colors.textSecondary} size={20} />
    </Pressable>
    {open ? <View style={styles.editor}>
      <View style={styles.section}><Text variant="eyebrow" color="accent">PLAN INTENSITY</Text><View style={styles.segment}>{(['light', 'balanced', 'ambitious'] as Intensity[]).map((option) => <Pressable key={option} onPress={() => changeIntensity(option)} style={[styles.segmentButton, intensity === option && styles.segmentActive]}><Text variant="caption" color={intensity === option ? 'accent' : 'secondary'}>{option[0]!.toUpperCase() + option.slice(1)}</Text></Pressable>)}</View><Text variant="caption" color="muted">Changes the time required for each starting action.</Text></View>
      <View style={styles.section}><Text variant="eyebrow" color="accent">OUTCOME AND MEASURE</Text><Input label="Goal title" value={plan.goal.title} onChangeText={(value) => updateGoal('title', value)} /><Input label="What success means" multiline value={plan.goal.description} onChangeText={(value) => updateGoal('description', value)} /><View style={styles.measure}><View style={styles.flex}><Input label="Target" keyboardType="decimal-pad" value={String(plan.goal.targetValue)} onChangeText={(value) => updateGoal('targetValue', value)} /></View><View style={styles.flex}><Input label="Progress unit" value={plan.goal.unit} onChangeText={(value) => updateGoal('unit', value)} /></View></View></View>
      <View style={styles.section}><Text variant="eyebrow" color="accent">MILESTONES</Text>{plan.milestones.map((item, index) => <View key={`milestone-${index}`} style={styles.item}><View style={styles.itemTop}><Text variant="label">Milestone {index + 1}</Text><RowActions index={index} count={plan.milestones.length} onMove={(direction) => onChange({ ...plan, milestones: move(plan.milestones, index, direction) })} onDelete={() => plan.milestones.length > 1 && onChange({ ...plan, milestones: plan.milestones.filter((_, itemIndex) => itemIndex !== index) })} /></View><Input label="Name" value={item.title} onChangeText={(value) => updateMilestone(index, 'title', value)} /><Input label="Done when" multiline value={item.description} onChangeText={(value) => updateMilestone(index, 'description', value)} /><Input label={`Target in ${plan.goal.unit}`} keyboardType="decimal-pad" value={String(item.targetValue)} onChangeText={(value) => updateMilestone(index, 'targetValue', value)} /></View>)}<Button label="Add milestone" variant="secondary" icon="add" onPress={() => onChange({ ...plan, milestones: [...plan.milestones, { title: 'New milestone', description: 'Describe exactly what proves this milestone is finished.', targetValue: plan.goal.targetValue }] })} /></View>
      <View style={styles.section}><Text variant="eyebrow" color="accent">STARTING ACTIONS</Text>{plan.todayTasks.map((item, index) => <View key={`task-${index}`} style={styles.item}><View style={styles.itemTop}><Text variant="label">Action {index + 1}</Text><RowActions index={index} count={plan.todayTasks.length} onMove={(direction) => onChange({ ...plan, todayTasks: move(plan.todayTasks, index, direction) })} onDelete={() => plan.todayTasks.length > 1 && onChange({ ...plan, todayTasks: plan.todayTasks.filter((_, itemIndex) => itemIndex !== index) })} /></View><Input label="Action" value={item.title} onChangeText={(value) => updateTask(index, 'title', value)} /><Input label="Exact instructions / done condition" multiline value={item.description} onChangeText={(value) => updateTask(index, 'description', value)} /><Input label="Minutes" keyboardType="number-pad" value={String(item.estimatedMinutes)} onChangeText={(value) => updateTask(index, 'estimatedMinutes', value)} /><Button label="Replace with a smaller action" variant="ghost" icon="refresh" onPress={() => onChange({ ...plan, todayTasks: plan.todayTasks.map((task, taskIndex) => taskIndex !== index ? task : { ...task, title: `Start smaller: ${task.title}`, description: `Complete only the first visible part of this action: ${task.description} Stop after you have evidence that the first part is done.`, estimatedMinutes: Math.max(5, Math.round(task.estimatedMinutes * 0.5 / 5) * 5) }) })} /></View>)}<Button label="Add starting action" variant="secondary" icon="add" onPress={() => onChange({ ...plan, todayTasks: [...plan.todayTasks, { title: 'New action', description: 'Describe the exact steps and what counts as done.', estimatedMinutes: 20, priority: 'medium' }] })} /></View>
    </View> : null}
  </Card>;
}

function RowActions({ index, count, onMove, onDelete }: { index: number; count: number; onMove: (direction: -1 | 1) => void; onDelete: () => void }) {
  return <View style={styles.rowActions}><Pressable disabled={index === 0} onPress={() => onMove(-1)} style={[styles.smallAction, index === 0 && styles.disabled]}><Ionicons name="arrow-up" color={colors.textSecondary} size={17} /></Pressable><Pressable disabled={index === count - 1} onPress={() => onMove(1)} style={[styles.smallAction, index === count - 1 && styles.disabled]}><Ionicons name="arrow-down" color={colors.textSecondary} size={17} /></Pressable><Pressable disabled={count === 1} onPress={onDelete} style={[styles.smallAction, count === 1 && styles.disabled]}><Ionicons name="trash-outline" color={colors.danger} size={17} /></Pressable></View>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.md }, header: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, icon: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.md, height: 42, justifyContent: 'center', width: 42 }, flex: { flex: 1 }, editor: { borderTopColor: colors.borderSubtle, borderTopWidth: 1, gap: spacing.xl, paddingTop: spacing.md }, section: { gap: spacing.md }, segment: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', padding: 3 }, segmentButton: { alignItems: 'center', borderRadius: radius.sm, flex: 1, minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.xs }, segmentActive: { backgroundColor: colors.accentMuted, borderColor: colors.accentBorder, borderWidth: 1 }, measure: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, item: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, padding: spacing.sm }, itemTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, rowActions: { flexDirection: 'row', gap: spacing.xs }, smallAction: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 }, disabled: { opacity: 0.3 },
});
