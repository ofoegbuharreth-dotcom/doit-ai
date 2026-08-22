export const SUBSCRIPTION_EVENT_TYPES = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
] as const;

export type SubscriptionEventType = typeof SUBSCRIPTION_EVENT_TYPES[number];
export type WebhookRoute = 'checkout' | 'subscription' | 'invoice' | 'ignored';

export function webhookRoute(type: string): WebhookRoute {
  if (type === 'checkout.session.completed') return 'checkout';
  if (isSubscriptionEvent(type)) return 'subscription';
  if (type === 'invoice.paid' || type === 'invoice.payment_failed') return 'invoice';
  return 'ignored';
}

export function isSubscriptionEvent(type: string): type is SubscriptionEventType {
  return SUBSCRIPTION_EVENT_TYPES.includes(type as SubscriptionEventType);
}

export function stripeCustomerId(subscription: any): string | undefined {
  const customer = subscription?.customer;
  return typeof customer === 'string' ? customer : customer?.id;
}

export function stripeSubscriptionId(value: any): string | undefined {
  return typeof value === 'string' ? value : value?.id;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function resolveExistingAppUser(
  mappedUserId: unknown,
  attemptedUserId: unknown,
  exists: (userId: string) => Promise<boolean>,
) {
  // The persisted Stripe mapping wins over metadata. Metadata is only the
  // bootstrap path for a subscription that has not been saved before.
  for (const candidate of [...new Set([mappedUserId, attemptedUserId].filter(isUuid))]) {
    if (await exists(candidate)) return candidate;
  }
  return undefined;
}

export function normalizedSubscriptionState(eventType: string, stripeStatusValue: unknown) {
  // A deletion event is authoritative even if a fixture or an older Stripe
  // payload does not include the final status value.
  const stripeStatus = eventType === 'customer.subscription.deleted'
    ? 'canceled'
    : String(stripeStatusValue ?? 'incomplete');
  const entitled = stripeStatus === 'active' || stripeStatus === 'trialing';
  const status = stripeStatus === 'trialing'
    ? 'trialing'
    : stripeStatus === 'active'
      ? 'active'
      : stripeStatus === 'canceled'
        ? 'cancelled'
        : 'expired';
  return { entitled, status, stripeStatus } as const;
}

export function subscriptionAccessState(eventType: string, stripeStatusValue: unknown, paidTier: string) {
  const state = normalizedSubscriptionState(eventType, stripeStatusValue);
  return { ...state, plan: state.entitled ? paidTier : 'free' } as const;
}

export function isDuplicateEventClaim(errorCode?: string | null) {
  return errorCode === '23505';
}

export function missingUserAcknowledgement() {
  return {
    status: 200,
    body: { received: true, ignored: 'missing_app_user' } as const,
  } as const;
}
