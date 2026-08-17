import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { Milestone } from '@/types';
import { formatShortDate } from '@/utils';

export function MilestoneTimeline({ milestones }: { milestones: Milestone[] }) {
  return <View>{milestones.sort((a, b) => a.sortOrder - b.sortOrder).map((item, index) => {
    const done = item.status === 'completed'; const current = item.status === 'current';
    return <View key={item.id} style={styles.row}><View style={styles.track}><View style={[styles.dot, (done || current) && styles.dotActive]}>{done ? <Ionicons name="checkmark" size={13} color={colors.onAccent} /> : null}</View>{index < milestones.length - 1 ? <View style={[styles.line, done && styles.lineDone]} /> : null}</View><View style={styles.copy}><View style={styles.titleRow}><Text variant="label" color={done ? 'secondary' : 'primary'} style={styles.title}>{item.title}</Text><Text variant="caption" color={current ? 'accent' : 'muted'}>{item.dueDate ? formatShortDate(item.dueDate) : `Week ${index + 1}`}</Text></View><Text variant="caption" color="muted">{item.description}</Text></View></View>;
  })}</View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', minHeight: 76 }, track: { alignItems: 'center', marginRight: spacing.md, width: 24 }, dot: { alignItems: 'center', borderColor: colors.textMuted, borderRadius: 12, borderWidth: 1.5, height: 24, justifyContent: 'center', width: 24 }, dotActive: { backgroundColor: colors.accent, borderColor: colors.accent }, line: { backgroundColor: colors.border, flex: 1, width: 1 }, lineDone: { backgroundColor: colors.accent }, copy: { flex: 1, gap: spacing.xxs, paddingBottom: spacing.md }, titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, title: { flex: 1 } });
