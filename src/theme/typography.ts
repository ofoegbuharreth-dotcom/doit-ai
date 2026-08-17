export const fontFamilies = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
} as const;

export const typography = {
  display: { fontFamily: fontFamilies.bold, fontSize: 42, lineHeight: 48, letterSpacing: -1.5 },
  title: { fontFamily: fontFamilies.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  heading: { fontFamily: fontFamilies.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  body: { fontFamily: fontFamilies.regular, fontSize: 16, lineHeight: 24, letterSpacing: -0.1 },
  label: { fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },
  caption: { fontFamily: fontFamilies.medium, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  eyebrow: { fontFamily: fontFamilies.bold, fontSize: 11, lineHeight: 16, letterSpacing: 1.4 },
} as const;

export type TypographyVariant = keyof typeof typography;
