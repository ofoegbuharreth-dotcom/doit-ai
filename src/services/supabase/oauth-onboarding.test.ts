import { describe, expect, it } from 'vitest';

import { shouldCreatePasswordAfterGoogleSignup } from './oauth-onboarding';

function session(overrides: Record<string, unknown> = {}) {
  const createdAt = '2026-08-24T20:00:00.000Z';
  return {
    user: {
      created_at: createdAt,
      last_sign_in_at: createdAt,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: {},
      identities: [{ provider: 'google' }],
      ...overrides,
    },
  } as never;
}

describe('Google signup password onboarding', () => {
  it('prompts only a fresh account created from the signup button', () => {
    expect(shouldCreatePasswordAfterGoogleSignup(session(), 'signup')).toBe(true);
    expect(shouldCreatePasswordAfterGoogleSignup(session(), 'login')).toBe(false);
  });

  it('does not interrupt an existing Google account', () => {
    expect(shouldCreatePasswordAfterGoogleSignup(session({ last_sign_in_at: '2026-08-25T20:00:00.000Z' }), 'signup')).toBe(false);
  });

  it('does not ask twice after a password was created', () => {
    expect(shouldCreatePasswordAfterGoogleSignup(session({ user_metadata: { doit_password_created_at: '2026-08-24T20:01:00.000Z' } }), 'signup')).toBe(false);
  });
});
