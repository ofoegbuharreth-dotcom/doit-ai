// @ts-nocheck -- This file runs in Supabase's Deno Edge runtime, not Expo.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { notifyOwnerOfStripeCancellation } from '../_shared/cancellation-notification.ts';
import { json, stripeRequest } from '../_shared/stripe.ts';

function tierFromSubscription(stripeSubscription: any) {
  const priceId = stripeSubscription?.items?.data?.[0]?.price?.id;
  const maxIds = [Deno.env.get('STRIPE_MAX_MONTHLY_PRICE_ID'), Deno.env.get('STRIPE_MAX_ANNUAL_PRICE_ID')].filter(Boolean);
  const proIds = [Deno.env.get('STRIPE_MONTHLY_PRICE_ID'), Deno.env.get('STRIPE_ANNUAL_PRICE_ID')].filter(Boolean);
  if (maxIds.includes(priceId)) return 'max';
  if (proIds.includes(priceId)) return 'pro';
  return stripeSubscription?.metadata?.doit_plan === 'max' ? 'max' : 'pro';
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

async function verifySignature(payload: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const parts = signature.split(',').map((item) => item.split('='));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || !signatures.length || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  const expected = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return signatures.some((candidate) => timingSafeEqual(candidate, expected));
}

function subscriptionPeriodEnd(subscription: any) {
  const seconds = subscription?.current_period_end ?? subscription?.items?.data?.[0]?.current_period_end;
  return seconds ? new Date(Number(seconds) * 1000).toISOString() : null;
}

function invoiceSubscriptionId(invoice: any) {
  const value = invoice?.subscription ?? invoice?.parent?.subscription_details?.subscription;
  return typeof value === 'string' ? value : value?.id;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const payload = await request.text();
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret || !(await verifySignature(payload, request.headers.get('Stripe-Signature'), webhookSecret))) return json({ error: 'Invalid Stripe signature.' }, 400);

  const event = JSON.parse(payload);
  if (Deno.env.get('STRIPE_LIVE_MODE') === 'true' && !event.livemode) return json({ received: true, ignored: 'test_mode_event' });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error: claimError } = await admin.from('stripe_webhook_events').insert({ event_id: event.id, event_type: event.type });
  if (claimError?.code === '23505') return json({ received: true, duplicate: true });
  if (claimError) return json({ error: claimError.message }, 500);

  const syncSubscription = async (stripeSubscription: any, fallbackUserId?: string) => {
    let userId = stripeSubscription?.metadata?.user_id ?? fallbackUserId;
    if (!userId && stripeSubscription?.customer) {
      const customerId = typeof stripeSubscription.customer === 'string' ? stripeSubscription.customer : stripeSubscription.customer.id;
      const { data } = await admin.from('subscriptions').select('user_id').eq('provider_customer_id', customerId).maybeSingle();
      userId = data?.user_id;
    }
    if (!userId) throw new Error(`No DOIT AI user was attached to Stripe subscription ${stripeSubscription?.id}.`);

    const { data: previous } = await admin.from('subscriptions').select('plan, status, cancel_at_period_end, cancellation_notified_at').eq('user_id', userId).maybeSingle();
    const stripeStatus = String(stripeSubscription.status ?? 'incomplete');
    const entitled = stripeStatus === 'active' || stripeStatus === 'trialing';
    const status = stripeStatus === 'trialing' ? 'trialing' : stripeStatus === 'active' ? 'active' : stripeStatus === 'canceled' ? 'cancelled' : 'expired';
    const customerId = typeof stripeSubscription.customer === 'string' ? stripeSubscription.customer : stripeSubscription.customer?.id;
    const priceId = stripeSubscription?.items?.data?.[0]?.price?.id ?? null;
    const trialEndsAt = stripeSubscription?.trial_end ? new Date(Number(stripeSubscription.trial_end) * 1000).toISOString() : null;
    const trialStartedAt = stripeSubscription?.trial_start ? new Date(Number(stripeSubscription.trial_start) * 1000).toISOString() : null;
    const cancelAtPeriodEnd = Boolean(stripeSubscription.cancel_at_period_end);
    const wasScheduledCancel = Boolean(previous?.cancel_at_period_end);
    const wasCancelled = previous?.status === 'cancelled' || previous?.status === 'expired';
    const becameScheduledCancel = cancelAtPeriodEnd && !wasScheduledCancel;
    const immediateCancel = stripeStatus === 'canceled' && !wasCancelled && !wasScheduledCancel;
    const shouldNotifyCancellation = !previous?.cancellation_notified_at && (becameScheduledCancel || immediateCancel);

    const update: Record<string, unknown> = {
      user_id: userId,
      plan: entitled ? tierFromSubscription(stripeSubscription) : 'free',
      status,
      provider: 'stripe',
      provider_customer_id: customerId,
      provider_subscription_id: stripeSubscription.id,
      price_id: priceId,
      trial_started_at: trialStartedAt,
      trial_ends_at: trialEndsAt,
      current_period_ends_at: subscriptionPeriodEnd(stripeSubscription),
      cancel_at_period_end: cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    };
    if (entitled && !cancelAtPeriodEnd) update.cancellation_notified_at = null;
    if (stripeStatus === 'trialing') {
      const { data: current } = await admin.from('subscriptions').select('trial_use_count, provider_subscription_id').eq('user_id', userId).maybeSingle();
      if (current?.provider_subscription_id !== stripeSubscription.id) update.trial_use_count = Math.min(2, Number(current?.trial_use_count ?? 0) + 1);
    }
    const { error } = await admin.from('subscriptions').upsert(update, { onConflict: 'user_id' });
    if (error) throw error;

    if (shouldNotifyCancellation) await notifyOwnerOfStripeCancellation(admin, userId, stripeSubscription, previous?.plan ?? tierFromSubscription(stripeSubscription));
  };

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (subscriptionId) await syncSubscription(await stripeRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, undefined, 'GET'), session.client_reference_id ?? session.metadata?.user_id);
    } else if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      const eventSubscription = event.data.object;
      try {
        const latest = await stripeRequest(`/subscriptions/${encodeURIComponent(eventSubscription.id)}`, undefined, 'GET');
        await syncSubscription(latest);
      } catch (error) {
        if (event.type !== 'customer.subscription.deleted') throw error;
        await syncSubscription(eventSubscription);
      }
    } else if (['invoice.paid', 'invoice.payment_failed'].includes(event.type)) {
      const subscriptionId = invoiceSubscriptionId(event.data.object);
      if (subscriptionId) await syncSubscription(await stripeRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, undefined, 'GET'));
    }
    return json({ received: true });
  } catch (error) {
    await admin.from('stripe_webhook_events').delete().eq('event_id', event.id);
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Webhook processing failed.' }, 500);
  }
});
