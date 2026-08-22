import type { CalendarItem, FocusSession, Goal, Milestone, Task, TaskDependency, WeeklyReview } from '@/types';
import { goalProgress } from '../../utils';

export type MaxPriority = { task: Task; goal?: Goal; score: number; reasons: string[]; blocked: boolean };
export type MaxForecast = { goal: Goal; progress: number; status: 'ahead' | 'on-track' | 'behind' | 'no-deadline'; estimatedDate?: string; requiredWeeklyProgress?: number };
export type MaxReplanSuggestion = { id: string; taskId: string; title: string; reason: string; changes: { newDate?: string; estimatedMinutes?: number; priority?: Task['priority'] }; impact: string };
export type MaxPortfolio = {
  priorities: MaxPriority[]; forecasts: MaxForecast[]; suggestions: MaxReplanSuggestion[];
  completionRate: number; consistency: number; strongestDay: string; weakestDay: string;
  overloadedDays: { date: string; minutes: number; count: number }[]; neglectedGoals: Goal[]; totalPlannedMinutes: number; timeSpentMinutes: number;
  milestoneProgress: { goalId: string; completed: number; total: number }[]; recentReview?: WeeklyReview;
};

type MaxContext = { now?: Date; calendarItems?: CalendarItem[]; weeklyReviews?: WeeklyReview[] };

const dateKey = (value = new Date()) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const dayMs = 86_400_000;

