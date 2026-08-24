import type { Session } from '@supabase/supabase-js';

const FRESH_GOOGLE_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;

export function shouldCreatePasswordAfterGoogleSignup(session: Session | null | undefined, intent?: string | null) {
  if (!session || intent !== 'signup') return false;
  const { user } = session;
  if (user.user_metadata?.doit_password_created_at) return false;
  const usesGoogle = user.identities?.some((identity) => identity.provider === 'google')
    || user.app_metadata?.provider === 'google'
    || (Array.isArray(user.app_metadata?.providers) && user.app_metadata.providers.includes('google'));
  if (!usesGoogle) return false;
  const createdAt = Date.parse(user.created_at);
  const lastSignInAt = Date.parse(user.last_sign_in_at ?? user.created_at);
  return Number.isFinite(createdAt)
    && Number.isFinite(lastSignInAt)
    && Math.abs(lastSignInAt - createdAt) <= FRESH_GOOGLE_ACCOUNT_WINDOW_MS;
}
