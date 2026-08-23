import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { initialActivity, initialGoals, initialMilestones, initialTasks, demoUserId } from '@/constants/mock-data';
import type { CalendarItem, DailyCheckIn, FocusSession, Goal, GoalActivity, GoalDraft, GoalPlanResponse, GoalProgressEntry, GoalStatus, Milestone, RecurrenceRule, Task, TaskDependency, TaskStatus, WeeklyReview } from '@/types';
import { today, tomorrow } from '@/utils';
import { useAuth } from '@/hooks/use-auth';
import { aiProvider } from '@/services/ai';
import type { AgentAction } from '@/services/agent';
import { openCalendarBlockFromIso } from '@/services/calendar';
import { track } from '@/services/observability';
import { buildRecoveryChanges, materialiseRecurringTasksThrough, recoveryCandidates, type RecoveryChoice, type RecurrenceChoice } from '@/services/recurrence';
import { executeWorkspaceMutation, flushWorkspaceQueue, getPendingWorkspaceMutationCount, isRetryableSyncError, queueWorkspaceMutation, subscribeToWorkspace, workspaceSyncErrorMessage, type SyncState, type WorkspaceMutation } from '@/services/sync';
import { syncNextActionWidget } from '@/services/widget';
import { deleteGoalProgressRecord, deleteTaskDependencyRecord, editGoalProgressRecord, fetchWorkspace, isSupabaseConfigured, logGoalProgressRecord, persistNewTask, persistTaskDependency, persistTaskStatus } from '@/services/supabase';

interface AppStore {
  goals: Goal[];
  milestones: Milestone[];
  tasks: Task[];
  activity: GoalActivity[];
  checkIns: DailyCheckIn[];
  progressEntries: GoalProgressEntry[];
  focusSessions: FocusSession[];
  taskDependencies: TaskDependency[];
  calendarItems: CalendarItem[];
  weeklyReviews: WeeklyReview[];
  recurrenceRules: RecurrenceRule[];
  draft: GoalDraft | null;
  generatedPlan: GoalPlanResponse | null;
  syncing: boolean;
  syncState: SyncState;
  pendingChanges: number;
  lastSyncedAt: string | null;
  syncError: string | null;
  replacingTaskId: string | null;
  planningToday: boolean;
  dailyPlanError: string | null;
  progressSaving: boolean;
  progressError: string | null;
  coachSaving: boolean;
  refreshWorkspace: () => Promise<void>;
  retrySync: () => Promise<void>;
  ensureTodayPlan: (force?: boolean) => Promise<Task[]>;
  setDraft: (draft: GoalDraft | null) => void;
  setGeneratedPlan: (plan: GoalPlanResponse | null) => void;
  startGeneratedGoal: (planOverride?: GoalPlanResponse) => { goalId: string; firstTaskId?: string } | undefined;
  updateTask: (taskId: string, status: TaskStatus) => void;
  completeFocusedTask: (taskId: string, actualMinutes: number) => Promise<{ error?: string }>;
  replaceTask: (taskId: string, reason?: string) => Promise<void>;
  updateGoal: (goalId: string, updates: { title?: string; description?: string; targetDate?: string; status?: GoalStatus }) => void;
  deleteGoal: (goalId: string) => Promise<{ error?: string }>;
  logProgress: (goalId: string, amount: number, note?: string) => Promise<{ error?: string; goalCompleted?: boolean; milestone?: string }>;
  editProgress: (entryId: string, amount: number, note?: string) => Promise<{ error?: string }>;
  deleteProgress: (entryId: string) => Promise<{ error?: string }>;
  submitCheckIn: (mood: DailyCheckIn['mood'], accomplishment: string, blocker?: string) => void;
  applyAgentActions: (actions: AgentAction[]) => Promise<{ error?: string }>;
  setTaskDependency: (taskId: string, dependsOnTaskId?: string) => Promise<{ error?: string }>;
  setTaskRecurrence: (taskId: string, frequency: RecurrenceChoice) => Promise<{ error?: string }>;
  clearTaskRecurrence: (taskId: string) => Promise<{ error?: string }>;
  recoverRecurringActions: (choice: RecoveryChoice) => Promise<{ error?: string }>;
}

const AppStoreContext = createContext<AppStore | null>(null);
const makeId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
  const value = Math.floor(Math.random() * 16); return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16);
});

