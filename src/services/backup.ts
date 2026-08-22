import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { DailyCheckIn, FocusSession, Goal, GoalActivity, GoalProgressEntry, Milestone, Task, TaskDependency } from '@/types';

export type WorkspaceBackup = { goals: Goal[]; milestones: Milestone[]; tasks: Task[]; activity: GoalActivity[]; checkIns: DailyCheckIn[]; progressEntries: GoalProgressEntry[]; focusSessions: FocusSession[]; taskDependencies?: TaskDependency[] };

export async function exportWorkspaceBackup(data: WorkspaceBackup) {
  const stamp = new Date().toISOString().slice(0, 10);
  const content = JSON.stringify({ format: 'doit-ai-backup', version: 1, exportedAt: new Date().toISOString(), ...data }, null, 2);
  return saveOrShare(`doit-ai-backup-${stamp}.json`, content, 'application/json');
}

export async function exportProgressCsv(data: WorkspaceBackup) {
  const goals = new Map(data.goals.map((goal) => [goal.id, goal]));
  const rows = [['date', 'goal', 'amount', 'unit', 'note'], ...data.progressEntries.map((entry) => { const goal = goals.get(entry.goalId); return [entry.recordedOn, goal?.title ?? 'Deleted goal', String(entry.amount), goal?.unit ?? '', entry.note ?? '']; })];
  const content = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  return saveOrShare(`doit-ai-progress-${new Date().toISOString().slice(0, 10)}.csv`, content, 'text/csv');
}

export async function exportMaxPortfolioCsv(data: WorkspaceBackup) {
  const completedByGoal = new Map<string, number>(); const pendingByGoal = new Map<string, number>();
  data.tasks.forEach((task) => { if (!task.goalId) return; const target = task.status === 'completed' ? completedByGoal : task.status === 'pending' ? pendingByGoal : undefined; if (target) target.set(task.goalId, (target.get(task.goalId) ?? 0) + 1); });
  const rows = [['goal', 'status', 'progress_percent', 'current_value', 'target_value', 'unit', 'deadline', 'completed_actions', 'pending_actions'], ...data.goals.map((goal) => [goal.title, goal.status, String(Math.min(100, Math.round(goal.currentValue / Math.max(1, goal.targetValue) * 100))), String(goal.currentValue), String(goal.targetValue), goal.unit, goal.targetDate ?? '', String(completedByGoal.get(goal.id) ?? 0), String(pendingByGoal.get(goal.id) ?? 0)])];
  return saveOrShare(`doit-max-portfolio-${new Date().toISOString().slice(0, 10)}.csv`, rows.map((row) => row.map(csvCell).join(',')).join('\r\n'), 'text/csv');
}

export async function exportMaxCalendar(data: WorkspaceBackup) {
  const goals = new Map(data.goals.map((goal) => [goal.id, goal.title]));
  const events = data.tasks.filter((task) => task.status === 'pending').map((task) => {
    const startAt = new Date(`${task.scheduledDate}T09:00:00`);
    const endAt = new Date(startAt.getTime() + Math.max(5, task.estimatedMinutes || 25) * 60_000);
    const start = icsDate(startAt); const end = icsDate(endAt);
    return ['BEGIN:VEVENT', `UID:${task.id}@doit-ai`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${icsCell(task.title)}`, `DESCRIPTION:${icsCell(`${goals.get(task.goalId ?? '') ?? 'DOIT action'} · ${task.estimatedMinutes || 25} min · ${task.description}`)}`, 'END:VEVENT'].join('\r\n');
  });
  const content = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DOIT AI//MAX Portfolio//EN', ...events, 'END:VCALENDAR'].join('\r\n');
  return saveOrShare(`doit-max-plan-${new Date().toISOString().slice(0, 10)}.ics`, content, 'text/calendar');
}

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
const icsCell = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const icsDate = (value: Date) => `${value.getFullYear()}${String(value.getMonth() + 1).padStart(2, '0')}${String(value.getDate()).padStart(2, '0')}T${String(value.getHours()).padStart(2, '0')}${String(value.getMinutes()).padStart(2, '0')}00`;

async function saveOrShare(name: string, content: string, mime: string) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
    return;
  }
  const uri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
  await Sharing.shareAsync(uri, { dialogTitle: `Save ${name}`, mimeType: mime, UTI: mime === 'application/json' ? 'public.json' : 'public.comma-separated-values-text' });
}
