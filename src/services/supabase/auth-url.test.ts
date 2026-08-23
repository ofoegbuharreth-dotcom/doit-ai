import { describe, expect, it } from 'vitest';

import { desktopAuthDeepLink, isAuthCallbackUrl, isPasswordRecoveryUrl } from './auth-url';

describe('auth URL helpers', () => {
  it('recognises callback and recovery URLs', () => {
    expect(isAuthCallbackUrl('doit://auth/callback?code=abc')).toBe(true);
    expect(isPasswordRecoveryUrl('https://doit-ai.pages.dev/auth/reset-password')).toBe(true);
  });

  it('hands only expected OAuth values back to the desktop app', () => {
    const result = desktopAuthDeepLink('https://doit-ai.pages.dev/auth/callback?desktop=1&provider=google&code=secure-code&unexpected=drop-me');
    expect(result).toBe('doit://auth/callback?code=secure-code&provider=google');
  });

  it('preserves safe provider errors for the desktop callback UI', () => {
    const result = desktopAuthDeepLink('https://doit-ai.pages.dev/auth/callback?desktop=1&error=access_denied&error_description=Cancelled');
    expect(result).toContain('error=access_denied');
    expect(result).toContain('error_description=Cancelled');
    expect(result).not.toContain('desktop=1');
  });
});
