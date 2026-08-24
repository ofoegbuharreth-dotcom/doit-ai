import { describe, expect, it } from 'vitest';

import {
  isDuplicateEventClaim,
  isSubscriptionEvent,
  isUuid,
  missingUserAcknowledgement,
  normalizedSubscriptionState,
  resolveExistingAppUser,
  shouldNotifyCancellation,
  subscriptionAccessState,
  stripeCustomerId,
  webhookRoute,
} from './logic';

describe('Stripe webhook subscription logic', () => {
  it.each([
    ['customer.subscription.created', 'active', true, 'active'],
    ['customer.subscription.updated', 'active', true, 'active'],
    ['customer.subscription.updated', 'past_due', false, 'expired'],
    ['customer.subscription.trial_will_end', 'trialing', true, 'trialing'],
  ])('normalizes %s with %s', (eventType, stripeStatus, entitled, status) => {
    expect(normalizedSubscriptionState(eventType, stripeStatus)).toMatchObject({ entitled, status });
  });

  it('always downgrades a deleted subscription to free/cancelled state', () => {
    expect(subscriptionAccessState('customer.subscription.deleted', 'active', 'max')).toEqual({
      entitled: false,
      plan: 'free',
      status: 'cancelled',
      stripeStatus: 'canceled',
    });
  });

  it('recognizes every supported subscription lifecycle event', () => {
    expect(isSubscriptionEvent('customer.subscription.created')).toBe(true);
    expect(isSubscriptionEvent('customer.subscription.updated')).toBe(true);
    expect(isSubscriptionEvent('customer.subscription.deleted')).toBe(true);
    expect(isSubscriptionEvent('customer.subscription.trial_will_end')).toBe(true);
    expect(isSubscriptionEvent('checkout.session.completed')).toBe(false);
  });

  it('extracts Stripe customer IDs from expanded and unexpanded payloads', () => {
    expect(stripeCustomerId({ customer: 'cus_123' })).toBe('cus_123');
    expect(stripeCustomerId({ customer: { id: 'cus_456' } })).toBe('cus_456');
  });

  it('rejects malformed user IDs before querying the database', () => {
    expect(isUuid('7f266a1f-f6f2-4fa8-82db-874cd9d42df0')).toBe(true);
    expect(isUuid('not-a-user-id')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });

  it('prefers a verified server-side Stripe mapping over metadata', async () => {
    const mapped = '7f266a1f-f6f2-4fa8-82db-874cd9d42df0';
    const metadata = '138011a2-fbce-447a-932b-a846359f8d2e';
    await expect(resolveExistingAppUser(mapped, metadata, async () => true)).resolves.toBe(mapped);
  });

  it('returns no user for a deleted app account and never accepts malformed metadata', async () => {
    const checked: string[] = [];
    const result = await resolveExistingAppUser(undefined, 'not-a-user-id', async (userId) => {
      checked.push(userId);
      return false;
    });
    expect(result).toBeUndefined();
    expect(checked).toEqual([]);
  });

  it('treats repeated event claims as successful duplicates', () => {
    expect(isDuplicateEventClaim('23505')).toBe(true);
    expect(isDuplicateEventClaim('42501')).toBe(false);
  });

  it.each([
    ['checkout.session.completed', 'checkout'],
    ['customer.subscription.created', 'subscription'],
    ['customer.subscription.updated', 'subscription'],
    ['customer.subscription.deleted', 'subscription'],
    ['customer.subscription.trial_will_end', 'subscription'],
    ['invoice.paid', 'invoice'],
    ['invoice.payment_failed', 'invoice'],
  ])('routes %s through the expected processing path', (eventType, route) => {
    expect(webhookRoute(eventType)).toBe(route);
  });

  it('uses a stable successful acknowledgement for a missing app user', () => {
    expect(missingUserAcknowledgement()).toEqual({
      status: 200,
      body: { received: true, ignored: 'missing_app_user' },
    });
  });

  it('notifies for every confirmed cancellation until delivery is recorded', () => {
    expect(shouldNotifyCancellation(null, true, 'trialing')).toBe(true);
    expect(shouldNotifyCancellation(null, false, 'canceled')).toBe(true);
    expect(shouldNotifyCancellation(null, false, 'active')).toBe(false);
    expect(shouldNotifyCancellation('2026-08-24T20:00:00.000Z', true, 'trialing')).toBe(false);
  });
});
