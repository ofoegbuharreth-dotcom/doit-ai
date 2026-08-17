import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PressableScale, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export function ScreenHeader({ title, action, fallbackHref = '/(tabs)/home', onBack }: { title?: string; action?: React.ReactNode; fallbackHref?: Href; onBack?: () => void }) {
  const goBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace(fallbackHref);
  };
  return <View style={styles.row}><PressableScale accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={styles.back}><Ionicons name="arrow-back" size={21} color={colors.textPrimary} /></PressableScale>{title ? <Text variant="label" style={styles.title}>{title}</Text> : <View style={styles.title} />}{action}</View>;
}
const styles = StyleSheet.create({ row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, back: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 }, title: { flex: 1 } });
