import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeOutUp, LinearTransition } from 'react-native-reanimated';

import { Card, Pill, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { Goal, Task, TaskStatus } from '@/types';

export function TaskCard({ task, goal, onAction }: { task: Task; goal?: Goal; onAction: (status: TaskStatus) => void }) {
  const act = (status: TaskStatus) => { Haptics.selectionAsync().catch(() => undefined); onAction(status); };
  return (
    <Animated.View layout={LinearTransition.springify()} exiting={FadeOutUp}>
      <Card style={[styles.card, task.status === 'completed' && styles.completed]}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.status === 'completed' }} onPress={() => act(task.status === 'completed' ? 'pending' : 'completed')} style={[styles.check, task.status === 'completed' && styles.checkDone]}>
          {task.status === 'completed' ? <Ionicons name="checkmark" size={17} color={colors.onAccent} /> : null}
        </Pressable>
        <View style={styles.content}>
          <Text variant="label" style={task.status === 'completed' ? styles.strike : undefined}>{task.title}</Text>
          {task.description ? <Text variant="caption" color="secondary">{task.description}</Text> : null}
          <Text variant="caption" color="muted">{goal?.title ?? 'Goal'} · {task.estimatedMinutes} min</Text>
          {task.status === 'pending' ? <View style={styles.actions}><Pill>{task.priority}</Pill><Pressable hitSlop={10} onPress={() => act('skipped')}><Text variant="caption" color="muted">Skip</Text></Pressable><Pressable hitSlop={10} onPress={() => act('moved')}><Text variant="caption" color="secondary">Tomorrow</Text></Pressable></View> : null}
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing.md }, completed: { opacity: 0.56 },
  check: { alignItems: 'center', borderColor: colors.textMuted, borderRadius: radius.pill, borderWidth: 1.5, height: 26, justifyContent: 'center', width: 26 },
  checkDone: { backgroundColor: colors.accent, borderColor: colors.accent }, content: { flex: 1, gap: spacing.xs }, strike: { textDecorationLine: 'line-through' },
  actions: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxs },
});
