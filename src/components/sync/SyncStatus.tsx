import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useAppStore } from '@/stores';
import { colors, radius, spacing } from '@/theme';

const presentation = {
  synced: { icon: 'cloud-done-outline', label: 'Synced', color: colors.success },
  syncing: { icon: 'sync-outline', label: 'Syncing…', color: colors.textSecondary },
  saving: { icon: 'cloud-upload-outline', label: 'Saving…', color: colors.accent },
  offline: { icon: 'cloud-offline-outline', label: 'Offline', color: colors.warning },
  error: { icon: 'alert-circle-outline', label: 'Sync issue', color: colors.danger },
} as const;

export function SyncStatus() {
  const { syncState, pendingChanges, retrySync } = useAppStore();
  const state = presentation[syncState];
  const label = pendingChanges ? `${state.label} · ${pendingChanges} waiting` : state.label;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}. Retry sync now.`} onPress={() => retrySync()} style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
    <Ionicons name={state.icon} color={state.color} size={15} />
    <Text variant="caption" style={{ color: state.color }}>{label}</Text>
  </Pressable>;
}

export function SyncStatusRow() {
  return <View style={styles.row}><SyncStatus /><Text variant="caption" color="muted">Tap to refresh</Text></View>;
}

const styles = StyleSheet.create({
  pill: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, minHeight: 34, paddingHorizontal: spacing.sm },
  pressed: { opacity: 0.72 },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
});
