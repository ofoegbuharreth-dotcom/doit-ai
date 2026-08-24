import { afterEach, describe, expect, it, vi } from 'vitest';

import { sendCancellationOwnerEmail } from './cancellation-email';

const payload = {
  userEmail: 'customer@example.com',
  userId: '7f266a1f-f6f2-4fa8-82db-874cd9d42df0',
  previousPlan: 'pro',
  reason: 'Cancelled in Stripe',
  details: 'Trial cancelled.',
  submittedAt: '2026-08-24T20:00:00.000Z',
  source: 'stripe_webhook' as const,
  idempotencyKey: 'cancel-sub_123',
};

function configureEmail() {
  vi.stubGlobal('Deno', {
    env: {
      get: (name: string) => ({
        RESEND_API_KEY: 're_test_value',
        FEEDBACK_TO_EMAIL: 'owner@example.com',
        FEEDBACK_FROM_EMAIL: 'DOIT AI <updates@doit.example>',
      })[name],
    },
  });
}

describe('cancellation owner email', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('falls back to the Resend sandbox sender and records provider acceptance', async () => {
    configureEmail();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Domain is not verified.' }), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'email_123' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendCancellationOwnerEmail(payload)).resolves.toEqual({ id: 'email_123' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const fallbackRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(fallbackRequest.body)).from).toBe('DOIT AI <onboarding@resend.dev>');
  });

  it('marks Resend rejections as retryable provider failures', async () => {
    configureEmail();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'API key is invalid.' }), { status: 401 })));

    await expect(sendCancellationOwnerEmail(payload)).rejects.toThrow('Provider: API key is invalid.');
  });
});
