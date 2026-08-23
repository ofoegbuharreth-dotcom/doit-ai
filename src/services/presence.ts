import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from './supabase';

export type PresenceAppKind = 'web' | 'installed-web' | 'desktop' | 'native';
const PRESENCE_CLIENT_KEY = 'doit:presence-client-id';
let presenceClientIdPromise: Promise<string> | undefined;

async function getPresenceClientId() {
  if (!presenceClientIdPromise) presenceClientIdPromise = (async () => {
    const saved = await AsyncStorage.getItem(PRESENCE_CLIENT_KEY);
    if (saved) return saved;
    const created = `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    await AsyncStorage.setItem(PRESENCE_CLIENT_KEY, created);
    return created;
  })();
  return presenceClientIdPromise;
}

export function presenceAppKind(): PresenceAppKind {
  if (Platform.OS !== 'web') return 'native';
  if (typeof window !== 'undefined' && window.doitDesktop?.isDesktop) return 'desktop';
  if (typeof window !== 'undefined') {
    const standalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
      || ['standalone', 'fullscreen', 'minimal-ui'].some((mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches);
    if (standalone) return 'installed-web';
  }
  return 'web';
}

export async function touchMyPresence(online = true) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.rpc('touch_my_presence', {
    p_client_id: await getPresenceClientId(),
    p_app_kind: presenceAppKind(),
    p_online: online,
  });
  if (error) throw error;
}
