import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { authRuntime, supabase } from '@/services/supabase/client';

export type AppDevice = {
  id: string;
  userId: string;
  label: string;
  platform: string;
  appKind: string;
  lastSeenAt: string;
  createdAt: string;
  revokedAt?: string;
};

const DEVICE_ID_KEY = `doit:device-id:${authRuntime}`;
const makeId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
  const value = Math.floor(Math.random() * 16); return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16);
});

export async function getCurrentDeviceId() {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = makeId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export async function rotateCurrentDeviceId() {
  await AsyncStorage.removeItem(DEVICE_ID_KEY);
  return getCurrentDeviceId();
}

function browserName() {
  if (typeof navigator === 'undefined') return 'Web browser';
  const agent = navigator.userAgent;
  const browser = /Edg\//.test(agent) ? 'Edge' : /Chrome\//.test(agent) ? 'Chrome' : /Firefox\//.test(agent) ? 'Firefox' : /Safari\//.test(agent) ? 'Safari' : 'Browser';
  const system = /Android/i.test(agent) ? 'Android' : /Windows/i.test(agent) ? 'Windows' : /iPhone|iPad/i.test(agent) ? 'iPhone or iPad' : /Mac/i.test(agent) ? 'Mac' : 'Web';
  return `${browser} on ${system}`;
}

function deviceLabel() {
  if (Platform.OS === 'web') return authRuntime === 'installed-web' ? `Installed DOIT · ${browserName()}` : browserName();
  return Device.deviceName || `${Application.applicationName ?? 'DOIT AI'} on ${Platform.OS === 'android' ? 'Android' : 'iPhone'}`;
}

const fromRow = (row: Record<string, any>): AppDevice => ({ id: row.id, userId: row.user_id, label: row.label, platform: row.platform, appKind: row.app_kind, lastSeenAt: row.last_seen_at, createdAt: row.created_at, revokedAt: row.revoked_at ?? undefined });

export async function getDeviceSession(deviceId: string) {
  const { data, error } = await supabase.from('app_devices').select('*').eq('id', deviceId).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data) : null;
}

export async function registerDeviceSession(userId: string, deviceId: string) {
  const { error } = await supabase.from('app_devices').upsert({ id: deviceId, user_id: userId, label: deviceLabel(), platform: Platform.OS, app_kind: authRuntime, last_seen_at: new Date().toISOString(), revoked_at: null }, { onConflict: 'id' });
  if (error) throw error;
}

export async function listDeviceSessions(userId: string) {
  const { data, error } = await supabase.from('app_devices').select('*').eq('user_id', userId).is('revoked_at', null).order('last_seen_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function revokeDeviceSession(userId: string, deviceId: string) {
  const { error } = await supabase.from('app_devices').update({ revoked_at: new Date().toISOString() }).eq('id', deviceId).eq('user_id', userId);
  if (error) throw error;
}

export function subscribeToDeviceSessions(userId: string, onChange: (row?: AppDevice) => void) {
  const channel = supabase.channel(`devices:${userId}:${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_devices', filter: `user_id=eq.${userId}` }, (payload) => {
      const row = Object.keys(payload.new ?? {}).length ? payload.new : payload.old;
      onChange(row ? fromRow(row as Record<string, any>) : undefined);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel).catch(() => undefined); };
}
