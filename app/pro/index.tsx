import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { Button, Card, Screen, Text } from '@/components/ui';
import { SUBSCRIPTION_TRIAL_DAYS } from '@/constants/subscription';
import { useSubscription } from '@/hooks';
import { track } from '@/services/observability';
import { colors, radius, spacing, useAccentTheme } from '@/theme';

type PaidTier = 'pro' | 'max';
type BillingPeriod = 'monthly' | 'annual';

const tierCopy = {
  pro: {
    name: 'DOIT Pro', eyebrow: 'FOR CONSISTENT BUILDERS', icon: 'diamond-outline' as const,
    headline: 'Serious momentum, without the noise.', detail: 'For people managing several real outcomes at once.',
    features: ['20 active goals', '60 AI goal plans each month', '100 AI adaptations each month', 'DOIT Coach', 'Weekly AI Review', 'Full progress history'],
  },
  max: {
    name: 'DOIT MAX', eyebrow: 'THE COMPLETE DOIT SYSTEM', icon: 'flash' as const,
    headline: 'Maximum intelligence. Maximum control.', detail: 'The highest-capacity system for ambitious users who want DOIT working at full strength.',
    features: ['100 active goals', '150 AI goal plans each month', '500 AI adaptations each month', 'Cross-goal priority intelligence', 'Automatic plan rebuilding', 'MAX AI Goal Coach', 'Advanced weekly intelligence', 'Advanced progress analytics', 'Calendar-aware planning', 'Goal dependencies', 'Full exports', 'Every DOIT Pro feature'],
  },
} as const;

