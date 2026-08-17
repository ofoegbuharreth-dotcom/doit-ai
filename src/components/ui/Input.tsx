import { forwardRef } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fontFamilies, radius, spacing } from '@/theme';
import { Text } from './Text';

type Props = TextInputProps & { label?: string; error?: string };

export const Input = forwardRef<TextInput, Props>(({ label, error, multiline, style, ...props }, ref) => (
  <View style={styles.wrapper}>
    {label ? <Text variant="caption" color="secondary">{label}</Text> : null}
    <TextInput
      ref={ref}
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.accent}
      maxFontSizeMultiplier={Platform.OS === 'android' ? 1.05 : 1.15}
      multiline={multiline}
      style={[styles.input, multiline && styles.multiline, error && styles.errorBorder, style]}
      {...props}
    />
    {error ? <Text variant="caption" color="danger">{error}</Text> : null}
  </View>
));
Input.displayName = 'Input';

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.textPrimary, fontFamily: fontFamilies.medium, fontSize: 16, minHeight: 54, paddingHorizontal: spacing.md },
  multiline: { minHeight: 132, paddingTop: spacing.md, textAlignVertical: 'top' },
  errorBorder: { borderColor: colors.danger },
});
