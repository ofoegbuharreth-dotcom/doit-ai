import { router as expoRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { VoiceCaptureButton } from '@/components/voice/VoiceCaptureButton';
import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { useSubscription } from '@/hooks';
import { checkGoalPrompt } from '@/services/ai/goal-input';
import { useAppStore } from '@/stores';
import { colors, radius, spacing } from '@/theme';

const examples = ['Save £500', 'Build an app', 'Learn a language', 'Improve my grades'];
const router = expoRouter as unknown as { push: (href: string) => void; replace: (href: string) => void };
export default function CreateGoalScreen() {
  const { setDraft, goals } = useAppStore(); const { goalLimit, planName, isMax } = useSubscription();
  const [prompt, setPrompt] = useState(''); const [targetDate, setTargetDate] = useState(''); const [currentProgress, setCurrentProgress] = useState(''); const [availableTime, setAvailableTime] = useState(''); const [constraints, setConstraints] = useState(''); const [error, setError] = useState('');
  const activeGoalCount = goals.filter((goal) => goal.status === 'active' || goal.status === 'paused').length;
  const goalLimitReached = activeGoalCount >= goalLimit;
  const submit = () => { const check = checkGoalPrompt(prompt); if (!check.valid) return setError(check.message); setDraft({ prompt: prompt.trim(), targetDate: targetDate || undefined, currentProgress: currentProgress || undefined, availableTime: availableTime || undefined, constraints: constraints || undefined }); router.push('/ai-plan'); };
  if (goalLimitReached) return <Screen contentContainerStyle={styles.screen}><ScreenHeader title="New goal" /><Card style={styles.limit}><Text variant="eyebrow" color="accent">{planName.toUpperCase()} CAPACITY</Text><Text variant="title">You’re moving {goalLimit} active goals.</Text><Text color="secondary">{isMax ? 'Archive or complete one goal before creating another. MAX keeps the limit high so the system stays focused and fast.' : `${planName} supports up to ${goalLimit} active or paused goals. Upgrade your DOIT system for more capacity.`}</Text>{!isMax ? <Button label="Compare Pro and MAX" icon="diamond" onPress={() => router.push('/pro')} /> : null}<Button label="Manage my goals" variant="ghost" onPress={() => router.replace('/(tabs)/goals')} /></Card></Screen>;
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Screen scrollable contentContainerStyle={styles.screen}><ScreenHeader title="New goal" /><View style={styles.heading}><Text variant="eyebrow" color="accent">START WITH THE OUTCOME</Text><Text variant="title">What do you want to accomplish?</Text><Text color="secondary">Say it naturally. DOIT will turn it into something executable.</Text></View><Input multiline value={prompt} onChangeText={(value) => { setPrompt(value); setError(''); }} placeholder="I want to save £500 for a new PC" error={error} /><VoiceCaptureButton onTranscript={(value) => { setPrompt(value); setError(''); }} /><View style={styles.examples}>{examples.map((item) => <Pressable key={item} onPress={() => setPrompt(item)} style={styles.example}><Text variant="caption" color="secondary">{item}</Text></Pressable>)}</View><View style={styles.optional}><Text variant="heading">Useful context</Text><Text variant="caption" color="muted">Optional. Add only what matters.</Text><Input label="Target date" value={targetDate} onChangeText={setTargetDate} placeholder="YYYY-MM-DD" /><Input label="Current progress" value={currentProgress} onChangeText={setCurrentProgress} placeholder="e.g. 50" keyboardType="numeric" /><Input label="Time available" value={availableTime} onChangeText={setAvailableTime} placeholder="e.g. 30 minutes a day" /><Input label="Constraints" value={constraints} onChangeText={setConstraints} placeholder="Budget, schedule, equipment…" /></View><Button label="Build My Plan" icon="sparkles" onPress={submit} /></Screen></KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ flex: { flex: 1 }, screen: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl }, heading: { gap: spacing.sm, marginTop: spacing.md }, examples: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, example: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, optional: { gap: spacing.md, marginTop: spacing.md }, limit: { gap: spacing.md, marginTop: spacing.xl } });
