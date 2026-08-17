import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

import { Button, Card, Screen, Text } from '@/components/ui';
import { track } from '@/services/observability';
import { colors, radius, spacing } from '@/theme';

const pages = [
  { eyebrow: 'ONE CLEAR MOVE', title: 'Turn a goal into\nwhat to do today.', body: 'Tell DOIT what you want. It creates measurable milestones and recommends one useful next action.', icon: 'flag' as const, preview: ['Your goal', 'Today’s action', 'Start focus'] },
  { eyebrow: 'BUILT TO ADAPT', title: 'Stuck is part\nof the plan.', body: 'Complete, skip, or reschedule. Ask DOIT Coach for a smaller or better action whenever life changes.', icon: 'sparkles' as const, preview: ['“I only have 10 minutes.”', 'Coach adjusts the action', 'Keep moving'] },
  { eyebrow: 'YOUR MOMENTUM', title: 'See progress,\nnot pressure.', body: 'Build streaks, log real progress, and get a short weekly review. Start free; DOIT Pro is always optional.', icon: 'trending-up' as const, preview: ['3 day streak', '2 actions completed', 'Progress: +£25'] },
];

export default function WelcomeScreen() {
  const [page, setPage] = useState(0);
  const current = pages[page]!;

  useEffect(() => { track('onboarding viewed', { page: page + 1 }); }, [page]);

  const finish = async (destination: '/(auth)/signup' | '/(auth)/login') => {
    await AsyncStorage.setItem('doit:onboarding-seen', 'true');
    track('onboarding completed', { pages_seen: page + 1, destination: destination.endsWith('signup') ? 'signup' : 'login' });
    router.replace(destination);
  };
  const next = () => page === pages.length - 1 ? finish('/(auth)/signup') : setPage((value) => value + 1);

  return <Screen contentContainerStyle={styles.screen}>
    <View style={styles.top}><View style={styles.brand}><View style={styles.logo}><Ionicons name="checkmark" size={22} color={colors.onAccent} /></View><Text variant="label">DOIT AI</Text></View><Pressable hitSlop={12} onPress={() => finish('/(auth)/signup')}><Text variant="caption" color="secondary">Skip</Text></Pressable></View>
    <Animated.View key={page} entering={FadeInRight.duration(360)} exiting={FadeOutLeft.duration(180)} style={styles.main}>
      <Card style={styles.preview}>
        <View style={styles.previewIcon}><Ionicons name={current.icon} size={28} color={colors.accent} /></View>
        {current.preview.map((line, index) => <View key={line} style={[styles.previewRow, index === current.preview.length - 1 && styles.previewRowActive]}><View style={[styles.step, index === current.preview.length - 1 && styles.stepActive]}><Text variant="caption" color={index === current.preview.length - 1 ? 'accent' : 'muted'}>{index + 1}</Text></View><Text variant="label" color={index === current.preview.length - 1 ? 'primary' : 'secondary'}>{line}</Text>{index === current.preview.length - 1 ? <Ionicons name="arrow-forward" color={colors.accent} size={18} /> : null}</View>)}
      </Card>
      <View style={styles.copy}><Text variant="eyebrow" color="accent">{current.eyebrow}</Text><Text variant="display">{current.title}</Text><Text variant="body" color="secondary">{current.body}</Text></View>
    </Animated.View>
    <View style={styles.footer}><View style={styles.dots}>{pages.map((_, index) => <View key={index} style={[styles.dot, index === page && styles.dotActive]} />)}</View><Button label={page === pages.length - 1 ? 'Create my account' : 'Continue'} icon="arrow-forward" onPress={next} />{page > 0 ? <Button label="Back" variant="ghost" onPress={() => setPage((value) => value - 1)} /> : <Pressable style={styles.login} onPress={() => finish('/(auth)/login')}><Text variant="caption" color="secondary">Already have an account? <Text variant="label" color="accent">Log in</Text></Text></Pressable>}</View>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'space-between', paddingBottom: spacing.lg, paddingTop: spacing.lg }, top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, brand: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, logo: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.md, height: 40, justifyContent: 'center', width: 40 }, main: { flex: 1, gap: spacing.xl, justifyContent: 'center' }, preview: { gap: spacing.sm, padding: spacing.lg }, previewIcon: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.accentMuted, borderRadius: radius.md, height: 52, justifyContent: 'center', marginBottom: spacing.sm, width: 52 }, previewRow: { alignItems: 'center', borderColor: colors.borderSubtle, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.sm }, previewRowActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent }, step: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radius.pill, height: 28, justifyContent: 'center', width: 28 }, stepActive: { backgroundColor: colors.background }, copy: { gap: spacing.md }, footer: { gap: spacing.sm }, dots: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm }, dot: { backgroundColor: colors.border, borderRadius: 2, height: 4, width: 18 }, dotActive: { backgroundColor: colors.accent, width: 34 }, login: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
});
