import type { ComponentProps } from 'react';
import { Platform, Text as RNText, StyleSheet } from 'react-native';

import { colors, typography, type ColorToken, type TypographyVariant } from '@/theme';

type Props = ComponentProps<typeof RNText> & {
  variant?: TypographyVariant;
  color?: 'primary' | 'secondary' | 'muted' | 'accent' | 'danger';
};

const colorMap: Record<NonNullable<Props['color']>, ColorToken> = {
  primary: 'textPrimary', secondary: 'textSecondary', muted: 'textMuted', accent: 'accent', danger: 'danger',
};

export function Text({ variant = 'body', color = 'primary', style, maxFontSizeMultiplier = Platform.OS === 'android' ? 1.05 : 1.15, ...props }: Props) {
  return <RNText {...props} maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.base, typography[variant], Platform.OS === 'web' && webTypography[variant], { color: colors[colorMap[color]] }, style]} />;
}

const styles = StyleSheet.create({ base: { includeFontPadding: false } });

const webTypography = {
  display: { fontSize: 48, lineHeight: 55 },
  title: { fontSize: 32, lineHeight: 39 },
  heading: { fontSize: 22, lineHeight: 29 },
  body: { fontSize: 17, lineHeight: 26 },
  label: { fontSize: 16, lineHeight: 22 },
  caption: { fontSize: 14, lineHeight: 20 },
  eyebrow: { fontSize: 12, lineHeight: 17 },
} as const;
