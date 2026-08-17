import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  accessibilityLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function Button({ label, onPress, icon, disabled = false, accessibilityLabel, variant = 'primary' }: Props) {
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      haptic="light"
      onPress={onPress}
      style={[styles.button, styles[variant]]}
    >
      <Text variant="label" style={[styles.label, variant !== 'primary' && styles.labelSecondary]}>{label}</Text>
      {icon ? <View style={styles.icon}><Ionicons name={icon} color={variant === 'primary' ? colors.onAccent : colors.textPrimary} size={18} /></View> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.md,
    flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  label: { color: colors.onAccent },
  labelSecondary: { color: colors.textPrimary },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1 },
  ghost: { backgroundColor: colors.transparent },
  icon: { alignItems: 'center', justifyContent: 'center' },
});
