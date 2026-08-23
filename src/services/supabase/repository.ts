import type { CalendarItem, DailyCheckIn, FocusSession, Goal, GoalActivity, GoalPlanResponse, GoalProgressEntry, GoalStatus, Milestone, RecurrenceRule, Task, TaskDependency, TaskStatus, WeeklyReview } from '@/types';
import { supabase } from './client';

const goalFromRow = (row: Record<string, any>): Goal => ({ id: row.id, userId: row.user_id, title: row.title, description: row.description ?? '', status: row.status, targetValue: Number(row.target_value), currentValue: Number(row.current_value), unit: row.unit ?? '%', targetDate: row.target_date ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at });
const milestoneFromRow = (row: Record<string, any>): Milestone => ({ id: row.id, goalId: row.goal_id, title: row.title, description: row.description ?? '', targetValue: Number(row.target_value), sortOrder: row.sort_order, status: row.status, completedAt: row.completed_at ?? undefined, dueDate: row.due_date ?? undefined });
const taskFromRow = (row: Record<string, any>): Task => ({ id: row.id, goalId: row.goal_id ?? undefined, userId: row.user_id, title: row.title, description: row.description ?? '', scheduledDate: row.scheduled_date, status: row.status, priority: row.priority, estimatedMinutes: row.estimated_minutes ?? 0, actualMinutes: row.actual_minutes ?? undefined, energyLevel: row.energy_level ?? undefined, deadline: row.deadline ?? undefined, flexibility: row.scheduling_flexibility ?? undefined, recurrenceRuleId: row.recurrence_rule_id ?? undefined, tags: row.tags ?? undefined, notes: row.notes ?? undefined, aiGenerated: row.ai_generated, createdAt: row.created_at, completedAt: row.completed_at ?? undefined, moveCount: row.move_count ?? 0 });
const activityFromRow = (row: Record<string, any>): GoalActivity => ({ id: row.id, goalId: row.goal_id ?? undefined, userId: row.user_id, type: row.type, title: row.title, detail: row.detail ?? undefined, createdAt: row.created_at });