export default function ProScreen() {
  const web = Platform.OS === 'web';
  const { palette } = useAccentTheme();
  const params = useLocalSearchParams<{ checkout?: string; tier?: string }>();
  const { plan, planName, isPro, isMax, status, trialDaysLeft, willRenew, currentPeriodEndsAt, products, loading, storeReady, configurationError, startProTrial, restorePurchases, refreshSubscription } = useSubscription();
  const [tier, setTier] = useState<PaidTier>(isMax ? 'max' : 'pro');
  const [period, setPeriod] = useState<BillingPeriod>('annual');
  const [working, setWorking] = useState<'purchase' | 'restore'>();
  const [error, setError] = useState('');
  const selectedProduct = useMemo(() => products.find((product) => product.tier === tier && product.period === period), [period, products, tier]);

  useEffect(() => { track('paywall viewed', { store_ready: storeReady }); }, [storeReady]);
  useEffect(() => { if (params.tier === 'max') setTier('max'); }, [params.tier]);
  useEffect(() => {
    if (params.checkout !== 'success') return;
    refreshSubscription();
    const timer = setTimeout(refreshSubscription, 1800);
    return () => clearTimeout(timer);
  }, [params.checkout, refreshSubscription]);

  const purchase = async () => {
    if (!selectedProduct) return setError(`${tierCopy[tier].name} ${period} billing is not connected to Stripe yet.`);
    setWorking('purchase'); setError('');
    const result = await startProTrial(selectedProduct.id);
    setWorking(undefined);
    if (result.error) setError(result.error);
  };
  const restore = async () => {
    setWorking('restore'); setError('');
    const result = await restorePurchases();
    setWorking(undefined);
    if (result.error) setError(result.error);
  };

  return <Screen scrollable contentContainerStyle={styles.screen}>
    <ScreenHeader title="Plans" onBack={() => router.replace('/(tabs)/profile')} />
    <LinearGradient colors={[palette.muted, colors.surfaceElevated, colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={styles.heroBadge}><Ionicons name="sparkles" color={colors.accent} size={22} /><Text variant="eyebrow" color="accent">CHOOSE YOUR DOIT SYSTEM</Text></View>
      <Text variant="title" style={styles.heroTitle}>Go further with a plan built around your ambition.</Text>
      <Text color="secondary">Every paid tier adds capacity. MAX gives you the strongest planning system DOIT offers.</Text>
      {isPro ? <View style={styles.active}><Ionicons name="checkmark-circle" color={colors.success} size={20} /><View style={styles.flex}><Text variant="label">{planName} {status === 'trialing' ? `trial · ${trialDaysLeft} days left` : 'active'}</Text><Text variant="caption" color="muted">Your benefits are ready on every signed-in device.</Text></View></View> : null}
    </LinearGradient>

    {params.checkout === 'success' ? <Card style={styles.notice}><Ionicons name="hourglass-outline" color={colors.accent} size={22} /><View style={styles.flex}><Text variant="label">Stripe confirmed the change</Text><Text variant="caption" color="secondary">DOIT is refreshing your new entitlement. This normally takes a few seconds.</Text></View></Card> : null}
    {params.checkout === 'cancelled' ? <Card style={styles.notice}><Ionicons name="arrow-back-circle-outline" color={colors.textMuted} size={22} /><Text variant="caption" color="secondary">Checkout was cancelled. You were not charged.</Text></Card> : null}

    {!isMax ? <View style={styles.billingSwitch}>{(['monthly', 'annual'] as BillingPeriod[]).map((value) => <Pressable key={value} onPress={() => setPeriod(value)} style={[styles.period, period === value && styles.periodSelected]}><Text variant="label" color={period === value ? 'accent' : 'muted'}>{value === 'annual' ? 'Annual · best value' : 'Monthly'}</Text></Pressable>)}</View> : null}

    <View style={styles.tiers}>{(['pro', 'max'] as PaidTier[]).map((value) => {
      const copy = tierCopy[value];
      const product = products.find((item) => item.tier === value && item.period === period);
      const current = isPro && plan === value;
      const selected = tier === value;
      const max = value === 'max';
      return <Pressable key={value} disabled={isMax} onPress={() => setTier(value)} style={[styles.tier, selected && !isMax && styles.tierSelected, max && styles.maxTier]}>
        {max ? <LinearGradient pointerEvents="none" colors={[palette.muted, 'transparent']} style={StyleSheet.absoluteFill} /> : null}
        <View style={styles.tierTop}><View style={[styles.tierIcon, max && styles.maxIcon]}><Ionicons name={copy.icon} color={colors.accent} size={24} /></View><View style={styles.flex}><Text variant="eyebrow" color="accent">{copy.eyebrow}</Text><Text variant="title" style={styles.tierName}>{copy.name}</Text></View>{current ? <View style={styles.current}><Text variant="caption" color="accent">CURRENT</Text></View> : selected && !isMax ? <Ionicons name="checkmark-circle" color={colors.accent} size={23} /> : null}</View>
        <Text variant="heading">{copy.headline}</Text><Text variant="caption" color="secondary">{copy.detail}</Text>
        <View style={styles.priceRow}>{product ? <><Text variant="title">{product.price}</Text><Text variant="caption" color="muted">/{product.period === 'annual' ? 'year' : 'month'}</Text>{product.monthlyEquivalent ? <View style={styles.saving}><Text variant="caption" color="accent">{product.monthlyEquivalent}/mo</Text></View> : null}</> : <Text variant="caption" color="muted">Stripe price setup required</Text>}</View>
        <View style={styles.features}>{copy.features.map((feature) => <View key={feature} style={styles.feature}><Ionicons name="checkmark-circle" color={max ? colors.accent : colors.success} size={18} /><Text variant="caption" style={styles.flex}>{feature}</Text></View>)}</View>
      </Pressable>;
    })}</View>

    {isMax ? <View style={styles.actions}><Button label="Open Weekly Review" icon="analytics" onPress={() => router.push('/pro/weekly-review')} />{willRenew === false ? <Cancelled periodEnd={currentPeriodEndsAt} planName={planName} /> : <Button label="Manage DOIT MAX" variant="secondary" onPress={() => router.push('/pro/manage')} />}</View> :
      isPro && tier === 'pro' ? <View style={styles.actions}><Button label="Open Weekly Review" icon="analytics" onPress={() => router.push('/pro/weekly-review')} />{willRenew === false ? <Cancelled periodEnd={currentPeriodEndsAt} planName={planName} /> : <Button label="Manage DOIT Pro" variant="secondary" onPress={() => router.push('/pro/manage')} />}</View> :
      <Card style={styles.cta}><View style={styles.ctaCopy}><Text variant="eyebrow" color="accent">{isPro ? 'UPGRADE YOUR SYSTEM' : 'START BUILDING'}</Text><Text variant="heading">{isPro ? 'Move from Pro to DOIT MAX' : `Start with ${tierCopy[tier].name}`}</Text><Text variant="caption" color="secondary">{isPro ? 'Stripe will show the exact prorated amount before you confirm.' : `Eligible accounts receive a ${SUBSCRIPTION_TRIAL_DAYS}-day trial before paid billing begins.`}</Text></View>{error ? <Text variant="caption" color="danger">{error}</Text> : null}<Button label={working === 'purchase' ? 'Opening secure Stripe…' : isPro ? 'Upgrade to DOIT MAX' : `Start ${SUBSCRIPTION_TRIAL_DAYS}-day ${tierCopy[tier].name} trial`} disabled={loading || Boolean(working) || !selectedProduct} icon={tier === 'max' ? 'flash' : 'diamond'} onPress={purchase} /></Card>}

    {!web ? <Button label={working === 'restore' ? 'Restoring…' : 'Restore purchases'} disabled={Boolean(working) || !storeReady} variant="ghost" onPress={restore} /> : null}
    {!isMax && !selectedProduct && !loading ? <Card style={styles.unavailable}><Ionicons name="information-circle-outline" color={colors.textMuted} size={20} /><Text variant="caption" color="secondary">{configurationError ?? `${tierCopy[tier].name} ${period} pricing has not been connected yet.`}</Text></Card> : null}
    <Text variant="caption" color="muted" style={styles.legal}>{web ? 'Secure subscription checkout and management by Stripe. Subscriptions renew automatically until cancelled. Usage allowances reset monthly and protect service quality.' : 'Google Play displays the final price, trial eligibility, and renewal terms before confirmation.'}</Text>
  </Screen>;
}

function Cancelled({ periodEnd, planName }: { periodEnd?: string; planName: string }) {
  return <Card style={styles.cancelled}><Ionicons name="checkmark-circle-outline" color={colors.textMuted} size={21} /><View style={styles.flex}><Text variant="label">Subscription cancelled</Text><Text variant="caption" color="muted">{planName} remains available until {periodEnd ? new Date(periodEnd).toLocaleDateString() : 'the current period ends'}.</Text></View></Card>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing.xl, paddingBottom: spacing.xxl, paddingTop: spacing.md }, flex: { flex: 1 },
  hero: { borderColor: colors.accentMuted, borderRadius: radius.xl, borderWidth: 1, gap: spacing.sm, overflow: 'hidden', padding: spacing.lg }, heroBadge: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, heroTitle: { maxWidth: 720 }, active: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, padding: spacing.md },
  notice: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, billingSwitch: { alignSelf: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: spacing.xxs, padding: spacing.xxs }, period: { alignItems: 'center', borderRadius: radius.pill, justifyContent: 'center', minHeight: 42, paddingHorizontal: spacing.md }, periodSelected: { backgroundColor: colors.accentMuted },
  tiers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, tier: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl, borderWidth: 1, flex: 1, gap: spacing.md, minWidth: 290, overflow: 'hidden', padding: spacing.lg }, tierSelected: { borderColor: colors.accent, borderWidth: 2 }, maxTier: { backgroundColor: colors.surfaceElevated }, tierTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, tierIcon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radius.md, height: 48, justifyContent: 'center', width: 48 }, maxIcon: { backgroundColor: colors.accentMuted }, tierName: { fontSize: 25, lineHeight: 30 }, current: { backgroundColor: colors.accentMuted, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  priceRow: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, minHeight: 44 }, saving: { backgroundColor: colors.accentMuted, borderRadius: radius.pill, marginLeft: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs }, features: { gap: spacing.sm }, feature: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  cta: { alignItems: 'stretch', flexDirection: 'column', gap: spacing.md }, ctaCopy: { gap: spacing.xs }, actions: { gap: spacing.sm }, cancelled: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, unavailable: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, legal: { alignSelf: 'center', maxWidth: 760, textAlign: 'center' },
});