export function buildMaxPortfolio(goals: Goal[], tasks: Task[], milestones: Milestone[], sessions: FocusSession[] = [], dependencies: TaskDependency[] = [], nowOrContext: Date | MaxContext = new Date()): MaxPortfolio {
  const context = nowOrContext instanceof Date ? {} : nowOrContext;
  const now = nowOrContext instanceof Date ? nowOrContext : context.now ?? new Date();
  const calendarItems = context.calendarItems ?? [];
  const weeklyReviews = context.weeklyReviews ?? [];
  const today = dateKey(now);
  const active = goals.filter((goal) => goal.status === 'active');
  const activeIds = new Set(active.map((goal) => goal.id));
  const completedIds = new Set(tasks.filter((task) => task.status === 'completed').map((task) => task.id));
  const dependencyMap = new Map(dependencies.map((item) => [item.taskId, item.dependsOnTaskId]));
  const priorities = tasks.filter((task) => task.status === 'pending' && (!task.goalId || activeIds.has(task.goalId))).map((task): MaxPriority => {
    const goal = active.find((item) => item.id === task.goalId);
    const reasons: string[] = [];
    let score = task.priority === 'high' ? 35 : task.priority === 'medium' ? 20 : 8;
    if (task.scheduledDate < today) { const days = Math.max(1, Math.floor((now.getTime() - new Date(`${task.scheduledDate}T12:00:00`).getTime()) / dayMs)); score += Math.min(40, 12 + days * 5); reasons.push(`${days} day${days === 1 ? '' : 's'} overdue`); }
    else if (task.scheduledDate === today) { score += 14; reasons.push('planned for today'); }
    if (goal?.targetDate) {
      const daysLeft = Math.ceil((new Date(`${goal.targetDate}T23:59:00`).getTime() - now.getTime()) / dayMs);
      if (daysLeft <= 7) { score += Math.max(8, 26 - Math.max(0, daysLeft) * 2); reasons.push(daysLeft < 0 ? 'goal deadline passed' : `goal due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`); }
    }
    if (task.moveCount >= 2) { score += 9; reasons.push(`moved ${task.moveCount} times`); }
    const dependency = dependencyMap.get(task.id);
    const blocked = Boolean(dependency && !completedIds.has(dependency));
    if (blocked) { score = -100; reasons.push('waiting for a prerequisite'); }
    if (!reasons.length) reasons.push(task.priority === 'high' ? 'high priority' : 'best available next move');
    return { task, goal, score, reasons, blocked };
  }).sort((a, b) => b.score - a.score);

  const recentStart = new Date(now); recentStart.setDate(recentStart.getDate() - 27);
  const recentKey = dateKey(recentStart);
  const recent = tasks.filter((task) => task.scheduledDate >= recentKey && task.scheduledDate <= today && task.status !== 'moved');
  const completionRate = recent.length ? Math.round(recent.filter((task) => task.status === 'completed').length / recent.length * 100) : 0;
  const dayStats = Array.from({ length: 7 }, (_, weekday) => {
    const matching = recent.filter((task) => new Date(`${task.scheduledDate}T12:00:00`).getDay() === weekday);
    return { weekday, rate: matching.length ? matching.filter((task) => task.status === 'completed').length / matching.length : -1, total: matching.length };
  }).filter((item) => item.total);
  const labels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const strongest = [...dayStats].sort((a, b) => b.rate - a.rate)[0];
  const weakest = [...dayStats].sort((a, b) => a.rate - b.rate)[0];
  const activeDays = new Set(recent.filter((task) => task.status === 'completed').map((task) => task.scheduledDate)).size;
  const consistency = Math.min(100, Math.round(activeDays / 28 * 100));

  const loads = new Map<string, { minutes: number; count: number }>();
  tasks.filter((task) => task.status === 'pending').forEach((task) => { const load = loads.get(task.scheduledDate) ?? { minutes: 0, count: 0 }; load.minutes += task.estimatedMinutes || 25; load.count += 1; loads.set(task.scheduledDate, load); });
  calendarItems.filter((item) => item.isFixed && !item.taskId).forEach((item) => {
    const date = item.startTime.slice(0, 10); const minutes = Math.max(0, Math.round((new Date(item.endTime).getTime() - new Date(item.startTime).getTime()) / 60_000));
    const load = loads.get(date) ?? { minutes: 0, count: 0 }; load.minutes += minutes; load.count += 1; loads.set(date, load);
  });
  const overloadedDays = [...loads].filter(([, value]) => value.minutes > 150 || value.count > 5).map(([date, value]) => ({ date, ...value })).sort((a, b) => a.date.localeCompare(b.date));
  const latestByGoal = new Map<string, number>();
  tasks.filter((task) => task.status === 'completed' && task.goalId).forEach((task) => latestByGoal.set(task.goalId!, Math.max(latestByGoal.get(task.goalId!) ?? 0, new Date(task.completedAt ?? `${task.scheduledDate}T12:00:00`).getTime())));
  const neglectedGoals = active.filter((goal) => now.getTime() - (latestByGoal.get(goal.id) ?? new Date(goal.createdAt).getTime()) > 7 * dayMs);
  const forecasts = active.map((goal) => forecastGoal(goal, tasks, now));
  const suggestions = buildSuggestions(priorities, forecasts, overloadedDays, today);
  const totalPlannedMinutes = tasks.filter((task) => task.status === 'pending' && task.scheduledDate >= today).reduce((sum, task) => sum + (task.estimatedMinutes || 25), 0);
  const timeSpentMinutes = sessions.filter((session) => session.status === 'completed' && session.startedAt >= recentStart.toISOString()).reduce((sum, session) => sum + (session.actualMinutes ?? 0), 0);
  const milestoneProgress = active.map((goal) => { const items = milestones.filter((item) => item.goalId === goal.id); return { goalId: goal.id, completed: items.filter((item) => item.status === 'completed').length, total: items.length }; });
  return { priorities, forecasts, suggestions, completionRate, consistency, strongestDay: strongest ? labels[strongest.weekday]! : 'Not enough data', weakestDay: weakest ? labels[weakest.weekday]! : 'Not enough data', overloadedDays, neglectedGoals, totalPlannedMinutes, timeSpentMinutes, milestoneProgress, recentReview: weeklyReviews[0] };
}

export function selectMaxWork(portfolio: MaxPortfolio, availableMinutes: number) {
  let remaining = Math.max(5, availableMinutes);
  const selected: MaxPriority[] = [];
  for (const item of portfolio.priorities.filter((priority) => !priority.blocked)) {
    const minutes = item.task.estimatedMinutes || 25;
    if (minutes <= remaining || !selected.length) { selected.push(item); remaining -= Math.min(remaining, minutes); }
    if (remaining < 5) break;
  }
  return selected;
}

