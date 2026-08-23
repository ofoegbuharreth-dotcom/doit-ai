import { describe, expect, it } from 'vitest';

import { isAuthCallbackUrl, isPasswordRecoveryUrl } from './auth-url';

describe('authentication redirect recognition', () => {
  it('preserves the session while a browser OAuth callback is completing', () => {
    expect(isAuthCallbackUrl('https://doit-ai.pages.dev/auth/callback?provider=google&code=abc')).toBe(true);
    expect(isAuthCallbackUrl('doit://auth/callback?provider=google&code=abc')).toBe(true);
  });
  it('does not confuse ordinary routes with auth returns', () => {
    expect(isAuthCallbackUrl('https://doit-ai.pages.dev/home')).toBe(false);
    expect(isPasswordRecoveryUrl('https://doit-ai.pages.dev/auth/reset-password?code=abc')).toBe(true);
  });
});
