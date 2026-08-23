import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/hooks';
import { touchMyPresence } from '@/services/presence';

const HEARTBEAT_MS = 45_000;

export function PresenceHeartbeat() {
  const { user, demoMode } = useAuth();

  useEffect(() => {
    if (!user?.id || demoMode) return;
    let active = true;
    let visible = AppState.currentState === 'active'
      && (typeof document === 'undefined' || document.visibilityState === 'visible');
    const touch = (online = visible) => { if (active) void touchMyPresence(online).catch(() => undefined); };

    touch(visible);
    const interval = setInterval(() => touch(visible), HEARTBEAT_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      visible = state === 'active' && (typeof document === 'undefined' || document.visibilityState === 'visible');
      touch(visible);
    });
    const onVisibility = () => {
      visible = document.visibilityState === 'visible' && AppState.currentState === 'active';
      touch(visible);
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      clearInterval(interval);
      subscription.remove();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      void touchMyPresence(false).catch(() => undefined);
    };
  }, [demoMode, user?.id]);

  return null;
}
