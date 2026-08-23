import type { RecurrenceRule, Task } from '@/types';

export type RecurrenceChoice = 'daily' | 'weekdays' | 'weekly';
export type RecoveryChoice = 'light' | 'spread' | 'restart';

const DAY_MS = 86_400_000;
const parseDate = (value: string) => new Date(`${value}T12:00:00`);
const dateKey = (value: Date) => value.toISOString().slice(0, 10);
const addDays = (value: string, days: number) => dateKey(new Date(parseDate(value).getTime() + days * DAY_MS));

export function ruleOccursOn(rule: RecurrenceRule, date: string) {
  if (date < rule.startsOn || (rule.endsOn && date > rule.endsOn)) return false;
  const candidate = parseDate(date);
  const start = parseDate(rule.startsOn);
  const elapsedDays = Math.floor((candidate.getTime() - start.getTime()) / DAY_MS);
  if (elapsedDays < 0) return false;
  if (rule.frequency === 'daily') return elapsedDays % rule.interval === 0;
  if (rule.frequency === 'weekdays') return candidate.getDay() > 0 && candidate.getDay() < 6;
  if (rule.frequency === 'weekly') return candidate.getDay() === start.getDay() && Math.floor(elapsedDays / 7) % rule.interval === 0;
  if (rule.frequency === 'selected_days') return (rule.daysOfWeek ?? []).includes(candidate.getDay());
  return candidate.getDate() === Math.min(rule.dayOfMonth ?? start.getDate(), new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate());
}

export function materialiseRecurringTasks(tasks: Task[], rules: RecurrenceRule[], date: string, makeId: () => string) {
  const created: Task[] = [];
  for (const rule of rules) {
    if (!ruleOccursOn(rule, date) || tasks.some((task) => task.recurrenceRuleId === rule.id && task.scheduledDate === date)) continue;
    const source = [...tasks].filter((task) => task.recurrenceRuleId === rule.id).sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))[0];
    if (!source) continue;
    created.push({ ...source, id: makeId(), scheduledDate: date, status: 'pending', completedAt: undefined, actualMinutes: undefined, moveCount: 0, createdAt: new Date().toISOString() });
  }
  return created;
}

export function materialiseRecurringTasksThrough(tasks: Task[], rules: RecurrenceRule[], throughDate: string, makeId: () => string, maxLookbackDays = 7) {
  const working = [...tasks];
  const created: Task[] = [];
  const earliest = addDays(throughDate, -Math.max(1, maxLookbackDays));
  for (let cursor = earliest; cursor <= throughDate; cursor = addDays(cursor, 1)) {
    const occurrences = materialiseRecurringTasks(working, rules, cursor, makeId);
    working.push(...occurrences);
    created.push(...occurrences);
  }
  return created;
}

export function recurringLabel(rule?: RecurrenceRule) {
  if (!rule) return undefined;
  if (rule.frequency === 'daily') return 'Every day';
  if (rule.frequency === 'weekdays') return 'Weekdays';
  if (rule.frequency === 'weekly') return 'Every week';
  if (rule.frequency === 'selected_days') return 'Selected days';
  return 'Every month';
}

export function recoveryCandidates(tasks: Task[], date: string) {
  return tasks.filter((task) => task.recurrenceRuleId && task.status === 'pending' && task.scheduledDate < date).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
}

export function buildRecoveryChanges(tasks: Task[], date: string, choice: RecoveryChoice) {
  return tasks.map((task, index): Task => {
    if (choice === 'light') return { ...task, status: 'skipped' };
    if (choice === 'spread') return { ...task, scheduledDate: addDays(date, Math.min(index, 2) + 1), moveCount: task.moveCount + 1 };
    return { ...task, status: 'skipped' };
  });
}
