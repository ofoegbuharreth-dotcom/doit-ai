export function isPasswordRecoveryUrl(url: string | null | undefined) {
  if (!url) return false;
  return url.includes('/auth/reset-password') || /(?:[?#&])type=recovery(?:[&#]|$)/.test(url);
}

export function isAuthCallbackUrl(url: string | null | undefined) {
  if (!url) return false;
  return url.includes('/auth/callback') || url.startsWith('doit://auth/callback');
}

export function desktopAuthDeepLink(url: string) {
  const parsed = new URL(url);
  const params = new URLSearchParams();
  ['code', 'error', 'error_code', 'error_description', 'provider'].forEach((key) => {
    const value = parsed.searchParams.get(key);
    if (value) params.set(key, value);
  });
  params.set('provider', parsed.searchParams.get('provider') || 'google');
  return `doit://auth/callback?${params.toString()}`;
}
