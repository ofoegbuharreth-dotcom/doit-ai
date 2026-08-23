import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DailyCheckIn, Goal, GoalActivity, GoalPlanResponse, Milestone, RecurrenceRule, Task, TaskStatus } from '@/types';
import {
  deleteGoalRecord,
  deleteRecurrenceRule,
  persistActivity,
  persistCheckIn,
  persistGoalChanges,
  persistGoalPlan,
  persistNewTask,
  persistRecurrenceRule,
  persistTaskChanges,
  persistTaskStatus,
} from '@/services/supabase/repository';
import { supabase } from '@/services/supabase/client';
import { isSafelyStaleQueuedMutation, workspaceSyncErrorMessage } from './sync-errors';

export { isSafelyStaleQueuedMutation, workspaceSyncErrorMessage } from './sync-errors';

export type SyncState = 'syncing' | 'saving' | 'synced' | 'offline' | 'error';

export type WorkspaceMutation =
  | { type: 'task_status'; task: Task; status: TaskStatus }
  | { type: 'task_changes'; task: Task }
  | { type: 'goal_changes'; goal: Goal }
  | { type: 'delete_goal'; goalId: string }
  | { type: 'new_task'; task: Task }
  | { type: 'recurrence_rule'; rule: RecurrenceRule; task: Task }
  | { type: 'recurrence_remove'; ruleId: string }
  | { type: 'check_in'; checkIn: DailyCheckIn }
  | { type: 'activity'; activity: GoalActivity }
  | { type: 'goal_plan'; goal: Goal; plan: GoalPlanResponse; tasks: Task[]; milestones: Milestone[] };

type QueuedMutation = { id: string; userId: string; createdAt: string; mutation: WorkspaceMutation };

const queueKey = (userId: string) => `doit:workspace-sync-queue:${userId}`;
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function readQueue(userId: string): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(queueKey(userId));
    return raw ? JSON.parse(raw) as QueuedMutation[] : [];
  } catch {
    return [];
  }
}

async function writeQueue(userId: string, queue: QueuedMutation[]) {
  if (queue.length) await AsyncStorage.setItem(queueKey(userId), JSON.stringify(queue));
  else await AsyncStorage.removeItem(queueKey(userId));
}

export async function queueWorkspaceMutation(userId: string, mutation: WorkspaceMutation) {
  const queue = await readQueue(userId);
  const dedupeKey = mutation.type === 'task_status' || mutation.type === 'task_changes' ? `task:${mutation.task.id}`
    : mutation.type === 'goal_changes' ? `goal:${mutation.goal.id}`
      : mutation.type === 'check_in' ? `checkin:${mutation.checkIn.date}` : undefined;
  const next = dedupeKey
    ? queue.filter((item) => mutationKey(item.mutation) !== dedupeKey)
    : queue;
  next.push({ id: makeId(), userId, createdAt: new Date().toISOString(), mutation });
  await writeQueue(userId, next);
  return next.length;
}

function mutationKey(mutation: WorkspaceMutation) {
  if (mutation.type === 'task_status' || mutation.type === 'task_changes') return `task:${mutation.task.id}`;
  if (mutation.type === 'goal_changes') return `goal:${mutation.goal.id}`;
  if (mutation.type === 'check_in') return `checkin:${mutation.checkIn.date}`;
  return undefined;
}

function assertResult(result: { error: unknown } | void) {
  if (result && result.error) throw result.error;
}

export async function executeWorkspaceMutation(mutation: WorkspaceMutation) {
  if (mutation.type === 'task_status') return assertResult(await persistTaskStatus(mutation.task, mutation.status));
  if (mutation.type === 'task_changes') return assertResult(await persistTaskChanges(mutation.task));
  if (mutation.type === 'goal_changes') return assertResult(await persistGoalChanges(mutation.goal));
  if (mutation.type === 'delete_goal') return assertResult(await deleteGoalRecord(mutation.goalId));
  if (mutation.type === 'new_task') return assertResult(await persistNewTask(mutation.task));
  if (mutation.type === 'recurrence_rule') { assertResult(await persistRecurrenceRule(mutation.rule)); return assertResult(await persistTaskChanges(mutation.task)); }
  if (mutation.type === 'recurrence_remove') return assertResult(await deleteRecurrenceRule(mutation.ruleId));
  if (mutation.type === 'check_in') return assertResult(await persistCheckIn(mutation.checkIn));
  if (mutation.type === 'activity') return assertResult(await persistActivity(mutation.activity));
  return persistGoalPlan(mutation.goal, mutation.plan, mutation.tasks, mutation.milestones);
}

export async function flushWorkspaceQueue(userId: string) {
  const queue = await readQueue(userId);
  let completed = 0;
  let processed = 0;
  let discarded = 0;
  for (const item of queue) {
    try {
      await executeWorkspaceMutation(item.mutation);
      completed += 1;
    } catch (error) {
      if (!isSafelyStaleQueuedMutation(error, item.mutation)) throw error;
      discarded += 1;
    }
    processed += 1;
    await writeQueue(userId, queue.slice(processed));
  }
  return { completed, discarded, remaining: queue.length - processed };
}

export async function getPendingWorkspaceMutationCount(userId: string) {
  return (await readQueue(userId)).length;
}

export function isRetryableSyncError(error: unknown) {
  const message = workspaceSyncErrorMessage(error, String(error));
  return /network|fetch|offline|timed?\s*out|connection|socket|failed to send|load failed/i.test(message);
}

export function subscribeToWorkspace(userId: string, onChange: () => void, onConnection: (connected: boolean) => void) {
  const channel = supabase.channel(`workspace-sync:${userId}:${makeId()}`);
  const directTables = ['goals', 'tasks', 'goal_activity', 'daily_checkins', 'goal_progress_entries', 'focus_sessions', 'task_dependencies', 'calendar_items', 'weekly_reviews', 'recurrence_rules'] as const;
  directTables.forEach((table) => channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` }, onChange));
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'milestones' }, onChange);
  channel.subscribe((status) => onConnection(status === 'SUBSCRIBED'));
  return () => { supabase.removeChannel(channel).catch(() => undefined); };
}