export async function fetchWorkspace(userId: string) {
  const [goals, milestones, tasks, activity, checkIns, progressEntries, focusSessions, taskDependencies, calendarItems, weeklyReviews, recurrenceRules] = await Promise.all([
    supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('milestones').select('*, goals!inner(user_id)').eq('goals.user_id', userId).order('sort_order'),
    supabase.from('tasks').select('*').eq('user_id', userId).order('scheduled_date'),
    supabase.from('goal_activity').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('daily_checkins').select('*').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('goal_progress_entries').select('*').eq('user_id', userId).order('recorded_on', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('focus_sessions').select('*').eq('user_id', userId).order('started_at', { ascending: false }).limit(200),
    supabase.from('task_dependencies').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('calendar_items').select('*').eq('user_id', userId).order('start_time'),
    supabase.from('weekly_reviews').select('*').eq('user_id', userId).order('week_start', { ascending: false }).limit(8),
    supabase.from('recurrence_rules').select('*').eq('user_id', userId).order('created_at'),
  ]);
  const error = goals.error ?? milestones.error ?? tasks.error ?? activity.error ?? checkIns.error ?? progressEntries.error ?? focusSessions.error ?? taskDependencies.error ?? calendarItems.error ?? weeklyReviews.error ?? recurrenceRules.error;
  if (error) throw error;
  return {
    goals: (goals.data ?? []).map(goalFromRow), milestones: (milestones.data ?? []).map(milestoneFromRow), tasks: (tasks.data ?? []).map(taskFromRow), activity: (activity.data ?? []).map(activityFromRow),
    checkIns: (checkIns.data ?? []).map((row): DailyCheckIn => ({ id: row.id, userId: row.user_id, date: row.date, mood: row.mood, blocker: row.blocker ?? undefined, accomplishment: row.accomplishment ?? undefined, createdAt: row.created_at })),
    progressEntries: (progressEntries.data ?? []).map((row): GoalProgressEntry => ({ id: row.id, goalId: row.goal_id, userId: row.user_id, amount: Number(row.amount), note: row.note ?? undefined, recordedOn: row.recorded_on, createdAt: row.created_at })),
    focusSessions: (focusSessions.data ?? []).map((row): FocusSession => ({ id: row.id, userId: row.user_id, taskId: row.task_id ?? undefined, startedAt: row.started_at, endedAt: row.ended_at ?? undefined, pausedSeconds: row.paused_seconds ?? 0, actualMinutes: row.actual_minutes ?? undefined, status: row.status, createdAt: row.created_at })),
    taskDependencies: (taskDependencies.data ?? []).map((row): TaskDependency => ({ id: row.id, userId: row.user_id, taskId: row.task_id, dependsOnTaskId: row.depends_on_task_id, createdAt: row.created_at })),
    calendarItems: (calendarItems.data ?? []).map((row): CalendarItem => ({ id: row.id, userId: row.user_id, title: row.title, type: row.type, startTime: row.start_time, endTime: row.end_time, goalId: row.goal_id ?? undefined, taskId: row.task_id ?? undefined, isFixed: row.is_fixed, createdAt: row.created_at, updatedAt: row.updated_at })),
    weeklyReviews: (weeklyReviews.data ?? []).map((row): WeeklyReview => ({ id: row.id, userId: row.user_id, weekStart: row.week_start, weekEnd: row.week_end, tasksCompleted: row.tasks_completed, completionRate: Number(row.completion_rate), minutesSpent: row.minutes_spent, summary: row.summary, wins: row.wins ?? [], blockers: row.blockers ?? [], nextWeekChanges: row.next_week_changes ?? [], createdAt: row.created_at })),
    recurrenceRules: (recurrenceRules.data ?? []).map((row): RecurrenceRule => ({ id: row.id, userId: row.user_id, frequency: row.frequency, interval: row.interval, daysOfWeek: row.days_of_week ?? undefined, dayOfMonth: row.day_of_month ?? undefined, startsOn: row.starts_on, endsOn: row.ends_on ?? undefined, timezone: row.timezone, createdAt: row.created_at, updatedAt: row.updated_at })),
  };
}

export async function persistRecurrenceRule(rule: RecurrenceRule) {
  return supabase.from('recurrence_rules').upsert({ id: rule.id, user_id: rule.userId, frequency: rule.frequency, interval: rule.interval, days_of_week: rule.daysOfWeek ?? null, day_of_month: rule.dayOfMonth ?? null, starts_on: rule.startsOn, ends_on: rule.endsOn ?? null, timezone: rule.timezone });
}

export async function deleteRecurrenceRule(ruleId: string) { return supabase.from('recurrence_rules').delete().eq('id', ruleId); }

export async function persistTaskDependency(dependency: TaskDependency) {
  return supabase.rpc('set_max_task_dependency', { p_task_id: dependency.taskId, p_depends_on_task_id: dependency.dependsOnTaskId });
}

export async function deleteTaskDependencyRecord(taskId: string) {
  return supabase.rpc('set_max_task_dependency', { p_task_id: taskId, p_depends_on_task_id: null });
}

export async function persistGoalPlan(goal: Goal, plan: GoalPlanResponse, tasks: Task[], milestones: Milestone[]) {
  const { error: goalError } = await supabase.from('goals').upsert({ id: goal.id, user_id: goal.userId, title: goal.title, description: goal.description, status: goal.status, target_value: goal.targetValue, current_value: goal.currentValue, unit: goal.unit, target_date: goal.targetDate });
  if (goalError) throw goalError;
  const { error: milestoneError } = await supabase.from('milestones').upsert(milestones.map((item) => ({ id: item.id, goal_id: goal.id, title: item.title, description: item.description, target_value: item.targetValue, sort_order: item.sortOrder, status: item.status, due_date: item.dueDate })));
  if (milestoneError) throw milestoneError;
  const { error: taskError } = await supabase.from('tasks').upsert(tasks.map((item) => ({ id: item.id, goal_id: goal.id, user_id: goal.userId, title: item.title, description: item.description, scheduled_date: item.scheduledDate, status: item.status, priority: item.priority, estimated_minutes: item.estimatedMinutes, ai_generated: item.aiGenerated, move_count: item.moveCount })));
  if (taskError) throw taskError;
}

export async function persistTaskStatus(task: Task, status: TaskStatus) {
  return supabase.from('tasks').update({ status, scheduled_date: task.scheduledDate, completed_at: task.completedAt ?? null, move_count: task.moveCount }).eq('id', task.id);
}

export async function persistTaskChanges(task: Task) {
  return supabase.from('tasks').update({ title: task.title, description: task.description, scheduled_date: task.scheduledDate, status: task.status, priority: task.priority, estimated_minutes: task.estimatedMinutes, actual_minutes: task.actualMinutes ?? null, energy_level: task.energyLevel ?? null, recurrence_rule_id: task.recurrenceRuleId ?? null, notes: task.notes ?? null, completed_at: task.completedAt ?? null, move_count: task.moveCount }).eq('id', task.id).eq('user_id', task.userId);
}

export async function startFocusSessionRecord(session: { id: string; userId: string; taskId: string; startedAt: string }) {
  const { error } = await supabase.from('focus_sessions').insert({ id: session.id, user_id: session.userId, task_id: session.taskId, started_at: session.startedAt, status: 'active' });
  if (error) throw error;
}

export async function finishFocusSessionRecord(sessionId: string, values: { endedAt: string; pausedSeconds: number; actualMinutes: number; status: 'completed' | 'abandoned' }) {
  const { error } = await supabase.from('focus_sessions').update({ ended_at: values.endedAt, paused_seconds: values.pausedSeconds, actual_minutes: values.actualMinutes, status: values.status }).eq('id', sessionId);
  if (error) throw error;
}

export async function persistGoalProgress(goalId: string, currentValue: number) {
  return supabase.from('goals').update({ current_value: currentValue }).eq('id', goalId);
}

export async function persistCheckIn(checkIn: DailyCheckIn) {
  return supabase.from('daily_checkins').upsert({ id: checkIn.id, user_id: checkIn.userId, date: checkIn.date, mood: checkIn.mood, blocker: checkIn.blocker, accomplishment: checkIn.accomplishment }, { onConflict: 'user_id,date' });
}

export async function persistGoalChanges(goal: Goal) {
  return supabase.from('goals').update({ title: goal.title, description: goal.description, status: goal.status, target_date: goal.targetDate ?? null, updated_at: goal.updatedAt }).eq('id', goal.id).eq('user_id', goal.userId);
}

export async function deleteGoalRecord(goalId: string) {
  return supabase.from('goals').delete().eq('id', goalId);
}

export async function persistNewTask(task: Task) {
  return supabase.from('tasks').upsert({ id: task.id, goal_id: task.goalId, user_id: task.userId, title: task.title, description: task.description, scheduled_date: task.scheduledDate, status: task.status, priority: task.priority, estimated_minutes: task.estimatedMinutes, ai_generated: task.aiGenerated, recurrence_rule_id: task.recurrenceRuleId ?? null, move_count: task.moveCount });
}

export async function persistActivity(activity: GoalActivity) {
  const payload = { id: activity.id, user_id: activity.userId, goal_id: activity.goalId ?? null, type: activity.type, title: activity.title, detail: activity.detail ?? null, created_at: activity.createdAt };
  const result = await supabase.from('goal_activity').upsert(payload);
  if (result.error?.code === '23503' && activity.goalId) return supabase.from('goal_activity').upsert({ ...payload, goal_id: null });
  return result;
}

export async function logGoalProgressRecord(goalId: string, amount: number, note?: string) {
  const { data, error } = await supabase.rpc('log_goal_progress', { p_goal_id: goalId, p_amount: amount, p_note: note ?? null });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as { entry_id: string; new_current_value: number; new_goal_status: GoalStatus };
}

export async function editGoalProgressRecord(entryId: string, amount: number, note?: string) {
  const { data, error } = await supabase.rpc('edit_goal_progress', { p_entry_id: entryId, p_amount: amount, p_note: note ?? null });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as { new_current_value: number; new_goal_status: GoalStatus };
}

export async function deleteGoalProgressRecord(entryId: string) {
  const { data, error } = await supabase.rpc('delete_goal_progress', { p_entry_id: entryId });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as { goal_id: string; new_current_value: number; new_goal_status: GoalStatus };
}