function forecastGoal(goal: Goal, tasks: Task[], now: Date): MaxForecast {
  const progress = goalProgress(goal);
  if (!goal.targetDate) return { goal, progress, status: 'no-deadline' };
  const created = new Date(goal.createdAt).getTime();
  const deadline = new Date(`${goal.targetDate}T23:59:00`).getTime();
  const elapsed = Math.max(1, now.getTime() - created); const total = Math.max(dayMs, deadline - created);
  const expected = Math.min(100, elapsed / total * 100);
  const status = progress + 8 < expected ? 'behind' : progress > expected + 12 ? 'ahead' : 'on-track';
  const daysLeft = Math.max(1, Math.ceil((deadline - now.getTime()) / dayMs));
  const remaining = Math.max(0, goal.targetValue - goal.currentValue);
  const requiredWeeklyProgress = Math.round(remaining / daysLeft * 7 * 10) / 10;
  const completed = tasks.filter((task) => task.goalId === goal.id && task.status === 'completed');
  const paceDays = completed.length > 1 ? Math.max(1, (now.getTime() - new Date(completed.at(-1)?.createdAt ?? goal.createdAt).getTime()) / dayMs) : 0;
  const daily = paceDays ? Math.max(0, goal.currentValue / paceDays) : 0;
  const estimatedDate = daily > 0 ? dateKey(new Date(now.getTime() + remaining / daily * dayMs)) : undefined;
  return { goal, progress, status, estimatedDate, requiredWeeklyProgress };
}

function buildSuggestions(priorities: MaxPriority[], forecasts: MaxForecast[], overloaded: MaxPortfolio['overloadedDays'], today: string): MaxReplanSuggestion[] {
  const suggestions: MaxReplanSuggestion[] = [];
  priorities.filter((item) => !item.blocked && item.task.scheduledDate < today).slice(0, 2).forEach((item) => suggestions.push({ id: `overdue-${item.task.id}`, taskId: item.task.id, title: `Bring “${item.task.title}” back into the plan`, reason: item.reasons.join(' · '), changes: { newDate: today, priority: 'high' }, impact: `Moves a ${item.task.estimatedMinutes || 25}-minute overdue action to today.` }));
  overloaded.slice(0, 2).forEach((day) => {
    const candidate = priorities.filter((item) => item.task.scheduledDate === day.date && !item.blocked).sort((a, b) => a.score - b.score)[0];
    if (!candidate) return;
    const next = new Date(`${day.date}T12:00:00`); next.setDate(next.getDate() + 1);
    suggestions.push({ id: `load-${candidate.task.id}`, taskId: candidate.task.id, title: `Protect ${day.date} from overload`, reason: `${day.count} actions total ${day.minutes} minutes. This is the lowest-impact movable action.`, changes: { newDate: dateKey(next) }, impact: `Moves “${candidate.task.title}” to the next day; nothing is deleted.` });
  });
  forecasts.filter((item) => item.status === 'behind').slice(0, 1).forEach((forecast) => {
    const candidate = priorities.find((item) => item.goal?.id === forecast.goal.id && !item.blocked && item.task.scheduledDate > today);
    if (candidate) suggestions.push({ id: `pace-${candidate.task.id}`, taskId: candidate.task.id, title: `Recover pace on “${forecast.goal.title}”`, reason: `Current progress is behind the pace required for ${forecast.goal.targetDate}.`, changes: { newDate: today, priority: 'high' }, impact: `Offers “${candidate.task.title}” today so the deadline has a realistic recovery action.` });
  });
  if (!overloaded.some((day) => day.date === today)) forecasts.filter((item) => item.status === 'ahead').slice(0, 1).forEach((forecast) => {
    const candidate = priorities.find((item) => item.goal?.id === forecast.goal.id && !item.blocked && item.task.scheduledDate > today);
    if (candidate) suggestions.push({ id: `ahead-${candidate.task.id}`, taskId: candidate.task.id, title: `Use the room created on “${forecast.goal.title}”`, reason: 'You are ahead of the expected pace and today is not overloaded.', changes: { newDate: today }, impact: `Optionally brings “${candidate.task.title}” forward without removing later work.` });
  });
  return [...new Map(suggestions.map((item) => [item.taskId, item])).values()].slice(0, 4);
}
