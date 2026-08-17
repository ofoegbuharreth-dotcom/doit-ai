import type { DailyCheckIn, FocusSession, Goal, Task } from '@/types';
import { completionStreak, goalProgress } from '../utils';

export type InsightDay = { date: string; label: string; minutes: number; completed: number };

export type InsightsSnapshot = {
  days: InsightDay[];
  completedCount: number;
  plannedCount: number;
  completionRate: number;
  previousCompletionRate: number;
  completionChange: number;
  focusMinutes: number;
  todayFocusMinutes: number;
  streak: number;
  personalBestMinutes: number;
  bestTimeLabel: string;
  blockers: string[];
  coachHeadline: string;
  coachSummary: string;
  nextWeekChanges: string[];
  goalStats: { id: string; title: string; progress: number; completed: number; total: number }[];
};

const dayKey = (value: Date | string) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const atStartOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

function minutesByDay(tasks: Task[], sessions: FocusSession[]) {
  const totals = new Map<string, number>();
  const focusedTaskIds = new Set<string>();
  sessions.filter((item) => item.status === 'completed' && item.actualMinutes).forEach((item) => {
    const date = dayKey(item.endedAt ?? item.startedAt);
    totals.set(date, (totals.get(date) ?? 0) + Number(item.actualMinutes));
    if (item.taskId) focusedTaskIds.add(item.taskId);
  });
  tasks.filter((task) => task.status === 'completed' && task.actualMinutes && !focusedTaskIds.has(task.id)).forEach((task) => {
    const date = dayKey(task.completedAt ?? `${task.scheduledDate}T12:00:00`);
    totals.set(date, (totals.get(date) ?? 0) + Number(task.actualMinutes));
  });
  return totals;
}

function rateForRange(tasks: Task[], start: string, end: string) {
  const eligible = tasks.filter((task) => task.scheduledDate >= start && task.scheduledDate <= end && task.status !== 'moved');
  const completed = eligible.filter((task) => task.status === 'completed').length;
  return { completed, total: eligible.length, rate: eligible.length ? Math.round((completed / eligible.length) * 100) : 0 };
}

function timeLabel(sessions: FocusSession[], tasks: Task[]) {
  const hours = sessions.filter((item) => item.status === 'completed').map((item) => new Date(item.startedAt).getHours());
  if (!hours.length) tasks.filter((task) => task.status === 'completed' && task.actualMinutes && task.completedAt).forEach((task) => hours.push(new Date(task.completedAt!).getHours()));
  if (!hours.length) return 'Not enough data yet';
  const buckets = [
    { label: 'Morning · 6–12', count: hours.filter((hour) => hour >= 6 && hour < 12).length },
    { label: 'Afternoon · 12–17', count: hours.filter((hour) => hour >= 12 && hour < 17).length },
    { label: 'Evening · 17–22', count: hours.filter((hour) => hour >= 17 && hour < 22).length },
    { label: 'Late night · 22–6', count: hours.filter((hour) => hour >= 22 || hour < 6).length },
  ];
  return buckets.sort((a, b) => b.count - a.count)[0]?.label ?? 'Not enough data yet';
}

export function buildInsights(tasks: Task[], goals: Goal[], sessions: FocusSession[], checkIns: DailyCheckIn[], now = new Date()): InsightsSnapshot {
  const today = atStartOfDay(now);
  const todayKey = dayKey(today);
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - 6);
  const previousStart = new Date(today); previousStart.setDate(today.getDate() - 13);
  const previousEnd = new Date(today); previousEnd.setDate(today.getDate() - 7);
  const minutes = minutesByDay(tasks, sessions);
  const days = Array.from({ length: 7 }, (_, index): InsightDay => {
    const date = new Date(weekStart); date.setDate(weekStart.getDate() + index);
    const key = dayKey(date);
    return {
      date: key,
      label: new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date).slice(0, 1),
      minutes: minutes.get(key) ?? 0,
      completed: tasks.filter((task) => task.status === 'completed' && dayKey(task.completedAt ?? `${task.scheduledDate}T12:00:00`) === key).length,
    };
  });
  const current = rateForRange(tasks, dayKey(weekStart), todayKey);
  const previous = rateForRange(tasks, dayKey(previousStart), dayKey(previousEnd));
  const blockers = [...new Set(checkIns.filter((item) => item.date >= dayKey(weekStart) && item.date <= todayKey && item.blocker?.trim()).map((item) => item.blocker!.trim()))];
  const focusMinutes = days.reduce((sum, day) => sum + day.minutes, 0);
  const completionChange = current.rate - previous.rate;
  const coachHeadline = current.rate >= 75 ? 'Protect what is working.' : current.rate >= 40 ? 'Your plan is moving.' : current.total ? 'Make the plan lighter.' : 'Build your first pattern.';
  const coachSummary = current.rate >= 75
    ? `You completed ${current.completed} of ${current.total} planned actions. Keep next week focused instead of making it fuller.`
    : current.rate >= 40
      ? `You completed ${current.completed} of ${current.total} actions. Your best next move is to protect fewer, higher-value actions.`
      : current.total
        ? `You completed ${current.completed} of ${current.total} actions. Reduce the daily load until completing the plan feels repeatable.`
        : 'Complete and focus on a few actions this week. DOIT will turn that activity into a useful pattern.';
  const nextWeekChanges = [
    current.rate < 60 ? 'Plan one fewer action each day.' : 'Keep the daily plan at its current size.',
    focusMinutes < 30 ? 'Protect one 10-minute focus block.' : `Use your strongest window: ${timeLabel(sessions, tasks)}.`,
    blockers.length ? `Address this blocker first: ${blockers[0]}.` : 'Record a blocker during the evening check-in when one appears.',
  ];
  const goalStats = goals.filter((goal) => goal.status === 'active').map((goal) => {
    const goalTasks = tasks.filter((task) => task.goalId === goal.id && task.scheduledDate >= dayKey(weekStart) && task.scheduledDate <= todayKey);
    return { id: goal.id, title: goal.title, progress: goalProgress(goal), completed: goalTasks.filter((task) => task.status === 'completed').length, total: goalTasks.length };
  }).sort((a, b) => b.progress - a.progress);
  return {
    days, completedCount: current.completed, plannedCount: current.total, completionRate: current.rate,
    previousCompletionRate: previous.rate, completionChange, focusMinutes, todayFocusMinutes: minutes.get(todayKey) ?? 0,
    streak: completionStreak(tasks), personalBestMinutes: Math.max(0, ...minutes.values()), bestTimeLabel: timeLabel(sessions, tasks),
    blockers, coachHeadline, coachSummary, nextWeekChanges, goalStats,
  };
}
