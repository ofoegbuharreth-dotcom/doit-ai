import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';

import { captureException, track } from '@/services/observability';
import { normalisePlan, PLAN_LIMITS, planLabel, SUBSCRIPTION_TRIAL_DAYS, type DoitPlan } from '@/constants/subscription';
import { loadStoreState, openStoreManagement, purchaseStorePackage, purchasesConfigured, restoreStorePurchases, type StoreProduct } from '@/services/purchases';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { useAuth } from './use-auth';

export type SubscriptionPlan = DoitPlan;
type SubscriptionStatus = 'active' | 'trialing' | 'expired' | 'cancelled';
type SubscriptionState = { plan: SubscriptionPlan; status: SubscriptionStatus; trialEndsAt?: string; currentPeriodEndsAt?: string; managementUrl?: string; willRenew?: boolean; store?: string };
type SubscriptionContextValue = SubscriptionState & {
  loading: boolean; isPro: boolean; isMax: boolean; isPremium: boolean; planName: string; goalLimit: number; aiPlanLimit: number; adaptationLimit: number; trialDaysLeft: number; products: StoreProduct[];
  storeReady: boolean; configurationError?: string;
  startProTrial: (packageId?: string) => Promise<{ error?: string; cancelled?: boolean }>;
  restorePurchases: () => Promise<{ error?: string; restored?: boolean }>;
  cancelSubscription: (reason: string, details?: string) => Promise<{ error?: string; warning?: string; cancelled?: boolean }>;
  refreshSubscription: () => Promise<void>;
};

