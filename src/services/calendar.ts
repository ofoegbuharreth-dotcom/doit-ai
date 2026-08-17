import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import type { Task } from '@/types';

export type TimeBlockDraft = {
  title: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  notes?: string;
};

export async function openTimeBlockEditor(draft: TimeBlockDraft) {
  const startDate = new Date(`${draft.date}T${draft.startTime}:00`);
  if (Number.isNaN(startDate.getTime())) throw new Error('Choose a valid date and time.');
  const endDate = new Date(startDate.getTime() + draft.durationMinutes * 60_000);

  if (Platform.OS === 'web') {
    downloadCalendarEvent(draft.title, startDate, endDate, draft.notes);
    return;
  }

  return Calendar.createEventInCalendarAsync({
    title: draft.title,
    startDate,
    endDate,
    notes: draft.notes,
  });
}

export async function timeBlockTask(task: Task, startTime: string, durationMinutes = task.estimatedMinutes || 25) {
  return openTimeBlockEditor({
    title: task.title,
    date: task.scheduledDate,
    startTime,
    durationMinutes,
    notes: task.description ? `DOIT AI action: ${task.description}` : 'DOIT AI focus block',
  });
}

export async function openCalendarBlockFromIso(title: string, startTime: string, endTime: string, notes?: string) {
  if (Platform.OS === 'web') {
    downloadCalendarEvent(title, new Date(startTime), new Date(endTime), notes);
    return;
  }
  return Calendar.createEventInCalendarAsync({ title, startDate: new Date(startTime), endDate: new Date(endTime), notes });
}

function downloadCalendarEvent(title: string, startDate: Date, endDate: Date, notes?: string) {
  if (typeof document === 'undefined') return;
  const format = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const content = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DOIT AI//Time Block//EN', 'BEGIN:VEVENT', `UID:${Date.now()}@doit-ai`, `DTSTAMP:${format(new Date())}`, `DTSTART:${format(startDate)}`, `DTEND:${format(endDate)}`, `SUMMARY:${escape(title)}`, notes ? `DESCRIPTION:${escape(notes)}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'doit-time-block'}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}
