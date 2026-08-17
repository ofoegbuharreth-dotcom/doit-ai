import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type ReminderPreferences = {
  enabled: boolean;
  planningEnabled: boolean;
  planningTime: string;
  checkInEnabled: boolean;
  checkInTime: string;
  overdueEnabled: boolean;
  overdueTime: string;
  sound: boolean;
  quietStart: string;
  quietEnd: string;
};

const STORAGE_KEY = 'doit:reminder-preferences';
const defaults: ReminderPreferences = { enabled: false, planningEnabled: true, planningTime: '09:00', checkInEnabled: true, checkInTime: '20:30', overdueEnabled: false, overdueTime: '17:00', sound: true, quietStart: '21:30', quietEnd: '08:00' };

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });

export async function getReminderPreferences(): Promise<ReminderPreferences> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return defaults;
  try { return { ...defaults, ...JSON.parse(stored) }; } catch { return defaults; }
}

const parseTime = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error('Use a time like 09:00.');
  const hour = Number(match[1]); const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error('Enter a valid 24-hour time.');
  return { hour, minute, minutes: hour * 60 + minute };
};

const isQuiet = (time: number, start: number, end: number) => start <= end ? time >= start && time < end : time >= start || time < end;

export async function saveReminderPreferences(preferences: ReminderPreferences) {
  const planning = parseTime(preferences.planningTime); const checkIn = parseTime(preferences.checkInTime); const overdue = parseTime(preferences.overdueTime);
  const quietStart = parseTime(preferences.quietStart); const quietEnd = parseTime(preferences.quietEnd);
  const selected = [[preferences.planningEnabled, planning], [preferences.checkInEnabled, checkIn], [preferences.overdueEnabled, overdue]] as const;
  if (preferences.enabled && selected.some(([active, time]) => active && isQuiet(time.minutes, quietStart.minutes, quietEnd.minutes))) throw new Error('One reminder is inside quiet hours. Change its time or quiet hours.');
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (preferences.enabled) {
    if (!selected.some(([active]) => active)) throw new Error('Turn on at least one reminder.');
    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') throw new Error('Notifications are disabled in your phone settings.');
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('doit-reminders', { name: 'DOIT reminders', importance: Notifications.AndroidImportance.DEFAULT, sound: preferences.sound ? 'default' : undefined });
    const schedule = async (active: boolean, time: { hour: number; minute: number }, title: string, body: string, data: Record<string, unknown>) => {
      if (!active) return;
      await Notifications.scheduleNotificationAsync({ content: { title, body, data, sound: preferences.sound ? 'default' : undefined }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: time.hour, minute: time.minute, channelId: 'doit-reminders' } });
    };
    await schedule(preferences.planningEnabled, planning, 'Choose today’s clear move', 'Open DOIT and start the action that matters most.', { route: '/(tabs)/home' });
    await schedule(preferences.checkInEnabled, checkIn, 'Quick evening check-in', 'What did you accomplish today?', { route: '/(tabs)/home', checkIn: true });
    await schedule(preferences.overdueEnabled, overdue, 'Keep the plan honest', 'Review overdue actions: do, move, replace, or remove one.', { route: '/(tabs)/goals', attention: true });
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export async function scheduleFocusEndNotification(taskTitle: string, seconds: number) {
  if (seconds < 1) return undefined; const permission = await Notifications.requestPermissionsAsync(); if (permission.status !== 'granted') return undefined;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('focus-timer', { name: 'Focus timer', importance: Notifications.AndroidImportance.HIGH });
  return Notifications.scheduleNotificationAsync({ content: { title: 'Focus time complete', body: `Ready to finish “${taskTitle}”?`, data: { route: '/(tabs)/home' } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.ceil(seconds)), channelId: 'focus-timer' } });
}

export async function cancelFocusEndNotification(id?: string) { if (id) await Notifications.cancelScheduledNotificationAsync(id); }