export function AppStoreProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [goals, setGoals] = useState(isSupabaseConfigured ? [] : initialGoals);
  const [milestones, setMilestones] = useState(isSupabaseConfigured ? [] : initialMilestones);
  const [tasks, setTasks] = useState(isSupabaseConfigured ? [] : initialTasks);
  const [activity, setActivity] = useState(isSupabaseConfigured ? [] : initialActivity);
  const [checkIns, setCheckIns] = useState<DailyCheckIn[]>([]);
  const [progressEntries, setProgressEntries] = useState<GoalProgressEntry[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [taskDependencies, setTaskDependencies] = useState<TaskDependency[]>([]);
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([]);
  const [recurrenceRules, setRecurrenceRules] = useState<RecurrenceRule[]>([]);
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<GoalPlanResponse | null>(null);
  const [syncing, setSyncing] = useState(isSupabaseConfigured);
  const [syncState, setSyncState] = useState<SyncState>(isSupabaseConfigured ? 'syncing' : 'synced');
  const [pendingChanges, setPendingChanges] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [replacingTaskId, setReplacingTaskId] = useState<string | null>(null);
  const [planningToday, setPlanningToday] = useState(false);
  const [dailyPlanError, setDailyPlanError] = useState<string | null>(null);
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [coachSaving, setCoachSaving] = useState(false);
  const planningRef = useRef(false);
  const pendingChangesRef = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePendingChanges = useCallback((count: number) => {
    pendingChangesRef.current = count;
    setPendingChanges(count);
  }, []);

  const refreshWorkspace = useCallback(async () => {
    if (!isSupabaseConfigured || !user) { setSyncing(false); return; }
    setSyncing(true); setSyncState('syncing'); setSyncError(null);
    try {
      const data = await fetchWorkspace(user.id);
      setGoals(data.goals); setMilestones(data.milestones); setTasks(data.tasks); setActivity(data.activity); setCheckIns(data.checkIns); setProgressEntries(data.progressEntries); setFocusSessions(data.focusSessions); setTaskDependencies(data.taskDependencies); setCalendarItems(data.calendarItems); setWeeklyReviews(data.weeklyReviews); setRecurrenceRules(data.recurrenceRules);
      setLastSyncedAt(new Date().toISOString());
      setSyncState(pendingChangesRef.current ? 'saving' : 'synced');
    } catch (error) {
      setSyncError(workspaceSyncErrorMessage(error, 'Could not load your Supabase data.'));
      setSyncState(isRetryableSyncError(error) ? 'offline' : 'error');
    } finally { setSyncing(false); }
  }, [user]);

  const flushPendingChanges = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    const before = await getPendingWorkspaceMutationCount(user.id);
    updatePendingChanges(before);
    if (!before) return;
    setSyncState('saving'); setSyncError(null);
    try {
      const result = await flushWorkspaceQueue(user.id);
      updatePendingChanges(result.remaining);
      setLastSyncedAt(new Date().toISOString());
      setSyncState(result.remaining ? 'offline' : 'synced');
      if (!result.remaining) await refreshWorkspace();
    } catch (error) {
      const remaining = await getPendingWorkspaceMutationCount(user.id);
      updatePendingChanges(remaining);
      setSyncState(isRetryableSyncError(error) ? 'offline' : 'error');
      if (!isRetryableSyncError(error)) setSyncError(workspaceSyncErrorMessage(error, 'A queued change could not be saved.'));
    }
  }, [refreshWorkspace, updatePendingChanges, user]);

  const commitMutation = useCallback(async (mutation: WorkspaceMutation) => {
    if (!isSupabaseConfigured || !user) return {};
    setSyncState('saving'); setSyncError(null);
    let alreadyQueued = false;
    try {
      const queued = await getPendingWorkspaceMutationCount(user.id);
      if (queued) {
        const count = await queueWorkspaceMutation(user.id, mutation);
        alreadyQueued = true;
        updatePendingChanges(count);
        await flushPendingChanges();
      } else {
        await executeWorkspaceMutation(mutation, user.id);
        setLastSyncedAt(new Date().toISOString());
        setSyncState('synced');
      }
      return {};
    } catch (error) {
      if (isRetryableSyncError(error)) {
        const count = alreadyQueued ? await getPendingWorkspaceMutationCount(user.id) : await queueWorkspaceMutation(user.id, mutation);
        updatePendingChanges(count);
        setSyncState('offline');
        return { queued: true };
      }
      const message = workspaceSyncErrorMessage(error);
      setSyncState('error'); setSyncError(message);
      return { error: message };
    }
  }, [flushPendingChanges, updatePendingChanges, user]);

  const retrySync = useCallback(async () => {
    setSyncError(null);
    await flushPendingChanges();
    if (!pendingChangesRef.current) await refreshWorkspace();
  }, [flushPendingChanges, refreshWorkspace]);

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    void flushPendingChanges();
    return subscribeToWorkspace(user.id, () => {
      if (pendingChangesRef.current) return;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => { void refreshWorkspace(); }, 300);
    }, (connected) => {
      if (connected) void flushPendingChanges();
      else if (pendingChangesRef.current) setSyncState('offline');
    });
  }, [flushPendingChanges, refreshWorkspace, user]);

  useEffect(() => () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); }, []);

  useEffect(() => {
    const date = today();
    const next = tasks.filter((task) => task.status === 'pending' && task.scheduledDate <= date).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))[0];
    syncNextActionWidget(next, goals.find((goal) => goal.id === next?.goalId)).catch(() => undefined);
  }, [goals, tasks]);

  const addActivity = useCallback((event: Omit<GoalActivity, 'id' | 'createdAt' | 'userId'>) => {
    const next: GoalActivity = { ...event, id: makeId(), createdAt: new Date().toISOString(), userId: user?.id ?? demoUserId };
    setActivity((current) => [next, ...current]);
    if (isSupabaseConfigured) void commitMutation({ type: 'activity', activity: next });
  }, [commitMutation, user?.id]);

  const updateTask = useCallback((taskId: string, status: TaskStatus) => {
    const selected = tasks.find((task) => task.id === taskId);
    if (!selected) return;
    const updatedTask: Task = { ...selected, status: status === 'moved' ? 'pending' : status, scheduledDate: status === 'moved' ? tomorrow() : selected.scheduledDate, completedAt: status === 'completed' ? new Date().toISOString() : undefined, moveCount: status === 'moved' ? selected.moveCount + 1 : selected.moveCount };
    setTasks((current) => current.map((task) => task.id === taskId ? updatedTask : task));
    if (isSupabaseConfigured) void commitMutation({ type: 'task_status', task: updatedTask, status: updatedTask.status });
    const labels: Partial<Record<TaskStatus, string>> = {
      completed: `Completed “${selected.title}”`, skipped: `Skipped “${selected.title}”`, moved: `Moved “${selected.title}” to tomorrow`,
    };
    const title = labels[status];
    if (title) addActivity({ goalId: selected.goalId, type: status === 'completed' ? 'task_completed' : status === 'skipped' ? 'task_skipped' : 'task_moved', title });
  }, [addActivity, commitMutation, tasks]);

  const completeFocusedTask = useCallback(async (taskId: string, actualMinutes: number) => {
    const selected = tasks.find((task) => task.id === taskId);
    if (!selected) return { error: 'That action is no longer available.' };
    const minutes = Math.max(1, Math.round(actualMinutes));
    const updated: Task = { ...selected, status: 'completed', actualMinutes: minutes, completedAt: new Date().toISOString() };
    setTasks((current) => current.map((task) => task.id === taskId ? updated : task));
    try {
      if (isSupabaseConfigured) {
        const result = await commitMutation({ type: 'task_changes', task: updated });
        if (result.error) throw new Error(result.error);
      }
      addActivity({ goalId: selected.goalId, type: 'task_completed', title: `Completed “${selected.title}”`, detail: `${minutes} focused minute${minutes === 1 ? '' : 's'}` });
      return {};
    } catch (error) {
      setTasks((current) => current.map((task) => task.id === taskId ? selected : task));
      const message = error instanceof Error ? error.message : 'Could not save this focus session.';
      setSyncError(message);
      return { error: message };
    }
  }, [addActivity, commitMutation, tasks]);

  const startGeneratedGoal = useCallback((planOverride?: GoalPlanResponse) => {
    const plan = planOverride ?? generatedPlan;
    if (!plan || !draft) return undefined;
    const id = makeId();
    const now = new Date().toISOString();
    const goal: Goal = { id, userId: user?.id ?? demoUserId, title: plan.goal.title, description: plan.goal.description, status: 'active', targetValue: plan.goal.targetValue, currentValue: Number(draft.currentProgress) || 0, unit: plan.goal.unit, targetDate: draft.targetDate, createdAt: now, updatedAt: now };
    setGoals((current) => [goal, ...current]);
    const targetTime = draft.targetDate ? new Date(`${draft.targetDate}T12:00:00`).getTime() : undefined;
    const startTime = Date.now();
    const newMilestones = plan.milestones.map((item, index): Milestone => {
      const evenDate = targetTime && targetTime > startTime
        ? new Date(startTime + ((targetTime - startTime) * (index + 1)) / plan.milestones.length).toISOString().slice(0, 10)
        : new Date(startTime + (index + 1) * 7 * 86400000).toISOString().slice(0, 10);
      return { ...item, id: makeId(), goalId: id, sortOrder: index, status: index === 0 ? 'current' : 'pending', dueDate: evenDate };
    });
    const newTasks = plan.todayTasks.map((item): Task => ({ ...item, id: makeId(), goalId: id, userId: user?.id ?? demoUserId, scheduledDate: today(), status: 'pending', aiGenerated: true, createdAt: now, moveCount: 0 }));
    setMilestones((current) => [...current, ...newMilestones]);
    setTasks((current) => [...newTasks, ...current]);
    if (isSupabaseConfigured) void commitMutation({ type: 'goal_plan', goal, plan, tasks: newTasks, milestones: newMilestones });
    addActivity({ goalId: id, type: 'goal_created', title: `Goal created: ${goal.title}`, detail: 'Your first actions are ready' });
    track('goal created', { milestone_count: newMilestones.length, action_count: newTasks.length, has_deadline: Boolean(draft.targetDate) });
    setDraft(null);
    setGeneratedPlan(null);
    return { goalId: id, firstTaskId: newTasks[0]?.id };
  }, [addActivity, commitMutation, draft, generatedPlan, user?.id]);

  const replaceTask = useCallback(async (taskId: string, reason?: string) => {
    const selected = tasks.find((task) => task.id === taskId);
    const goal = goals.find((item) => item.id === selected?.goalId);
    if (!selected || !goal) return;
    setReplacingTaskId(taskId); setSyncError(null);
    try {
      const goalTasks = tasks.filter((task) => task.goalId === goal.id);
      const adaptation = await aiProvider.adaptPlan({
        goal, milestones: milestones.filter((item) => item.goalId === goal.id), recentTasks: goalTasks.slice(-10),
        completedTasks: goalTasks.filter((task) => task.status === 'completed'), skippedTasks: goalTasks.filter((task) => task.status === 'skipped'),
        checkIns, currentProgress: goal.currentValue,
      });
      const suggestion = adaptation.tasks[0];
      if (!suggestion) throw new Error('DOIT could not create a replacement yet.');
      const replacement: Task = { ...suggestion, id: makeId(), goalId: goal.id, userId: user?.id ?? demoUserId, scheduledDate: today(), status: 'pending', aiGenerated: true, createdAt: new Date().toISOString(), moveCount: 0, description: reason ? `${suggestion.description} Adapted because: ${reason}` : suggestion.description };
      updateTask(taskId, 'skipped');
      setTasks((current) => [replacement, ...current]);
      if (isSupabaseConfigured) await commitMutation({ type: 'new_task', task: replacement });
      addActivity({ goalId: goal.id, type: 'plan_adjusted', title: 'DOIT created an easier next move', detail: adaptation.reason });
    } catch (error) { setSyncError(error instanceof Error ? error.message : 'Could not replace that action.'); }
    finally { setReplacingTaskId(null); }
  }, [addActivity, checkIns, commitMutation, goals, milestones, tasks, updateTask, user?.id]);

  const updateGoal = useCallback((goalId: string, updates: { title?: string; description?: string; targetDate?: string; status?: GoalStatus }) => {
    setGoals((current) => current.map((goal) => {
      if (goal.id !== goalId) return goal;
      const updated = { ...goal, ...updates, targetDate: updates.targetDate || undefined, updatedAt: new Date().toISOString() };
      if (isSupabaseConfigured) void commitMutation({ type: 'goal_changes', goal: updated });
      return updated;
    }));
  }, [commitMutation]);

  const deleteGoal = useCallback(async (goalId: string) => {
    const deletedTaskIds = new Set(tasks.filter((task) => task.goalId === goalId).map((task) => task.id));
    try {
      if (isSupabaseConfigured) {
        const result = await commitMutation({ type: 'delete_goal', goalId });
        if (result.error) throw new Error(result.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not delete this goal.';
      setSyncError(message);
      return { error: message };
    }
    setGoals((current) => current.filter((goal) => goal.id !== goalId));
    setMilestones((current) => current.filter((item) => item.goalId !== goalId));
    setTasks((current) => current.filter((task) => task.goalId !== goalId));
    setTaskDependencies((current) => current.filter((item) => !deletedTaskIds.has(item.taskId) && !deletedTaskIds.has(item.dependsOnTaskId)));
    setProgressEntries((current) => current.filter((entry) => entry.goalId !== goalId));
    return {};
  }, [commitMutation, tasks]);

  const applyProgress = useCallback((goalId: string, nextValue: number, nextStatus: GoalStatus) => {
    setGoals((current) => current.map((goal) => goal.id === goalId ? { ...goal, currentValue: nextValue, status: nextStatus, updatedAt: new Date().toISOString() } : goal));
    setMilestones((current) => {
      const goalMilestones = current.filter((item) => item.goalId === goalId).sort((a, b) => a.sortOrder - b.sortOrder);
      const nextCurrent = goalMilestones.find((item) => item.targetValue > nextValue)?.id;
      return current.map((item) => item.goalId !== goalId ? item : item.targetValue <= nextValue ? { ...item, status: 'completed', completedAt: item.completedAt ?? new Date().toISOString() } : { ...item, status: item.id === nextCurrent ? 'current' : 'pending', completedAt: undefined });
    });
  }, []);

  const logProgress = useCallback(async (goalId: string, amount: number, note?: string) => {
    const goal = goals.find((item) => item.id === goalId);
    if (!goal || !Number.isFinite(amount) || amount <= 0) return { error: 'Enter progress greater than zero.' };
    setProgressSaving(true); setProgressError(null);
    try {
      const previousValue = goal.currentValue;
      const response = isSupabaseConfigured ? await logGoalProgressRecord(goalId, amount, note) : { entry_id: makeId(), new_current_value: previousValue + amount, new_goal_status: previousValue + amount >= goal.targetValue ? 'completed' as const : goal.status };
      const entry: GoalProgressEntry = { id: response.entry_id, goalId, userId: user?.id ?? demoUserId, amount, note: note?.trim() || undefined, recordedOn: today(), createdAt: new Date().toISOString() };
      setProgressEntries((current) => [entry, ...current]); applyProgress(goalId, Number(response.new_current_value), response.new_goal_status);
      const reached = milestones.filter((item) => item.goalId === goalId && item.targetValue > previousValue && item.targetValue <= Number(response.new_current_value)).sort((a, b) => b.targetValue - a.targetValue)[0];
      addActivity({ goalId, type: 'progress_logged', title: `Logged ${formatGoalValue(goal.unit, amount)} toward ${goal.title}`, detail: note?.trim() || `Now at ${formatGoalValue(goal.unit, Number(response.new_current_value))}` });
      if (reached) addActivity({ goalId, type: 'milestone_reached', title: `Reached ${reached.title}`, detail: 'Progress milestone unlocked' });
      return { goalCompleted: response.new_goal_status === 'completed' && goal.status !== 'completed', milestone: reached?.title };
    } catch (error) { const message = error instanceof Error ? error.message : 'Could not save progress.'; setProgressError(message); return { error: message }; }
    finally { setProgressSaving(false); }
  }, [addActivity, applyProgress, goals, milestones, user?.id]);

  const editProgress = useCallback(async (entryId: string, amount: number, note?: string) => {
    const entry = progressEntries.find((item) => item.id === entryId); const goal = goals.find((item) => item.id === entry?.goalId);
    if (!entry || !goal || !Number.isFinite(amount) || amount <= 0) return { error: 'Enter progress greater than zero.' };
    setProgressSaving(true); setProgressError(null);
    try {
      const response = isSupabaseConfigured ? await editGoalProgressRecord(entryId, amount, note) : { new_current_value: Math.max(0, goal.currentValue - entry.amount + amount), new_goal_status: (goal.currentValue - entry.amount + amount >= goal.targetValue ? 'completed' : goal.status === 'completed' ? 'active' : goal.status) as GoalStatus };
      setProgressEntries((current) => current.map((item) => item.id === entryId ? { ...item, amount, note: note?.trim() || undefined } : item)); applyProgress(goal.id, Number(response.new_current_value), response.new_goal_status); return {};
    } catch (error) { const message = error instanceof Error ? error.message : 'Could not update progress.'; setProgressError(message); return { error: message }; }
    finally { setProgressSaving(false); }
  }, [applyProgress, goals, progressEntries]);

  const deleteProgress = useCallback(async (entryId: string) => {
    const entry = progressEntries.find((item) => item.id === entryId); const goal = goals.find((item) => item.id === entry?.goalId);
    if (!entry || !goal) return { error: 'Progress entry not found.' };
    setProgressSaving(true); setProgressError(null);
    try {
      const response = isSupabaseConfigured ? await deleteGoalProgressRecord(entryId) : { goal_id: goal.id, new_current_value: Math.max(0, goal.currentValue - entry.amount), new_goal_status: (goal.status === 'completed' ? 'active' : goal.status) as GoalStatus };
      setProgressEntries((current) => current.filter((item) => item.id !== entryId)); applyProgress(response.goal_id, Number(response.new_current_value), response.new_goal_status); return {};
    } catch (error) { const message = error instanceof Error ? error.message : 'Could not undo progress.'; setProgressError(message); return { error: message }; }
    finally { setProgressSaving(false); }
  }, [applyProgress, goals, progressEntries]);

  const ensureTodayPlan = useCallback(async (force = false) => {
    if (planningRef.current || syncing) return [];
    const date = today();
    const activeGoals = goals.filter((goal) => goal.status === 'active');
    const activeIds = new Set(activeGoals.map((goal) => goal.id));
    const existing = tasks.filter((task) => task.scheduledDate === date && (!task.goalId || activeIds.has(task.goalId)));
    const activeRules = recurrenceRules.filter((rule) => tasks.some((task) => task.recurrenceRuleId === rule.id && (!task.goalId || activeIds.has(task.goalId))));
    const missingRecurring = materialiseRecurringTasksThrough(tasks, activeRules, date, makeId);
    if (!activeGoals.length || (!force && existing.length && !missingRecurring.length)) return existing;
    planningRef.current = true; setPlanningToday(true); setDailyPlanError(null);
    let prepared: Task[] = [];
    try {
      const recurring = missingRecurring;
      if (recurring.length) {
        setTasks((current) => [...recurring, ...current]);
        if (isSupabaseConfigured) await Promise.all(recurring.map(persistNewTask));
      }
      const overdue = tasks.filter((task) => !task.recurrenceRuleId && task.status === 'pending' && task.scheduledDate < date && task.goalId && activeIds.has(task.goalId)).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)).slice(0, 2);
      const carried = overdue.map((task): Task => ({ ...task, scheduledDate: date, moveCount: task.moveCount + 1 }));
      if (carried.length) {
        const carriedIds = new Set(carried.map((task) => task.id));
        setTasks((current) => current.map((task) => carriedIds.has(task.id) ? carried.find((item) => item.id === task.id)! : task));
        if (isSupabaseConfigured) await Promise.all(carried.map((task) => persistTaskStatus(task, 'pending')));
      }
      const slots = Math.max(0, 3 - carried.length - recurring.length);
      const generated: Task[] = [];
      const carriedGoalIds = new Set(carried.map((task) => task.goalId));
      const planningOrder = [...activeGoals.filter((goal) => !carriedGoalIds.has(goal.id)), ...activeGoals.filter((goal) => carriedGoalIds.has(goal.id))];
      for (const goal of planningOrder.slice(0, slots)) {
        const goalTasks = tasks.filter((task) => task.goalId === goal.id);
        const suggestions = await aiProvider.generateDailyTasks({
          goal, milestones: milestones.filter((item) => item.goalId === goal.id), recentTasks: goalTasks.slice(-12),
          completedTasks: goalTasks.filter((task) => task.status === 'completed'), skippedTasks: goalTasks.filter((task) => task.status === 'skipped'),
          checkIns, currentProgress: goal.currentValue,
        });
        const suggestion = suggestions[0];
        if (!suggestion) continue;
        generated.push({ ...suggestion, id: makeId(), goalId: goal.id, userId: user?.id ?? demoUserId, scheduledDate: date, status: 'pending', aiGenerated: true, createdAt: new Date().toISOString(), moveCount: 0 });
      }
      if (generated.length) {
        setTasks((current) => [...carried.filter((item) => !current.some((task) => task.id === item.id)), ...generated, ...current]);
        if (isSupabaseConfigured) await Promise.all(generated.map(persistNewTask));
      }
      prepared = [...recurring, ...carried, ...generated];
      if (recurring.length || carried.length || generated.length) { const total = recurring.length + carried.length + generated.length; addActivity({ type: 'plan_adjusted', title: 'Your morning plan is ready', detail: `${total} focused action${total === 1 ? '' : 's'} for today` }); }
    } catch (error) { setDailyPlanError(error instanceof Error ? error.message : 'Could not build today’s plan.'); }
    finally { planningRef.current = false; setPlanningToday(false); }
    return prepared;
  }, [addActivity, checkIns, goals, milestones, recurrenceRules, syncing, tasks, user?.id]);

  const setTaskRecurrence = useCallback(async (taskId: string, frequency: RecurrenceChoice) => {
    const selected = tasks.find((task) => task.id === taskId);
    if (!selected) return { error: 'That action is no longer available.' };
    const now = new Date().toISOString();
    const ownerId = user?.id ?? selected.userId;
    const rule: RecurrenceRule = { id: selected.recurrenceRuleId ?? makeId(), userId: ownerId, frequency, interval: 1, startsOn: selected.scheduledDate, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', createdAt: now, updatedAt: now };
    const updated = { ...selected, userId: ownerId, recurrenceRuleId: rule.id };
    setRecurrenceRules((current) => [rule, ...current.filter((item) => item.id !== rule.id)]);
    setTasks((current) => current.map((task) => task.id === taskId ? updated : task));
    const result = await commitMutation({ type: 'recurrence_rule', rule, task: updated });
    if (result.error) return { error: result.error };
    addActivity({ goalId: selected.goalId, type: 'plan_adjusted', title: `Made “${selected.title}” recurring`, detail: frequency === 'daily' ? 'Repeats every day' : frequency === 'weekdays' ? 'Repeats every weekday' : 'Repeats every week' });
    return {};
  }, [addActivity, commitMutation, tasks, user?.id]);

  const clearTaskRecurrence = useCallback(async (taskId: string) => {
    const selected = tasks.find((task) => task.id === taskId); const ruleId = selected?.recurrenceRuleId;
    if (!selected || !ruleId) return {};
    setRecurrenceRules((current) => current.filter((rule) => rule.id !== ruleId));
    setTasks((current) => current.map((task) => task.recurrenceRuleId === ruleId ? { ...task, recurrenceRuleId: undefined } : task));
    const result = await commitMutation({ type: 'recurrence_remove', ruleId });
    if (result.error) return { error: result.error };
    addActivity({ goalId: selected.goalId, type: 'plan_adjusted', title: `Stopped repeating “${selected.title}”` });
    return {};
  }, [addActivity, commitMutation, tasks]);

  const recoverRecurringActions = useCallback(async (choice: RecoveryChoice) => {
    const activeIds = new Set(goals.filter((goal) => goal.status === 'active').map((goal) => goal.id));
    const overdue = recoveryCandidates(tasks.filter((task) => !task.goalId || activeIds.has(task.goalId)), today());
    if (!overdue.length) return {};
    const changed = buildRecoveryChanges(overdue, today(), choice);
    setTasks((current) => current.map((task) => changed.find((item) => item.id === task.id) ?? task));
    try {
      if (isSupabaseConfigured) await Promise.all(changed.map((task) => commitMutation({ type: 'task_changes', task })));
      addActivity({ type: 'plan_adjusted', title: 'Your routine was reset without guilt', detail: choice === 'light' ? 'One action kept for today; the backlog was cleared.' : choice === 'spread' ? 'Missed actions were spread across three manageable days.' : 'The old backlog was cleared so you can restart fresh.' });
      return {};
    } catch (error) { return { error: error instanceof Error ? error.message : 'Could not rebuild your routine.' }; }
  }, [addActivity, commitMutation, goals, tasks]);

  const submitCheckIn = useCallback((mood: DailyCheckIn['mood'], accomplishment: string, blocker?: string) => {
    const checkIn: DailyCheckIn = { id: makeId(), userId: user?.id ?? demoUserId, date: today(), mood, blocker, accomplishment, createdAt: new Date().toISOString() };
    setCheckIns((current) => [checkIn, ...current]);
    if (isSupabaseConfigured) void commitMutation({ type: 'check_in', checkIn });
    addActivity({ type: 'check_in', title: `Daily check-in: ${mood}`, detail: accomplishment || blocker || 'Checked in for today' });
  }, [addActivity, commitMutation, user?.id]);

  const applyAgentActions = useCallback(async (actions: AgentAction[]) => {
    setCoachSaving(true); setSyncError(null);
    try {
      for (const action of actions) {
        if (action.type === 'CREATE_TASK') {
          const task: Task = { id: makeId(), userId: user?.id ?? demoUserId, goalId: action.goalId, title: action.title, description: action.description, scheduledDate: action.scheduledDate, status: 'pending', priority: action.priority, estimatedMinutes: action.estimatedMinutes, energyLevel: action.energyLevel, aiGenerated: true, createdAt: new Date().toISOString(), moveCount: 0 };
          setTasks((current) => [task, ...current]);
          if (isSupabaseConfigured) await commitMutation({ type: 'new_task', task });
          addActivity({ goalId: task.goalId, type: 'plan_adjusted', title: `Coach added “${task.title}”`, detail: `Scheduled for ${task.scheduledDate}` });
          continue;
        }
        if (action.type === 'CREATE_CALENDAR_BLOCK') {
          await openCalendarBlockFromIso(action.title, action.startTime, action.endTime, 'Scheduled with DOIT Coach');
          addActivity({ goalId: action.goalId, type: 'plan_adjusted', title: `Time-blocked “${action.title}”` });
          continue;
        }
        if (action.type === 'UPDATE_GOAL') {
          const selected = goals.find((goal) => goal.id === action.goalId);
          if (!selected) throw new Error('That goal is no longer available.');
          const updated: Goal = { ...selected, ...action.changes, targetDate: action.changes.targetDate ?? undefined, status: action.changes.status ?? selected.status, updatedAt: new Date().toISOString() };
          setGoals((current) => current.map((goal) => goal.id === updated.id ? updated : goal));
          if (isSupabaseConfigured) await commitMutation({ type: 'goal_changes', goal: updated });
          addActivity({ goalId: updated.id, type: 'plan_adjusted', title: `Coach updated “${updated.title}”` });
          continue;
        }
        const changes = action.type === 'ADJUST_PLAN' ? action.taskChanges : action.type === 'UPDATE_TASK' ? [{ taskId: action.taskId, ...action.changes }] : action.type === 'RESCHEDULE_TASK' ? [{ taskId: action.taskId, newDate: action.newDate }] : action.type === 'COMPLETE_TASK' ? [{ taskId: action.taskId, status: 'completed' as const, actualMinutes: action.actualMinutes }] : [];
        for (const change of changes) {
          const selected = tasks.find((task) => task.id === change.taskId);
          if (!selected) throw new Error('That action is no longer available.');
          const completed = 'status' in change && change.status === 'completed';
          const updated: Task = { ...selected, ...change, scheduledDate: ('newDate' in change && change.newDate) ? change.newDate : selected.scheduledDate, completedAt: completed ? new Date().toISOString() : selected.completedAt, moveCount: 'newDate' in change && change.newDate ? selected.moveCount + 1 : selected.moveCount };
          setTasks((current) => current.map((task) => task.id === updated.id ? updated : task));
          if (isSupabaseConfigured) await commitMutation({ type: 'task_changes', task: updated });
          addActivity({ goalId: updated.goalId, type: completed ? 'task_completed' : 'plan_adjusted', title: completed ? `Completed “${updated.title}”` : `Coach adjusted “${updated.title}”` });
        }
      }
      return {};
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DOIT Coach could not apply that change.';
      setSyncError(message); return { error: message };
    } finally { setCoachSaving(false); }
  }, [addActivity, commitMutation, goals, tasks, user]);

  const setTaskDependency = useCallback(async (taskId: string, dependsOnTaskId?: string) => {
    if (taskId === dependsOnTaskId) return { error: 'An action cannot depend on itself.' };
    const previous = taskDependencies;
    const existing = previous.find((item) => item.taskId === taskId);
    const next = previous.filter((item) => item.taskId !== taskId);
    if (dependsOnTaskId) next.push({ id: existing?.id ?? makeId(), userId: user?.id ?? demoUserId, taskId, dependsOnTaskId, createdAt: existing?.createdAt ?? new Date().toISOString() });
    setTaskDependencies(next);
    try {
      if (isSupabaseConfigured) {
        const result = dependsOnTaskId ? await persistTaskDependency(next.find((item) => item.taskId === taskId)!) : await deleteTaskDependencyRecord(taskId);
        if (result.error) throw result.error;
      }
      addActivity({ goalId: tasks.find((task) => task.id === taskId)?.goalId, type: 'plan_adjusted', title: dependsOnTaskId ? 'MAX dependency updated' : 'MAX dependency removed', detail: dependsOnTaskId ? `This action now waits for “${tasks.find((task) => task.id === dependsOnTaskId)?.title ?? 'its prerequisite'}”.` : undefined });
      return {};
    } catch (error) {
      setTaskDependencies(previous);
      return { error: error instanceof Error ? error.message : 'Could not save that dependency.' };
    }
  }, [addActivity, taskDependencies, tasks, user?.id]);

  const value = useMemo(() => ({ goals, milestones, tasks, activity, checkIns, progressEntries, focusSessions, taskDependencies, calendarItems, weeklyReviews, recurrenceRules, draft, generatedPlan, syncing, syncState, pendingChanges, lastSyncedAt, syncError, replacingTaskId, planningToday, dailyPlanError, progressSaving, progressError, coachSaving, refreshWorkspace, retrySync, ensureTodayPlan, setDraft, setGeneratedPlan, startGeneratedGoal, updateTask, completeFocusedTask, replaceTask, updateGoal, deleteGoal, logProgress, editProgress, deleteProgress, submitCheckIn, applyAgentActions, setTaskDependency, setTaskRecurrence, clearTaskRecurrence, recoverRecurringActions }), [activity, applyAgentActions, calendarItems, checkIns, clearTaskRecurrence, coachSaving, completeFocusedTask, dailyPlanError, deleteGoal, deleteProgress, draft, editProgress, ensureTodayPlan, focusSessions, generatedPlan, goals, lastSyncedAt, logProgress, milestones, pendingChanges, planningToday, progressEntries, progressError, progressSaving, recurrenceRules, recoverRecurringActions, refreshWorkspace, replaceTask, replacingTaskId, retrySync, setTaskDependency, setTaskRecurrence, startGeneratedGoal, submitCheckIn, syncError, syncing, syncState, taskDependencies, tasks, updateGoal, updateTask, weeklyReviews]);
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

const priorityRank = (priority: Task['priority']) => ({ high: 0, medium: 1, low: 2 })[priority];
const formatGoalValue = (unit: string, value: number) => unit === '%' ? `${value}%` : `${unit}${value}`;

export function useAppStore() {
  const value = useContext(AppStoreContext);
  if (!value) throw new Error('useAppStore must be used within AppStoreProvider');
  return value;
}
