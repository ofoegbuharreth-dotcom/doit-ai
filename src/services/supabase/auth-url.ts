export function isPasswordRecoveryUrl(url: string | null | undefined) {
  if (!url) return false;
  return url.includes('/auth/reset-password') || /(?:[?#&])type=recovery(?:[&#]|$)/.test(url);
}

export function isAuthCallbackUrl(url: string | null | undefined) {
  if (!url) return false;
  return url.includes('/auth/callback') || url.startsWith('doit://auth/callback');
}
