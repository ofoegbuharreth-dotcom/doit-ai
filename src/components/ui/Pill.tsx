import { StyleSheet, View } from 'react-native';
import type { PropsWithChildren } from 'react';

import { colors, radius, spacing } from '@/theme';
import { Text } from './Text';

export function Pill({ children }: PropsWithChildren) {
  return <View style={styles.pill}><Text variant="caption" color="secondary">{children}</Text></View>;
}

const styles = StyleSheet.create({ pill: { alignSelf: 'flex-start', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs } });
