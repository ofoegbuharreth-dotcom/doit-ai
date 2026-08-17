import { Linking, Platform } from 'react-native';

import { isSupabaseConfigured, stripeReturnSessionKey, supabase } from '@/services/supabase';
import { normalisePlan, type DoitPlan } from '@/constants/subscription';

export const revenueCatEntitlementId = 'doit_pro';
export const purchasesConfigured = isSupabaseConfigured;

export type StoreProduct = {
  id: string;
  productId: string;
  title: string;
  price: string;
  period: 'monthly' | 'annual' | 'other';
  monthlyEquivalent?: string;
  tier: Exclude<DoitPlan, 'free'>;
};

export type StoreEntitlement = {
  active: boolean;
  status: 'active' | 'trialing' | 'expired';
  expirationDate?: string;
  managementUrl?: string;
  productId?: string;
  willRenew: boolean;
  store?: string;
  plan: DoitPlan;
};

type SubscriptionRow = {
  plan: 'free' | 'pro' | 'premium' | 'max';
  status: 'active' | 'trialing' | 'expired' | 'cancelled';
  trial_ends_at?: string | null;
  current_period_ends_at?: string | null;
  price_id?: string | null;
  cancel_at_period_end?: boolean | null;
  provider?: string | null;
};

async function edgeFunctionMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== 'undefined' && context instanceof Response) {
      try {
        const body = await context.clone().json() as { error?: string };
        if (body.error) return body.error;
      } catch { /* Use the friendly fallback below. */ }
    }
  }
  const message = error instanceof Error ? error.message : '';
  return message && !message.toLowerCase().includes('edge function returned') ? message : fallback;
}

function entitlementFromRow(row?: SubscriptionRow | null): StoreEntitlement {
  const plan = normalisePlan(row?.plan);
  const active = Boolean(row && plan !== 'free' && (row.status === 'active' || row.status === 'trialing'));
  return {
    active,
    status: row?.status === 'trialing' ? 'trialing' : row?.status === 'active' ? 'active' : 'expired',
    expirationDate: row?.status === 'trialing' ? row.trial_ends_at ?? undefined : row?.current_period_ends_at ?? undefined,
    productId: row?.price_id ?? undefined,
    willRenew: active && !row?.cancel_at_period_end,
    store: row?.provider ?? 'stripe',
    plan: active ? plan : 'free',
  };
}

export async function configurePurchases() {
  return purchasesConfigured;
}

export async function loadStoreState(userId: string) {
  if (!purchasesConfigured) return { entitlement: undefined, products: [] as StoreProduct[] };
  const [plansResult, statusResult, subscriptionResult] = await Promise.all([
    supabase.functions.invoke<{ products?: StoreProduct[]; error?: string }>('stripe-billing', { body: { action: 'plans' } }),
    supabase.functions.invoke<{ subscription?: SubscriptionRow | null; error?: string }>('stripe-billing', { body: { action: 'status' } }),
    supabase.from('subscriptions').select('plan,status,trial_ends_at,current_period_ends_at,price_id,cancel_at_period_end,provider').eq('user_id', userId).maybeSingle(),
  ]);
  if (subscriptionResult.error) throw subscriptionResult.error;
  if (plansResult.error) throw new Error(await edgeFunctionMessage(plansResult.error, 'Could not load Stripe plans.'));
  if (plansResult.data?.error && !plansResult.data.products?.length) throw new Error(plansResult.data.error);
  const current = !statusResult.error && statusResult.data?.subscription !== undefined ? statusResult.data.subscription : subscriptionResult.data as SubscriptionRow | null;
  return { entitlement: entitlementFromRow(current), products: plansResult.data?.products ?? [] };
}

export async function purchaseStorePackage(_userId: string, packageId?: string) {
  try {
    if (!packageId || !/^(pro|max)_(monthly|annual)$/.test(packageId)) return { error: 'Choose a DOIT Pro or DOIT MAX plan.' };
    const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>('stripe-billing', { body: { action: 'checkout', packageId } });
    if (error) throw new Error(await edgeFunctionMessage(error, 'Stripe could not open checkout.'));
    if (data?.error) return { error: data.error };
    if (!data?.url) return { error: 'Stripe did not return a checkout link.' };
    await Linking.openURL(data.url);
    return { product: packageId, redirected: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Stripe could not open checkout.' };
  }
}

export async function restoreStorePurchases(userId: string): Promise<StoreEntitlement> {
  const statusResult = await supabase.functions.invoke<{ subscription?: SubscriptionRow | null }>('stripe-billing', { body: { action: 'status' } });
  if (!statusResult.error && statusResult.data?.subscription !== undefined) return entitlementFromRow(statusResult.data.subscription);
  const { data, error } = await supabase.from('subscriptions').select('plan,status,trial_ends_at,current_period_ends_at,price_id,cancel_at_period_end,provider').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return entitlementFromRow(data as SubscriptionRow | null);
}

export async function openStoreManagement() {
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string; cancelled?: boolean }>('stripe-billing', { body: { action: 'portal' } });
  if (error) throw new Error(await edgeFunctionMessage(error, 'Could not open Stripe subscription management. Please refresh and try again.'));
  if (data?.error) throw new Error(data.error);
  if (data?.cancelled) return { cancelled: true };
  if (!data?.url) throw new Error('Stripe did not return a customer portal link.');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Remember-me-off sessions are deliberately cleared on a fresh app load.
    // This tab-scoped marker lets the current authenticated session survive
    // only the Stripe round-trip; it disappears when the tab is closed.
    try { window.sessionStorage.setItem(stripeReturnSessionKey, 'true'); } catch { /* Continue without the convenience marker. */ }
    window.location.assign(data.url);
    return { cancelled: false };
  }
  await Linking.openURL(data.url);
  return { cancelled: false };
}

export async function confirmStripeCancellation() {
  const { data, error } = await supabase.functions.invoke<{ confirmed?: boolean; emailSent?: boolean; error?: string }>('stripe-billing', { body: { action: 'confirm-cancellation' } });
  if (error) throw new Error(await edgeFunctionMessage(error, 'DOIT could not confirm the Stripe cancellation.'));
  if (data?.error) throw new Error(data.error);
  if (!data?.confirmed) throw new Error('Stripe has not confirmed this cancellation.');
  return { emailSent: Boolean(data.emailSent) };
}
