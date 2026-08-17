import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { DailyCheckIn, FocusSession, Goal, GoalActivity, GoalProgressEntry, Milestone, Task } from '@/types';

export type WorkspaceBackup = { goals: Goal[]; milestones: Milestone[]; tasks: Task[]; activity: GoalActivity[]; checkIns: DailyCheckIn[]; progressEntries: GoalProgressEntry[]; focusSessions: FocusSession[] };

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

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

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
