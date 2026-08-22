import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { Card, Screen, Text } from '@/components/ui';
import { releaseNotes } from '@/services/release-notes';
import { colors, radius, spacing } from '@/theme';

export default function VersionLogsScreen() {
  return <Screen scrollable contentContainerStyle={styles.screen}>
    <ScreenHeader title="Version logs" onBack={() => router.back()} />
    <View style={styles.hero}><View style={styles.heroIcon}><Ionicons name="sparkles" color={colors.onAccent} size={23} /></View><View style={styles.flex}><Text variant="eyebrow" color="accent">WHAT’S NEW IN DOIT</Text><Text variant="title">Every improvement, in one place.</Text><Text color="secondary">New systems, useful changes, and important fixes from the latest DOIT releases.</Text></View></View>
    <View style={styles.timeline}>{releaseNotes.map((release, index) => <Animated.View key={release.version} entering={FadeInDown.delay(Math.min(index * 70, 420)).duration(300)} style={styles.releaseWrap}>
      <View style={styles.rail}><View style={[styles.dot, index === 0 && styles.dotLatest]}>{index === 0 ? <Ionicons name="flash" color={colors.onAccent} size={13} /> : null}</View>{index < releaseNotes.length - 1 ? <View style={styles.line} /> : null}</View>
      <Card style={[styles.release, index === 0 && styles.latest]}>
        <View style={styles.releaseTop}><View style={styles.version}><Text variant="caption" color="accent">VERSION {release.version}</Text></View>{index === 0 ? <View style={styles.newBadge}><Text variant="caption" color="accent">LATEST</Text></View> : null}<Text variant="caption" color="muted">{new Date(`${release.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text></View>
        <Text variant="heading">{release.title}</Text><Text variant="caption" color="secondary">{release.summary}</Text>
        <View style={styles.highlights}>{release.highlights.map((highlight) => <View key={highlight} style={styles.highlight}><View style={styles.bullet}><Ionicons name="checkmark" color={colors.accent} size={13} /></View><Text variant="caption" style={styles.flex}>{highlight}</Text></View>)}</View>
      </Card>
    </Animated.View>)}</View>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.xl, paddingBottom: spacing.xxl, paddingTop: spacing.md }, flex: { flex: 1 }, hero: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, maxWidth: 840 }, heroIcon: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.lg, height: 54, justifyContent: 'center', width: 54 }, timeline: { maxWidth: 900 }, releaseWrap: { flexDirection: 'row', gap: spacing.md }, rail: { alignItems: 'center', width: 30 }, dot: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 2, height: 24, marginTop: spacing.lg, width: 24 }, dotLatest: { alignItems: 'center', backgroundColor: colors.accent, borderColor: colors.accent, justifyContent: 'center' }, line: { backgroundColor: colors.border, flex: 1, width: 2 }, release: { flex: 1, gap: spacing.sm, marginBottom: spacing.md }, latest: { borderColor: colors.accent }, releaseTop: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, version: { backgroundColor: colors.accentMuted, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, newBadge: { borderColor: colors.accent, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, highlights: { gap: spacing.xs, paddingTop: spacing.xs }, highlight: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, bullet: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.pill, height: 24, justifyContent: 'center', width: 24 },
});