const DEV_KEY = 'doit:dev-subscription';
const devPreviewEnabled = __DEV__ && process.env.EXPO_PUBLIC_ENABLE_TEST_PRO === 'true';
const initial: SubscriptionState = { plan: 'free', status: 'active' };
const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionState>(initial);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [configurationError, setConfigurationError] = useState<string>();

  const applyEntitlement = useCallback((entitlement?: Awaited<ReturnType<typeof restoreStorePurchases>>) => {
    if (!entitlement?.active) { setSubscription(initial); return; }
    setSubscription({ plan: normalisePlan(entitlement.plan), status: entitlement.status, trialEndsAt: entitlement.status === 'trialing' ? entitlement.expirationDate : undefined, currentPeriodEndsAt: entitlement.expirationDate, managementUrl: entitlement.managementUrl, willRenew: entitlement.willRenew, store: entitlement.store });
  }, []);

  const refreshSubscription = useCallback(async () => {
    if (!user) { setSubscription(initial); setProducts([]); setLoading(false); return; }
    setLoading(true); setConfigurationError(undefined);
    try {
      if (purchasesConfigured) {
        const state = await loadStoreState(user.id);
        setProducts(state.products);
        applyEntitlement(state.entitlement);
      } else if (devPreviewEnabled) {
        const stored = await AsyncStorage.getItem(DEV_KEY);
        setSubscription(stored ? JSON.parse(stored) : initial);
      } else {
        setSubscription(initial);
        setConfigurationError(Platform.OS === 'web' ? 'DOIT web billing is being prepared.' : 'Google Play billing is not configured for this build.');
      }
    } catch (error) {
      captureException(error, { area: 'subscription_refresh' });
      setConfigurationError(error instanceof Error ? error.message : Platform.OS === 'web' ? 'Could not connect to Stripe.' : 'Could not connect to Google Play.');
    } finally { setLoading(false); }
  }, [applyEntitlement, user]);

  useEffect(() => {
    refreshSubscription();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') refreshSubscription(); });
    return () => listener.remove();
  }, [refreshSubscription]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    const channel = supabase.channel(`subscription-entitlement-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${user.id}` }, () => { void refreshSubscription(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refreshSubscription, user]);

  const startProTrial = useCallback(async (packageId?: string) => {
    if (!user) return { error: 'Sign in to choose a DOIT subscription.' };
    if (purchasesConfigured) {
      const result = await purchaseStorePackage(user.id, packageId);
      if (result.entitlement?.active) {
        applyEntitlement(result.entitlement);
        track('subscription purchased', { product_id: result.product ?? null, store: result.entitlement.store ?? 'unknown' });
      }
      return { error: result.error, cancelled: result.cancelled };
    }
    if (devPreviewEnabled) {
      const previewPlan = packageId?.startsWith('max_') ? 'max' : 'pro';
      const next: SubscriptionState = { plan: previewPlan, status: 'trialing', trialEndsAt: new Date(Date.now() + SUBSCRIPTION_TRIAL_DAYS * 86400000).toISOString() };
      await AsyncStorage.setItem(DEV_KEY, JSON.stringify(next)); setSubscription(next); return {};
    }
    return { error: Platform.OS === 'web' ? 'Stripe billing is not configured yet.' : 'Add the RevenueCat public Android SDK key to the release environment.' };
  }, [applyEntitlement, user]);

  const restorePurchases = useCallback(async () => {
    if (!user) return { error: 'Sign in before restoring purchases.' };
    if (!purchasesConfigured) return { error: Platform.OS === 'web' ? 'Stripe billing is not configured yet.' : 'Google Play billing is not configured for this build.' };
    try {
      const entitlement = await restoreStorePurchases(user.id);
      applyEntitlement(entitlement);
      track('subscription restored', { restored: entitlement.active, store: entitlement.store ?? 'unknown' });
      return entitlement.active ? { restored: true } : { error: Platform.OS === 'web' ? 'No active DOIT subscription was found for this account.' : 'No active DOIT purchase was found for this Google account.' };
    } catch (error) { captureException(error, { area: 'purchase_restore' }); return { error: error instanceof Error ? error.message : 'Could not restore purchases.' }; }
  }, [applyEntitlement, user]);

  const cancelSubscription = useCallback(async (reason: string, details?: string) => {
    if (!user) return { error: 'Sign in to manage your subscription.' };
    let warning: string | undefined;
    if (isSupabaseConfigured) {
      const { error } = await supabase.rpc('submit_subscription_cancellation_feedback', { p_reason: reason, p_details: details?.trim() || null });
      if (error) warning = `Your feedback could not be saved, but you can still manage the subscription in ${Platform.OS === 'web' ? 'Stripe' : 'Google Play'}.`;
    }
    try {
      const management = await openStoreManagement(subscription.managementUrl);
      if (management?.cancelled) {
        await refreshSubscription();
        return { warning, cancelled: true };
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Could not open subscription management.', warning };
    }
    track('subscription management opened', { reason, store: subscription.store ?? 'unknown' });
    return { warning };
  }, [refreshSubscription, subscription.managementUrl, subscription.store, user]);

  const trialEnds = subscription.trialEndsAt ? new Date(subscription.trialEndsAt).getTime() : 0;
  const trialActive = subscription.status === 'trialing' && trialEnds > Date.now();
  const isPro = subscription.plan !== 'free' && (subscription.status === 'active' || trialActive);
  const isMax = subscription.plan === 'max' && isPro;
  const limits = PLAN_LIMITS[isPro ? subscription.plan : 'free'];
  const value = useMemo(() => ({ ...subscription, loading, isPro, isMax, isPremium: isMax, planName: planLabel(isPro ? subscription.plan : 'free'), goalLimit: limits.activeGoals, aiPlanLimit: limits.aiPlansPerMonth, adaptationLimit: limits.adaptationsPerMonth, trialDaysLeft: trialActive ? Math.max(1, Math.ceil((trialEnds - Date.now()) / 86400000)) : 0, products, storeReady: purchasesConfigured, configurationError, startProTrial, restorePurchases, cancelSubscription, refreshSubscription }), [cancelSubscription, configurationError, isMax, isPro, limits, loading, products, refreshSubscription, restorePurchases, startProTrial, subscription, trialActive, trialEnds]);
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error('useSubscription must be used within SubscriptionProvider');
  return value;
}
