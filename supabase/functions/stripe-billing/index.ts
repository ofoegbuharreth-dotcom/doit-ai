// @ts-nocheck -- This file runs in Supabase's Deno Edge runtime, not Expo.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { notifyOwnerOfStripeCancellation } from '../_shared/cancellation-notification.ts';
import { allowedAppUrl, corsHeaders, formatPrice, json, pricePeriod, stripeRequest } from '../_shared/stripe.ts';
import { stripeTrialParameters } from './trial.ts';

type PaidTier = 'pro' | 'max';
type Interval = 'monthly' | 'annual';

const priceIds = () => ({
  pro_monthly: Deno.env.get('STRIPE_MONTHLY_PRICE_ID'),
  pro_annual: Deno.env.get('STRIPE_ANNUAL_PRICE_ID'),
  max_monthly: Deno.env.get('STRIPE_MAX_MONTHLY_PRICE_ID'),
  max_annual: Deno.env.get('STRIPE_MAX_ANNUAL_PRICE_ID'),
});

function tierFromPrice(priceId?: string | null): PaidTier | undefined {
  const ids = priceIds();
  if (priceId && (priceId === ids.max_monthly || priceId === ids.max_annual)) return 'max';
  if (priceId && (priceId === ids.pro_monthly || priceId === ids.pro_annual)) return 'pro';
  return undefined;
}

function periodEnd(subscription: any) {
  const seconds = subscription?.current_period_end ?? subscription?.items?.data?.[0]?.current_period_end;
  return seconds ? new Date(Number(seconds) * 1000).toISOString() : null;
}

