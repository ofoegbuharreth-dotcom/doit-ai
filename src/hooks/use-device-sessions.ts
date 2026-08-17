import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { getCurrentDeviceId, getDeviceSession, listDeviceSessions, registerDeviceSession, revokeDeviceSession, rotateCurrentDeviceId, subscribeToDeviceSessions, type AppDevice } from '@/services/devices';
import { isSupabaseConfigured } from '@/services/supabase';
import { useAuth } from './use-auth';

type DeviceSessionsValue = {
  devices: AppDevice[];
  currentDeviceId: string;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  revoke: (deviceId: string) => Promise<void>;
};

const DeviceSessionsContext = createContext<DeviceSessionsValue | null>(null);

export function DeviceSessionsProvider({ children }: PropsWithChildren) {
  const { user, signOut } = useAuth();
  const [devices, setDevices] = useState<AppDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    setLoading(true); setError('');
    try { setDevices(await listDeviceSessions(user.id)); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not load your devices.'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    let active = true;
    let deviceId = '';
    const heartbeat = async () => {
      deviceId = await getCurrentDeviceId();
      if (!active) return;
      setCurrentDeviceId(deviceId);
      const existing = await getDeviceSession(deviceId);
      if (existing?.revokedAt) {
        await rotateCurrentDeviceId();
        await signOut();
        return;
      }
      await registerDeviceSession(user.id, deviceId);
      if (active) await refresh();
    };
    heartbeat().catch((value) => active && setError(value instanceof Error ? value.message : 'Could not register this device.'));
    const timer = setInterval(() => heartbeat().catch(() => undefined), 120000);
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') heartbeat().catch(() => undefined); });
    const unsubscribe = subscribeToDeviceSessions(user.id, (changed) => {
      if (changed?.id === deviceId && changed.revokedAt) {
        rotateCurrentDeviceId().then(() => signOut()).catch(() => undefined);
      } else refresh().catch(() => undefined);
    });
    return () => { active = false; clearInterval(timer); appState.remove(); unsubscribe(); };
  }, [refresh, signOut, user]);

  const revoke = useCallback(async (deviceId: string) => {
    if (!user || deviceId === currentDeviceId) return;
    setError('');
    try { await revokeDeviceSession(user.id, deviceId); await refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not sign out that device.'); }
  }, [currentDeviceId, refresh, user]);

  const value = useMemo(() => ({ devices, currentDeviceId, loading, error, refresh, revoke }), [currentDeviceId, devices, error, loading, refresh, revoke]);
  return createElement(DeviceSessionsContext.Provider, { value }, children);
}

export function useDeviceSessions() {
  const value = useContext(DeviceSessionsContext);
  if (!value) throw new Error('useDeviceSessions must be used within DeviceSessionsProvider');
  return value;
}
