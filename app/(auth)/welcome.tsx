import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { checkGoalPrompt } from '@/services/ai/goal-input';
import { clearFirstRunActivation, startFirstRunActivation } from '@/services/activation';
import { track } from '@/services/observability';
import { colors, radius, spacing } from '@/theme';

const examples = ['Save £1,000', 'Finish my assignments', 'Run my first 5K', 'Launch my portfolio'];

export default function WelcomeScreen() {
  const [page, setPage] = useState(0);
  const [goal, setGoal] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { track('onboarding viewed', { page: page + 1 }); }, [page]);

  const saveAndSignUp = async () => {
    const check = checkGoalPrompt(goal);
    if (!check.valid) { setError(check.message); setPage(1); return; }
    await startFirstRunActivation(goal);
    await AsyncStorage.setItem('doit:onboarding-seen', 'true');
    track('activation started');
    track('activation goal submitted', { character_count: goal.trim().length });
    track('onboarding completed', { pages_seen: 3, destination: 'signup' });
    router.replace('/(auth)/signup');
  };

  const skip = async (destination: '/(auth)/signup' | '/(auth)/login') => {
    await clearFirstRunActivation();
    await AsyncStorage.setItem('doit:onboarding-seen', 'true');
    track('activation skipped', { page: page + 1 });
    track('onboarding completed', { pages_seen: page + 1, destination: destination.endsWith('signup') ? 'signup' : 'login' });
    router.replace(destination);
  };

  const next = () => {
    if (page === 1) {
      const check = checkGoalPrompt(goal);
      if (!check.valid) return setError(check.message);
    }
    setPage((value) => Math.min(2, value + 1));
  };

  return <Screen scrollable contentContainerStyle={styles.screen}>
    <View style={styles.top}>
      <View style={styles.brand}><View style={styles.logo}><Ionicons name="checkmark" size={22} color={colors.onAccent} /></View><Text variant="label">DOIT AI</Text></View>
      <Pressable hitSlop={12} onPress={() => skip('/(auth)/signup')}><Text variant="caption" color="secondary">Skip setup</Text></Pressable>
    </View>

    <Animated.View key={page} entering={FadeInRight.duration(320)} exiting={FadeOutLeft.duration(160)} style={styles.main}>
      {page === 0 ? <>
        <View style={styles.timeBadge}><Ionicons name="time-outline" color={colors.accent} size={17} /><Text variant="label" color="accent">YOUR FIRST WIN IN 5 MINUTES</Text></View>
        <View style={styles.copy}><Text variant="display">Leave with a plan.\nStart with one move.</Text><Text variant="body" color="secondary">Tell DOIT what matters. We’ll turn it into a quality goal and guide you through one small action before setup is over.</Text></View>
        <Card style={styles.promise}>
          {['Name the outcome', 'Review a useful plan', 'Complete a 5-minute action'].map((item, index) => <View key={item} style={styles.promiseRow}><View style={styles.step}><Text variant="label" color="accent">{index + 1}</Text></View><Text variant="label" style={styles.flex}>{item}</Text><Text variant="caption" color="muted">{index === 0 ? '1 min' : '2 min'}</Text></View>)}
        </Card>
      </> : null}

      {page === 1 ? <>
        <View style={styles.copy}><Text variant="eyebrow" color="accent">STEP 1 OF 3</Text><Text variant="title">What would make the next 30 days meaningfully better?</Text><Text color="secondary">Use a real outcome—not a category. You can add deadlines and details when DOIT builds the plan.</Text></View>
        <Input multiline value={goal} onChangeText={(value) => { setGoal(value); setError(''); }} placeholder="e.g. Finish all 6 assignments before the deadline" error={error} />
        <View style={styles.examples}>{examples.map((example) => <Pressable key={example} onPress={() => { setGoal(example); setError(''); }} style={styles.example}><Text variant="caption" color="secondary">{example}</Text></Pressable>)}</View>
        <Card style={styles.tip}><Ionicons name="bulb-outline" color={colors.accent} size={21} /><View style={styles.flex}><Text variant="label">A quality goal is specific enough to act on.</Text><Text variant="caption" color="muted">“Save £1,000” works better than “money”.</Text></View></Card>
      </> : null}

      {page === 2 ? <>
        <View style={styles.copy}><Text variant="eyebrow" color="accent">READY TO BUILD</Text><Text variant="title">Your first goal starts here.</Text><Text color="secondary">Create your account, review DOIT’s plan, then complete the first five-minute move.</Text></View>
        <Card style={styles.goalCard}><View style={styles.goalIcon}><Ionicons name="flag" color={colors.accent} size={24} /></View><View style={styles.flex}><Text variant="caption" color="muted">YOUR OUTCOME</Text><Text variant="heading">{goal.trim()}</Text></View><Pressable hitSlop={12} onPress={() => setPage(1)}><Text variant="caption" color="accent">Edit</Text></Pressable></Card>
        <View style={styles.reassurance}><Ionicons name="shield-checkmark-outline" color={colors.textMuted} size={18} /><Text variant="caption" color="muted">Private by default · Free to start · You stay in control</Text></View>
      </> : null}
    </Animated.View>

    <View style={styles.footer}>
      <View style={styles.dots}>{[0, 1, 2].map((index) => <View key={index} style={[styles.dot, index === page && styles.dotActive]} />)}</View>
      <Button label={page === 2 ? 'Create account & build my plan' : page === 0 ? 'Start my 5-minute setup' : 'Use this goal'} icon="arrow-forward" onPress={page === 2 ? saveAndSignUp : next} />
      {page > 0 ? <Button label="Back" variant="ghost" onPress={() => setPage((value) => value - 1)} /> : <Pressable style={styles.login} onPress={() => skip('/(auth)/login')}><Text variant="caption" color="secondary">Already have an account? <Text variant="label" color="accent">Log in</Text></Text></Pressable>}
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, gap: spacing.xl, justifyContent: 'space-between', paddingBottom: spacing.lg, paddingTop: spacing.lg }, top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, brand: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, logo: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.md, height: 40, justifyContent: 'center', width: 40 }, main: { flex: 1, gap: spacing.lg, justifyContent: 'center', marginVertical: spacing.lg }, copy: { gap: spacing.md, maxWidth: 720 }, flex: { flex: 1 }, timeBadge: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.accentMuted, borderColor: colors.accentBorder, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, promise: { gap: spacing.xs }, promiseRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 48 }, step: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.pill, height: 30, justifyContent: 'center', width: 30 }, examples: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, example: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, tip: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, goalCard: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, goalIcon: { alignItems: 'center', backgroundColor: colors.accentMuted, borderRadius: radius.md, height: 48, justifyContent: 'center', width: 48 }, reassurance: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs }, footer: { gap: spacing.sm }, dots: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm }, dot: { backgroundColor: colors.border, borderRadius: 2, height: 4, width: 18 }, dotActive: { backgroundColor: colors.accent, width: 34 }, login: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});
