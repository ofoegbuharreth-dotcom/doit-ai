import type { PropsWithChildren } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type Props = PropsWithChildren<{ contentContainerStyle?: ViewStyle; scrollable?: boolean; refreshing?: boolean; onRefresh?: () => void }>;

export function Screen({ children, contentContainerStyle, scrollable = false, refreshing = false, onRefresh }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 370; const tablet = Platform.OS !== 'web' && width >= 700;
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <ScrollView
        contentContainerStyle={[styles.content, compact && styles.compactContent, tablet && styles.tabletContent, Platform.OS === 'web' && styles.webContent, !scrollable && styles.fill, contentContainerStyle]}
        scrollEnabled={scrollable}
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh && Platform.OS !== 'web' ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} tintColor={colors.accent} progressBackgroundColor={colors.surfaceElevated} /> : undefined}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  compactContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  tabletContent: { alignSelf: 'center', maxWidth: 760, width: '100%' },
  webContent: { alignSelf: 'center', maxWidth: 1200, width: '100%' },
  fill: { flexGrow: 1 },
});
