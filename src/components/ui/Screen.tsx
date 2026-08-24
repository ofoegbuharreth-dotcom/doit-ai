import type { PropsWithChildren } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type Props = PropsWithChildren<{ contentContainerStyle?: ViewStyle; scrollable?: boolean; refreshing?: boolean; onRefresh?: () => void }>;

export function Screen({ children, contentContainerStyle, scrollable = false, refreshing = false, onRefresh }: Props) {
  const { width, height } = useWindowDimensions();
  const compact = width < 380;
  const phone = width < 600;
  const tablet = width >= 600 && width < 1024;
  const short = height < 600;
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          phone && styles.phoneContent,
          compact && styles.compactContent,
          short && styles.shortContent,
          tablet && styles.tabletContent,
          width >= 1024 && styles.wideContent,
          Platform.OS === 'web' && styles.webContent,
          !scrollable && styles.fill,
          contentContainerStyle,
        ]}
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
  safeArea: { backgroundColor: colors.background, flex: 1, minWidth: 0 },
  content: { minWidth: 0, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, width: '100%' },
  phoneContent: { paddingHorizontal: spacing.md },
  compactContent: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  shortContent: { paddingVertical: spacing.sm },
  tabletContent: { alignSelf: 'center', maxWidth: 860, paddingHorizontal: spacing.xl, width: '100%' },
  wideContent: { alignSelf: 'center', maxWidth: 1200, width: '100%' },
  webContent: { alignSelf: 'center' },
  fill: { flexGrow: 1 },
});
