import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

function isInstalledWebApp() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return navigatorWithStandalone.standalone === true
    || ['standalone', 'fullscreen', 'minimal-ui'].some((mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches);
}

const projectRef = url?.match(/^https?:\/\/([^.]+)/)?.[1] ?? 'doit-ai';
const defaultAuthStorageKey = `sb-${projectRef}-auth-token`;
export const authRuntime = isInstalledWebApp() ? 'installed-web' : Platform.OS === 'web' ? 'browser-web' : 'native';
export const authRememberKey = authRuntime === 'installed-web' ? 'doit:remember-me:installed-web' : 'doit:remember-me';
export const authStorageKey = authRuntime === 'installed-web' ? `${defaultAuthStorageKey}-installed-web` : defaultAuthStorageKey;
export const stripeReturnSessionKey = 'doit:stripe-return-session';

export const supabase = createClient(url ?? 'https://example.supabase.co', anonKey ?? 'demo-anon-key', {
  auth: {
    storage: AsyncStorage,
    storageKey: authStorageKey,
    autoRefreshToken: true,
    persistSession: true,
    // DOIT owns every callback exchange in its callback routes. Automatic URL
    // detection races that explicit exchange in Electron and can consume the
    // one-time OAuth code twice, making a valid Google return look expired.
    detectSessionInUrl: false,
    // PKCE keeps the verifier in the app that started Google sign-in while the
    // browser only carries the short-lived code back through the `doit` scheme.
    flowType: 'pkce',
  },
});
