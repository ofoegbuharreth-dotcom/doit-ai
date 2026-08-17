import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { useAuth } from '@/hooks';
import { submitProductFeedback, type FeedbackCategory } from '@/services';
import { track } from '@/services/observability';
import { colors, radius, spacing } from '@/theme';

const categories: { id: FeedbackCategory; icon: keyof typeof Ionicons.glyphMap; label: string; detail: string }[] = [
  { id: 'idea', icon: 'bulb-outline', label: 'I have an idea', detail: 'A feature or improvement' },
  { id: 'confusing', icon: 'help-circle-outline', label: 'Something is confusing', detail: 'A flow that needs clarity' },
  { id: 'bug', icon: 'bug-outline', label: 'I found a bug', detail: 'Something did not work' },
  { id: 'love', icon: 'heart-outline', label: 'Something works well', detail: 'Tell us what to keep' },
];

export default function FeedbackScreen() {
  const { user } = useAuth();
  const [category, setCategory] = useState<FeedbackCategory>('idea');
  const [rating, setRating] = useState<number>();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!user) return setError('Sign in before sending feedback.');
    setSaving(true); setError('');
    try {
      await submitProductFeedback({ userId: user.id, category, rating, message, source: 'feedback_screen' });
      track('product feedback submitted', { category, rating: rating ?? null });
      setSent(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not save your feedback.');
    } finally { setSaving(false); }
  };

  if (sent) return <Screen contentContainerStyle={styles.screen}><ScreenHeader title="Feedback" /><Card style={styles.thanks}><View style={styles.thanksIcon}><Ionicons name="checkmark" color={colors.onAccent} size={25} /></View><Text variant="title">That’s saved. Thank you.</Text><Text color="secondary" style={styles.center}>Founding feedback directly decides what DOIT improves next.</Text><Button label="Back to DOIT" onPress={() => router.replace('/(tabs)/profile')} /></Card></Screen>;

  return <Screen scrollable contentContainerStyle={styles.screen}>
    <ScreenHeader title="Help shape DOIT" />
    <View style={styles.hero}><Text variant="eyebrow" color="accent">FOUNDING FEEDBACK</Text><Text variant="title">What should we improve next?</Text><Text color="secondary">Every response is saved securely and reviewed as part of the launch.</Text></View>
    <View style={styles.categories}>{categories.map((item) => <Pressable key={item.id} onPress={() => setCategory(item.id)} style={[styles.category, category === item.id && styles.categorySelected]}><View style={styles.categoryIcon}><Ionicons name={item.icon} color={category === item.id ? colors.accent : colors.textSecondary} size={20} /></View><View style={styles.flex}><Text variant="label" color={category === item.id ? 'accent' : undefined}>{item.label}</Text><Text variant="caption" color="muted">{item.detail}</Text></View>{category === item.id ? <Ionicons name="checkmark-circle" color={colors.accent} size={20} /> : null}</Pressable>)}</View>
    <Card style={styles.rating}><Text variant="label">How is DOIT feeling overall?</Text><View style={styles.stars}>{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} accessibilityLabel={`${value} out of 5`} onPress={() => setRating(value)} style={styles.star}><Ionicons name={rating && value <= rating ? 'star' : 'star-outline'} color={rating && value <= rating ? colors.accent : colors.textMuted} size={28} /></Pressable>)}</View></Card>
    <Input multiline label="Tell us what happened or what you want" placeholder="The more specific you are, the easier it is to improve…" maxLength={2000} value={message} onChangeText={setMessage} />
    {error ? <Text variant="caption" color="danger">{error}</Text> : null}
    <Button label={saving ? 'Saving securely…' : 'Send feedback'} disabled={saving || message.trim().length < 3} icon="send" onPress={submit} />
    <Text variant="caption" color="muted" style={styles.center}>Feedback may include your account ID so we can investigate technical problems. Never include passwords or payment details.</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.md }, hero: { gap: spacing.sm }, flex: { flex: 1 }, categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, category: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flexBasis: '44%', flexDirection: 'row', flexGrow: 1, gap: spacing.sm, minHeight: 76, minWidth: 250, padding: spacing.md }, categorySelected: { backgroundColor: colors.accentMuted, borderColor: colors.accent }, categoryIcon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radius.sm, height: 40, justifyContent: 'center', width: 40 }, rating: { alignItems: 'center', gap: spacing.sm }, stars: { flexDirection: 'row', gap: spacing.sm }, star: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 }, thanks: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl }, thanksIcon: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.pill, height: 52, justifyContent: 'center', width: 52 }, center: { textAlign: 'center' },
});
