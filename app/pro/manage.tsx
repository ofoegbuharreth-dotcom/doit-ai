import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { useSubscription } from '@/hooks';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { colors, radius, spacing } from '@/theme';

const reasons = [['too_expensive', 'Too expensive'], ['not_using_enough', 'I’m not using it enough'], ['missing_features', 'It’s missing features I need'], ['difficult_to_use', 'It’s difficult to use'], ['technical_issues', 'I had technical issues'], ['other', 'Something else']] as const;

export default function ManageProScreen() {
  const provider = Platform.OS === 'web' ? 'Stripe' : 'Google Play';
  const { isPro, planName, status, trialDaysLeft, currentPeriodEndsAt, willRenew, cancelSubscription } = useSubscription();
  const [reason, setReason] = useState(''); const [details, setDetails] = useState(''); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState(''); const [warning, setWarning] = useState(''); const [opened, setOpened] = useState(false);
  const periodEnd = currentPeriodEndsAt ? new Date(currentPeriodEndsAt).toLocaleDateString() : undefined;
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const retryPendingEmails = async () => {
      const { data } = await supabase.from('subscription_cancellation_feedback').select('id').is('emailed_at', null).order('created_at', { ascending: true }).limit(5);
      if (!active || !data?.length) return;
      for (const feedback of data) {
        if (!active) return;
        await supabase.functions.invoke('send-cancellation-feedback', { body: { feedbackId: feedback.id } });
      }
    };
    retryPendingEmails();
    return () => { active = false; };
  }, []);
  const submitCancellation = async () => {
    setSubmitting(true); setError('');
    const result = await cancelSubscription(reason, details);
    setSubmitting(false);
    if (result.error) setError(result.error);
    else if (result.cancelled) router.replace('/pro');
    else { setWarning(result.warning ?? ''); setOpened(true); }
  };
  const cancel = () => {
    if (Platform.OS === 'web') { void submitCancellation(); return; }
    Alert.alert(`Open ${provider}?`, `We’ll save your feedback, then open ${provider} where you can review and confirm cancellation.`, [
      { text: 'Keep Pro', style: 'cancel' },
      { text: 'Continue', style: 'destructive', onPress: submitCancellation },
    ]);
  };

  if (opened) return <Screen contentContainerStyle={styles.screen}><ScreenHeader title="Subscription" /><Card style={styles.done}><View style={styles.doneIcon}><Ionicons name="open-outline" color={colors.onAccent} size={24} /></View><Text variant="title">Finish in {provider}.</Text><Text color="secondary">Your feedback was saved. Confirm cancellation in the {provider} screen that opened. {planName} stays active until the end of the paid period.</Text>{warning ? <Text variant="caption" color="muted">{warning}</Text> : null}<Button label="Back to Profile" onPress={() => router.replace('/(tabs)/profile')} /></Card></Screen>;
  if (!isPro) return <Screen contentContainerStyle={styles.screen}><ScreenHeader title="Subscription" /><Card style={styles.done}><Text variant="title">You’re on DOIT Free.</Text><Text color="secondary">There is no active paid entitlement on this account.</Text><Button label="View DOIT plans" onPress={() => router.replace('/pro')} /></Card></Screen>;
  if (willRenew === false) return <Screen contentContainerStyle={styles.screen}><ScreenHeader title="Subscription" /><Card style={styles.done}><View style={styles.scheduledIcon}><Ionicons name="checkmark" color={colors.textSecondary} size={22} /></View><Text variant="title">Cancellation scheduled.</Text><Text color="secondary" style={styles.centerText}>There’s nothing else to manage. {planName} remains available until {periodEnd ?? 'the current period ends'}.</Text><Button label="Back to Home" onPress={() => router.replace('/(tabs)/home')} /></Card></Screen>;

  return <Screen scrollable contentContainerStyle={styles.screen}><ScreenHeader title="Manage Pro" />
    <Card style={styles.status}><View style={styles.plan}><Ionicons name={planName === 'DOIT MAX' ? 'flash' : 'diamond'} color={colors.accent} size={22} /><View style={styles.flex}><Text variant="heading">{planName}</Text><Text variant="caption" color="accent">{status === 'trialing' ? `${trialDaysLeft} trial days remaining` : 'Active subscription'}</Text>{periodEnd ? <Text variant="caption" color="muted">Current period ends {periodEnd}</Text> : null}</View></View></Card>
    <View style={styles.heading}><Text variant="title">Before you go…</Text><Text color="secondary">What’s the main reason you’re thinking of cancelling?</Text></View>
    <View style={styles.reasons}>{reasons.map(([value, label]) => <Pressable key={value} onPress={() => setReason(value)} style={[styles.reason, reason === value && styles.reasonSelected]}><View style={[styles.radio, reason === value && styles.radioSelected]}>{reason === value ? <View style={styles.radioInner} /> : null}</View><Text variant="label" style={styles.flex}>{label}</Text></Pressable>)}</View>
    <Input multiline label="Anything else we should know?" placeholder="Optional feedback…" maxLength={2000} value={details} onChangeText={setDetails} />
    <Text variant="caption" color="muted">Your response is saved securely. After you confirm cancellation in {provider}, DOIT emails the owner automatically.</Text>
    {error ? <Text variant="caption" color="danger">{error}</Text> : null}
    <Button label={submitting ? 'Opening…' : `Continue to ${provider}`} disabled={!reason || submitting} variant="secondary" onPress={cancel} /><Button label={`Keep ${planName}`} variant="ghost" onPress={() => router.back()} />
  </Screen>;
}

const styles = StyleSheet.create({ screen: { gap: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.md }, status: { gap: spacing.sm }, plan: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, flex: { flex: 1 }, heading: { gap: spacing.sm, paddingTop: spacing.sm }, reasons: { gap: spacing.xs }, reason: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 56, paddingHorizontal: spacing.md }, reasonSelected: { backgroundColor: colors.accentMuted, borderColor: colors.accent }, radio: { alignItems: 'center', borderColor: colors.textMuted, borderRadius: radius.pill, borderWidth: 1.5, height: 20, justifyContent: 'center', width: 20 }, radioSelected: { borderColor: colors.accent }, radioInner: { backgroundColor: colors.accent, borderRadius: radius.pill, height: 10, width: 10 }, done: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl }, doneIcon: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radius.pill, height: 48, justifyContent: 'center', width: 48 }, scheduledIcon: { alignItems: 'center', backgroundColor: colors.surfacePressed, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 }, centerText: { textAlign: 'center' } });
