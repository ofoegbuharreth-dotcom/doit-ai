import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Button, Text } from '@/components/ui';
import type { RecurrenceChoice } from '@/services/recurrence';
import { colors, radius, spacing } from '@/theme';
import type { Task } from '@/types';

const choices: { value: RecurrenceChoice; icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }[] = [
  { value: 'daily', icon: 'sunny-outline', title: 'Every day', detail: 'Create a fresh action each day.' },
  { value: 'weekdays', icon: 'briefcase-outline', title: 'Weekdays', detail: 'Monday to Friday only.' },
  { value: 'weekly', icon: 'calendar-outline', title: 'Every week', detail: 'Repeat on this day each week.' },
];

export function RecurrenceSheet({ task, visible, saving, error, onClose, onSave, onRemove }: { task?: Task; visible: boolean; saving: boolean; error?: string; onClose: () => void; onSave: (choice: RecurrenceChoice) => void; onRemove?: () => void }) {
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}><Animated.View entering={FadeIn.duration(150)} style={styles.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} /><Animated.View entering={SlideInDown.springify().damping(22)} style={styles.sheet}><View style={styles.handle} /><View style={styles.heading}><View style={styles.icon}><Ionicons name="repeat" size={22} color={colors.accent} /></View><View style={styles.flex}><Text variant="title">Make this a routine</Text><Text color="secondary" numberOfLines={2}>{task?.title}</Text></View></View><Text variant="caption" color="secondary">DOIT creates one fresh occurrence at a time, so your Today screen stays calm.</Text><View style={styles.choices}>{choices.map((choice) => <Pressable key={choice.value} disabled={saving} onPress={() => onSave(choice.value)} style={({ pressed }) => [styles.choice, pressed && styles.pressed]}><View style={styles.choiceIcon}><Ionicons name={choice.icon} size={20} color={colors.accent} /></View><View style={styles.flex}><Text variant="label">{choice.title}</Text><Text variant="caption" color="muted">{choice.detail}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.textMuted} /></Pressable>)}</View>{error ? <Text variant="caption" color="danger">{error}</Text> : null}{onRemove ? <Button label="Stop repeating" variant="secondary" icon="close-circle-outline" disabled={saving} onPress={onRemove} /> : null}<Button label="Not now" variant="ghost" onPress={onClose} /></Animated.View></Animated.View></Modal>;
}

const styles = StyleSheet.create({ overlay: { backgroundColor: colors.overlay, flex: 1, justifyContent: 'flex-end' }, sheet: { backgroundColor: colors.surfaceElevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl }, handle: { alignSelf: 'center', backgroundColor: colors.border, borderRadius: radius.pill, height: 4, width: 42 }, heading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, icon: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.md, height: 44, justifyContent: 'center', width: 44 }, flex: { flex: 1, gap: 2 }, choices: { gap: spacing.sm }, choice: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 72, padding: spacing.md }, choiceIcon: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.sm, height: 38, justifyContent: 'center', width: 38 }, pressed: { opacity: 0.72 } });
