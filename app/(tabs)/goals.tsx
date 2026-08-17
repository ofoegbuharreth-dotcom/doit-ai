import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { NewGoalButton } from './_layout';
import { GoalCard } from '@/components/goals/GoalCard';
import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { getGoalHealth } from '@/services';
import { useAppStore } from '@/stores';
import { colors, radius, spacing } from '@/theme';
import type { GoalStatus } from '@/types';

type Filter = 'all' | GoalStatus | 'attention';
const filters: { id: Filter; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'attention', label: 'Needs Attention' }, { id: 'paused', label: 'Paused' }, { id: 'completed', label: 'Completed' }];

export default function GoalsScreen() {
  const { goals, milestones, tasks, progressEntries, syncing, syncError, refreshWorkspace } = useAppStore();
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState<Filter>('all');
  const healthByGoal = useMemo(() => new Map(goals.map((goal) => [goal.id, getGoalHealth(goal, tasks, progressEntries)])), [goals, progressEntries, tasks]);
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return goals.filter((goal) => {
      const matchesSearch = !search || `${goal.title} ${goal.description} ${goal.unit}`.toLowerCase().includes(search);
      const health = healthByGoal.get(goal.id);
      const matchesFilter = filter === 'all' || filter === 'attention' ? filter === 'all' || health?.level !== 'healthy' : goal.status === filter;
      return matchesSearch && matchesFilter;
    }).sort((a, b) => {
      const rank = { 'at-risk': 0, watch: 1, healthy: 2 } as const;
      return rank[healthByGoal.get(a.id)?.level ?? 'healthy'] - rank[healthByGoal.get(b.id)?.level ?? 'healthy'] || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [filter, goals, healthByGoal, query]);
  const attention = [...healthByGoal.values()].filter((health) => health.level !== 'healthy').length;

  return <><Screen scrollable refreshing={syncing} onRefresh={refreshWorkspace} contentContainerStyle={styles.screen}>
    <View style={styles.header}><Text variant="eyebrow" color="accent">YOUR DIRECTION</Text><Text variant="title">Goals</Text><Text color="secondary">Search every outcome and surface plans that need attention.</Text></View>
    <View style={styles.search}><Ionicons name="search" color={colors.textMuted} size={20} /><View style={styles.flex}><Input style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search goals, outcomes, or units" returnKeyType="search" /></View>{query ? <Pressable hitSlop={10} onPress={() => setQuery('')}><Ionicons name="close-circle" color={colors.textMuted} size={20} /></Pressable> : null}</View>
    <View style={styles.filters}>{filters.map((item) => <Pressable key={item.id} onPress={() => setFilter(item.id)} style={[styles.filter, filter === item.id && styles.filterActive]}><Text variant="caption" color={filter === item.id ? 'accent' : 'secondary'}>{item.id === 'attention' ? `${item.label}: ${attention}` : item.label}</Text></Pressable>)}</View>
    {syncing && !goals.length ? <Card style={styles.empty}><Text variant="heading">Loading your goals…</Text><Text color="secondary">Pulling your latest plan from DOIT.</Text></Card> : null}
    {syncError ? <Card style={styles.error}><Text variant="label" color="danger">Your goals couldn’t load</Text><Text variant="caption" color="secondary">{syncError}</Text><Button label="Try again" variant="secondary" onPress={refreshWorkspace} /></Card> : null}
    {visible.length ? <View style={styles.list}>{visible.map((goal, index) => <GoalCard key={goal.id} goal={goal} health={healthByGoal.get(goal.id)} milestones={milestones.filter((item) => item.goalId === goal.id)} tasks={tasks.filter((task) => task.goalId === goal.id && task.status === 'pending')} index={index} />)}</View> : !syncing && !syncError ? <Card style={styles.empty}><Text variant="heading">{goals.length ? 'No goals match that view.' : 'Nothing to chase yet.'}</Text><Text color="secondary">{goals.length ? 'Try another search or choose All.' : 'Tell DOIT what you want to accomplish.'}</Text>{goals.length ? <Button label="Clear search and filters" variant="secondary" onPress={() => { setQuery(''); setFilter('all'); }} /> : <Button label="Create your first goal" onPress={() => router.push('/create-goal')} />}</Card> : null}
    <View style={styles.bottom} />
  </Screen><NewGoalButton /></>;
}

const styles = StyleSheet.create({ screen: { gap: spacing.lg, paddingTop: spacing.lg }, header: { gap: spacing.xs }, search: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 54, paddingHorizontal: spacing.sm }, searchInput: { backgroundColor: colors.transparent, borderWidth: 0, minHeight: 50, paddingHorizontal: 0 }, flex: { flex: 1 }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, filter: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, minHeight: 38, justifyContent: 'center', paddingHorizontal: spacing.sm }, filterActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent }, list: { gap: spacing.md }, empty: { gap: spacing.md }, error: { gap: spacing.sm }, bottom: { height: 84 } });
