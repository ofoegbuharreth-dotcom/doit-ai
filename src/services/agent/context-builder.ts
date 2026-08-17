import type { CalendarItem, DailyCheckIn, Goal, GoalActivity, Milestone, Task, UserPreferences } from '@/types';

export interface AgentContextSource {
  goals: Goal[]; milestones: Milestone[]; tasks: Task[]; checkIns: DailyCheckIn[]; activity: GoalActivity[];
  calendarItems?: CalendarItem[]; preferences?: UserPreferences;
}

export interface AgentContext {
  generatedAt: string; request: string; activeGoals: Goal[]; relevantMilestones: Milestone[]; todayTasks: Task[];
  upcomingTasks: Task[]; overdueTasks: Task[]; recentCompletedTasks: Task[]; recentSkippedTasks: Task[];
  checkIns: DailyCheckIn[]; approachingDeadlines: Goal[]; calendarItems: CalendarItem[]; preferences?: UserPreferences;
  recentActivity?: GoalActivity[];
}

const MAX = { goals: 12, tasks: 30, milestones: 30, activity: 12, checkIns: 7, calendar: 30 } as const;
const day = (value: Date) => value.toISOString().slice(0, 10);

export function buildAgentContext(request: string, source: AgentContextSource, now = new Date()): AgentContext {
  const today = day(now); const horizon = new Date(now); horizon.setDate(horizon.getDate() + 7); const horizonDay = day(horizon);
  const normalized = request.toLowerCase();
  const activeGoals = source.goals.filter((goal) => goal.status === 'active').sort((a, b) => (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999')).slice(0, MAX.goals);
  const activeIds = new Set(activeGoals.map((goal) => goal.id));
  const incomplete = source.tasks.filter((task) => task.status === 'pending');
  const includeHistory = /week|progress|doing|behind|pattern|review|track/.test(normalized);
  const includeCalendar = /day|today|tomorrow|schedule|calendar|time|plan|free|minutes|hour/.test(normalized);
  return {
    generatedAt: now.toISOString(), request, activeGoals,
    relevantMilestones: source.milestones.filter((item) => activeIds.has(item.goalId) && item.status !== 'completed').slice(0, MAX.milestones),
    todayTasks: incomplete.filter((task) => task.scheduledDate === today).slice(0, MAX.tasks),
    upcomingTasks: incomplete.filter((task) => task.scheduledDate > today && task.scheduledDate <= horizonDay).slice(0, MAX.tasks),
    overdueTasks: incomplete.filter((task) => task.scheduledDate < today).slice(0, MAX.tasks),
    recentCompletedTasks: includeHistory ? source.tasks.filter((task) => task.status === 'completed').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, MAX.tasks) : [],
    recentSkippedTasks: includeHistory ? source.tasks.filter((task) => task.status === 'skipped').slice(0, MAX.tasks) : [],
    checkIns: source.checkIns.slice(0, MAX.checkIns),
    approachingDeadlines: activeGoals.filter((goal) => goal.targetDate && goal.targetDate <= horizonDay),
    calendarItems: includeCalendar ? (source.calendarItems ?? []).filter((item) => item.endTime >= now.toISOString()).slice(0, MAX.calendar) : [],
    preferences: source.preferences,
    recentActivity: includeHistory ? source.activity.slice(0, MAX.activity) : undefined,
  };
}
