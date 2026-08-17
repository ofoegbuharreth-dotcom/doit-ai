import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredFocusSession = {
  id: string;
  taskId: string;
  startedAt: string;
  targetSeconds: number;
  accumulatedSeconds: number;
  runningSince: number | null;
  pausedSeconds: number;
  pausedAt?: number;
  notificationId?: string;
};

const STORAGE_KEY = '@doit/active-focus-session';

export function focusElapsedSeconds(session: StoredFocusSession, now = Date.now()) {
  const runningSeconds = session.runningSince ? Math.max(0, Math.floor((now - session.runningSince) / 1000)) : 0;
  return Math.max(0, session.accumulatedSeconds + runningSeconds);
}

export function formatFocusTime(seconds: number) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export async function loadFocusSession(taskId: string) {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return undefined;
  try {
    const session = JSON.parse(raw) as StoredFocusSession;
    return session.taskId === taskId ? session : undefined;
  } catch {
    return undefined;
  }
}

export async function saveFocusSession(session: StoredFocusSession) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function clearFocusSession() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