function subscriptionUpdate(userId: string, stripeSubscription: any) {
  const stripeStatus = String(stripeSubscription.status ?? 'incomplete');
  const entitled = stripeStatus === 'active' || stripeStatus === 'trialing';
  const priceId = stripeSubscription?.items?.data?.[0]?.price?.id ?? null;
  const metadataTier = stripeSubscription?.metadata?.doit_plan;
  const tier = tierFromPrice(priceId) ?? (metadataTier === 'max' ? 'max' : 'pro');
  return {
    user_id: userId,
    plan: entitled ? tier : 'free',
    status: stripeStatus === 'trialing' ? 'trialing' : stripeStatus === 'active' ? 'active' : stripeStatus === 'canceled' ? 'cancelled' : 'expired',
    provider: 'stripe',
    provider_customer_id: typeof stripeSubscription.customer === 'string' ? stripeSubscription.customer : stripeSubscription.customer?.id,
    provider_subscription_id: stripeSubscription.id,
    price_id: priceId,
    trial_started_at: stripeSubscription?.trial_start ? new Date(Number(stripeSubscription.trial_start) * 1000).toISOString() : null,
    trial_ends_at: stripeSubscription?.trial_end ? new Date(Number(stripeSubscription.trial_end) * 1000).toISOString() : null,
    current_period_ends_at: periodEnd(stripeSubscription),
    cancel_at_period_end: Boolean(stripeSubscription.cancel_at_period_end),
    updated_at: new Date().toISOString(),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Sign in to manage your DOIT subscription.' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Your session expired. Please sign in again.' }, 401);

    const admin = createClient(url, serviceKey);
    const body = await request.json().catch(() => ({}));
    const action = body?.action;
    const desktop = body?.desktop === true;
    const ids = priceIds();

    const appReturnUrl = (route: 'pro' | 'home', params: string) => desktop
      ? `${(Deno.env.get('APP_URL') ?? 'https://doit-ai.pages.dev').replace(/\/$/, '')}/desktop-return?route=${route}&${params}`
      : `${allowedAppUrl(request)}/${route}?${params}`;

    if (action === 'plans') {
      const entries = Object.entries(ids).filter((entry): entry is [keyof typeof ids, string] => Boolean(entry[1]));
      if (!entries.length) return json({ products: [], error: 'Stripe prices have not been configured yet.' });
      const prices = await Promise.all(entries.map(async ([packageId, id]) => {
        const [tier, period] = packageId.split('_') as [PaidTier, Interval];
        const price = await stripeRequest(`/prices/${encodeURIComponent(id)}`, { 'expand[]': 'product' }, 'GET');
        const amount = Number(price.unit_amount ?? 0) / 100;
        const monthlyAmount = period === 'annual' ? amount / 12 : undefined;
        return {
          id: packageId,
          productId: price.id,
          title: `${tier === 'max' ? 'MAX' : 'Pro'} ${period === 'annual' ? 'Annual' : 'Monthly'}`,
          tier,
          price: formatPrice(price),
          period: pricePeriod(price),
          livemode: Boolean(price.livemode),
          monthlyEquivalent: monthlyAmount === undefined ? undefined : new Intl.NumberFormat('en-GB', { style: 'currency', currency: String(price.currency ?? 'gbp').toUpperCase() }).format(monthlyAmount),
        };
      }));
      if (Deno.env.get('STRIPE_LIVE_MODE') === 'true' && prices.some((price: any) => !price.livemode)) throw new Error('DOIT billing is configured with a test Stripe price. Add live price IDs before accepting payments.');
      return json({ products: prices, billingMode: Deno.env.get('STRIPE_LIVE_MODE') === 'true' ? 'live' : 'test' });
    }

    const { data: subscription } = await admin.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle();

    if (action === 'status') {
      if (subscription?.provider !== 'stripe' || !subscription?.provider_subscription_id) return json({ subscription });
      const stripeSubscription = await stripeRequest(`/subscriptions/${encodeURIComponent(subscription.provider_subscription_id)}`, undefined, 'GET');
      const update = subscriptionUpdate(user.id, stripeSubscription);
      const { data: synced, error: syncError } = await admin.from('subscriptions').upsert(update, { onConflict: 'user_id' }).select('*').single();
      if (syncError) throw syncError;
      const cancellationConfirmed = Boolean(update.cancel_at_period_end) || update.status === 'cancelled';
      if (cancellationConfirmed && !subscription.cancellation_notified_at) {
        try {
          await notifyOwnerOfStripeCancellation(admin, user.id, stripeSubscription, subscription.plan);
        } catch (emailError) {
          // Keep the signed-in app usable. The notification remains unmarked so
          // the next status refresh retries it, while the webhook also retries.
          console.error('Cancellation email reconciliation failed:', emailError instanceof Error ? emailError.message : emailError);
        }
      }
      return json({ subscription: synced });
    }

    if (action === 'confirm-cancellation') {
      if (subscription?.provider !== 'stripe' || !subscription?.provider_subscription_id) {
        return json({ error: 'No Stripe subscription was found for this account.' }, 404);
      }
      const stripeSubscription = await stripeRequest(`/subscriptions/${encodeURIComponent(subscription.provider_subscription_id)}`, undefined, 'GET');
      const update = subscriptionUpdate(user.id, stripeSubscription);
      const cancellationConfirmed = Boolean(update.cancel_at_period_end) || update.status === 'cancelled';
      if (!cancellationConfirmed) return json({ confirmed: false, error: 'Stripe has not confirmed this cancellation.' }, 409);

      const { error: syncError } = await admin.from('subscriptions').upsert(update, { onConflict: 'user_id' });
      if (syncError) throw syncError;
      // Cancellation is already authoritative in Stripe. Email delivery is a
      // separate retryable side effect and must not turn a successful billing
      // operation into a misleading HTTP 500 response.
      try {
        const notification = await notifyOwnerOfStripeCancellation(admin, user.id, stripeSubscription, subscription.plan);
        return json({ confirmed: true, emailSent: Boolean(notification?.sent || notification?.duplicate) });
      } catch (emailError) {
        console.error('Cancellation confirmed but owner email delivery failed:', emailError instanceof Error ? emailError.message : emailError);
        return json({ confirmed: true, emailSent: false, emailError: 'The owner notification is queued for another attempt.' });
      }
    }

    if (action === 'checkout') {
      const packageId = String(body?.packageId ?? '');
      if (!['pro_monthly', 'pro_annual', 'max_monthly', 'max_annual'].includes(packageId)) return json({ error: 'Choose a DOIT Pro or DOIT MAX plan.' }, 400);
      const [tier, interval] = packageId.split('_') as [PaidTier, Interval];
      const priceId = ids[packageId as keyof typeof ids];
      if (!priceId) return json({ error: `The DOIT ${tier === 'max' ? 'MAX' : 'Pro'} ${interval} Stripe price is not configured.` }, 503);
      if (subscription?.plan !== 'free' && ['active', 'trialing'].includes(subscription?.status)) {
        const currentTier = subscription.plan === 'max' || subscription.plan === 'premium' ? 'max' : 'pro';
        if (currentTier === 'max' || tier === 'pro') return json({ error: `${currentTier === 'max' ? 'DOIT MAX' : 'DOIT Pro'} is already active. Open Manage subscription instead.` }, 409);

        const stripeSubscription = await stripeRequest(`/subscriptions/${encodeURIComponent(subscription.provider_subscription_id)}`, undefined, 'GET');
        const itemId = stripeSubscription?.items?.data?.[0]?.id;
        if (!itemId) throw new Error('Stripe could not find the active subscription item.');
        const appUrl = appReturnUrl('pro', 'checkout=success');
        const upgrade = await stripeRequest('/billing_portal/sessions', {
          customer: subscription.provider_customer_id,
          return_url: appUrl,
          'flow_data[type]': 'subscription_update_confirm',
          'flow_data[subscription_update_confirm][subscription]': subscription.provider_subscription_id,
          'flow_data[subscription_update_confirm][items][0][id]': itemId,
          'flow_data[subscription_update_confirm][items][0][price]': priceId,
          'flow_data[subscription_update_confirm][items][0][quantity]': 1,
          'flow_data[after_completion][type]': 'redirect',
          'flow_data[after_completion][redirect][return_url]': appUrl,
        });
        return json({ url: upgrade.url, upgrade: true });
      }

      let customerId = subscription?.provider === 'stripe' ? subscription.provider_customer_id : null;
      if (!customerId) {
        const customer = await stripeRequest('/customers', {
          email: user.email,
          'metadata[user_id]': user.id,
          'metadata[app]': 'DOIT AI',
        });
        customerId = customer.id;
        const { error: saveError } = await admin.from('subscriptions').upsert({
          user_id: user.id,
          provider: 'stripe',
          provider_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (saveError) throw saveError;
      }

      const successUrl = appReturnUrl('pro', 'checkout=success&session_id={CHECKOUT_SESSION_ID}');
      const cancelUrl = appReturnUrl('pro', 'checkout=cancelled');
      const session = await stripeRequest('/checkout/sessions', {
        mode: 'subscription',
        integration_identifier: 'doitweb_rkqmtzpa',
        customer: customerId,
        client_reference_id: user.id,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': 1,
        allow_promotion_codes: true,
        success_url: successUrl,
        cancel_url: cancelUrl,
        'metadata[user_id]': user.id,
        'metadata[doit_plan]': tier,
        'subscription_data[metadata][user_id]': user.id,
        'subscription_data[metadata][app]': 'DOIT AI',
        'subscription_data[metadata][doit_plan]': tier,
        ...stripeTrialParameters(subscription?.trial_use_count),
      });
      if (Deno.env.get('STRIPE_LIVE_MODE') === 'true' && !session.livemode) throw new Error('Stripe returned a test checkout while live billing is required.');
      return json({ url: session.url });
    }

    if (action === 'portal') {
      if (!subscription?.provider_customer_id || subscription?.provider !== 'stripe') return json({ error: 'No Stripe subscription was found for this account.' }, 404);
      if (!subscription?.provider_subscription_id) return json({ error: 'No active Stripe subscription was found for this account.' }, 404);
      const stripeSubscription = await stripeRequest(`/subscriptions/${encodeURIComponent(subscription.provider_subscription_id)}`, undefined, 'GET');
      const update = subscriptionUpdate(user.id, stripeSubscription);
      const { error: syncError } = await admin.from('subscriptions').upsert(update, { onConflict: 'user_id' });
      if (syncError) throw syncError;
      if (update.cancel_at_period_end || update.status === 'cancelled') return json({ cancelled: true });
      const homeUrl = appReturnUrl('home', 'stripe_return=cancelled');
      const session = await stripeRequest('/billing_portal/sessions', {
        customer: subscription.provider_customer_id,
        return_url: homeUrl,
        'flow_data[type]': 'subscription_cancel',
        'flow_data[subscription_cancel][subscription]': subscription.provider_subscription_id,
        'flow_data[after_completion][type]': 'redirect',
        'flow_data[after_completion][redirect][return_url]': homeUrl,
      });
      return json({ url: session.url });
    }

    return json({ error: 'Unknown billing action.' }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Stripe billing failed.' }, 500);
  }
});
