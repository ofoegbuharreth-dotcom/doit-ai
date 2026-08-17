import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Button, Input, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { DailyCheckIn as CheckIn } from '@/types';
import { useState } from 'react';

export function DailyCheckIn({ visible, onClose, onSubmit }: { visible: boolean; onClose: () => void; onSubmit: (mood: CheckIn['mood'], accomplishment: string, blocker?: string) => void }) {
  const [mood, setMood] = useState<CheckIn['mood']>('okay'); const [accomplishment, setAccomplishment] = useState(''); const [blocker, setBlocker] = useState('');
  const finish = () => { onSubmit(mood, accomplishment.trim(), blocker.trim() || undefined); setAccomplishment(''); setBlocker(''); onClose(); };
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}><Animated.View entering={FadeIn} style={styles.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} /><Animated.View entering={SlideInDown.springify().damping(20)} style={styles.sheet}><View style={styles.handle} /><Text variant="title">What did you accomplish today?</Text><Text color="secondary">Small wins count. This helps DOIT shape tomorrow.</Text><View style={styles.moods}>{(['great', 'okay', 'bad'] as const).map((item) => <Pressable key={item} onPress={() => setMood(item)} style={[styles.mood, mood === item && styles.moodActive]}><Text variant="label" color={mood === item ? 'accent' : 'secondary'}>{item[0]?.toUpperCase()}{item.slice(1)}</Text></Pressable>)}</View><Input label="Today’s win" placeholder="I completed…" value={accomplishment} onChangeText={setAccomplishment} /><Input label="Anything get in your way?" placeholder="Optional" value={blocker} onChangeText={setBlocker} /><Button label="Save check-in" disabled={!accomplishment.trim()} onPress={finish} /></Animated.View></Animated.View></Modal>;
}
const styles = StyleSheet.create({ overlay: { backgroundColor: colors.overlay, flex: 1, justifyContent: 'flex-end' }, sheet: { backgroundColor: colors.surfaceElevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl }, handle: { alignSelf: 'center', backgroundColor: colors.border, borderRadius: radius.pill, height: 4, width: 42 }, moods: { flexDirection: 'row', gap: spacing.sm }, mood: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flex: 1, paddingVertical: spacing.md }, moodActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent } });
