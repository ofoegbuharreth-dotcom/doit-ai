import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Button, Input, Text } from '@/components/ui';
import { useAppStore } from '@/stores';
import { colors, radius, spacing } from '@/theme';
import type { Goal, GoalProgressEntry } from '@/types';

export function ProgressLogSheet({ visible, goal, entry, onClose, onSaved }: { visible: boolean; goal?: Goal; entry?: GoalProgressEntry; onClose: () => void; onSaved?: (result: { goalCompleted?: boolean; milestone?: string }) => void }) {
  const { logProgress, editProgress, progressSaving } = useAppStore();
  const [amount, setAmount] = useState(''); const [note, setNote] = useState(''); const [error, setError] = useState('');
  useEffect(() => { if (visible) { setAmount(entry ? String(entry.amount) : ''); setNote(entry?.note ?? ''); setError(''); } }, [entry, visible]);
  if (!goal) return null;
  const save = async () => {
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount greater than zero.');
    if (entry) {
      const result = await editProgress(entry.id, value, note);
      if (result.error) return setError(result.error);
      onSaved?.({});
    } else {
      const result = await logProgress(goal.id, value, note);
      if (result.error) return setError(result.error);
      onSaved?.(result);
    }
    onClose();
  };
  const example = goal.unit === '%' ? 'e.g. 10' : goal.unit === '£' ? 'e.g. 50' : 'e.g. 5';
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}><Animated.View entering={FadeIn} style={styles.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} /><Animated.View entering={SlideInDown.springify().damping(20)} style={styles.sheet}><View style={styles.handle} /><View style={styles.heading}><Text variant="eyebrow" color="accent">{entry ? 'EDIT PROGRESS' : 'REAL PROGRESS'}</Text><Text variant="title">{entry ? 'Correct this entry' : `What moved forward?`}</Text><Text color="secondary">{goal.title}</Text></View><Input autoFocus label={`Amount to ${entry ? 'record' : 'add'} (${goal.unit})`} placeholder={example} keyboardType="decimal-pad" value={amount} onChangeText={(value) => { setAmount(value); setError(''); }} error={error} /><Input multiline label="What happened?" placeholder="Optional note, e.g. payday transfer" maxLength={500} value={note} onChangeText={setNote} /><Button label={progressSaving ? 'Saving…' : entry ? 'Save correction' : 'Log progress'} disabled={progressSaving} icon="trending-up" onPress={save} /><Button label="Cancel" variant="ghost" onPress={onClose} /></Animated.View></Animated.View></Modal>;
}
const styles = StyleSheet.create({ overlay: { backgroundColor: colors.overlay, flex: 1, justifyContent: 'flex-end' }, sheet: { backgroundColor: colors.surfaceElevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl }, handle: { alignSelf: 'center', backgroundColor: colors.border, borderRadius: radius.pill, height: 4, width: 42 }, heading: { gap: spacing.xs } });
