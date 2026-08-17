import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAppStore } from '@/stores';
import type { Goal, Task } from '@/types';
import { today } from '@/utils';
import { useAuth } from './use-auth';

export type DailyEnergy = 'low' | 'steady' | 'high';
export type DailyPlanSettings = { availableMinutes: number; energy: DailyEnergy; startTime: string };
export type DailyPlanItem = { taskId: string; startTime: string; endTime: string; risk?: 'watch' | 'urgent' };
export type AdaptivePlan = DailyPlanSettings & { date: string; items: DailyPlanItem[]; createdAt: string };

const priorityPoints = { high: 30, medium: 20, low: 10 };
const energyPoints = { low: 0, medium: 1, high: 2 };

function goalRisk(goal?: Goal): DailyPlanItem['risk'] {
  if (!goal?.targetDate || goal.status !== 'active') return undefined;
  const days = Math.ceil((new Date(`${goal.targetDate}T23:59:59`).getTime() - Date.now()) / 86_400_000);
  const progress = goal.targetValue > 0 ? goal.currentValue / goal.targetValue : 0;
  if (days <= 2 && progress < 0.95) return 'urgent';
  if (days <= 7 && progress < 0.8) return 'watch';
  return undefined;
}

function scoreTask(task: Task, goal: Goal | undefined, energy: DailyEnergy) {
  const risk = goalRisk(goal);
  const desiredEnergy = energy === 'steady' ? 1 : energy === 'high' ? 2 : 0;
  const taskEnergy = task.energyLevel ? energyPoints[task.energyLevel] : 1;
  return priorityPoints[task.priority] + task.moveCount * 7 + (risk === 'urgent' ? 45 : risk === 'watch' ? 22 : 0) + (taskEnergy === desiredEnergy ? 9 : -Math.abs(taskEnergy - desiredEnergy) * 6);
}

function toMinutes(value: string) {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function fromMinutes(value: number) {
  const wrapped = Math.max(0, value) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

function composePlan(settings: DailyPlanSettings, tasks: Task[], goals: Goal[], completedIds: string[] = []): AdaptivePlan {
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));
  const completed = completedIds.map((id) => tasks.find((task) => task.id === id)).filter((task): task is Task => Boolean(task));
  const used = completed.reduce((total, task) => total + Math.max(5, task.estimatedMinutes || 25), 0);
  const candidates = tasks
    .filter((task) => task.scheduledDate === today() && task.status === 'pending' && !completedIds.includes(task.id))
    .sort((left, right) => scoreTask(right, goalById.get(right.goalId ?? ''), settings.energy) - scoreTask(left, goalById.get(left.goalId ?? ''), settings.energy));
  const selected = [...completed];
  let plannedMinutes = used;
  for (const task of candidates) {
    if (selected.length >= 3) break;
    const duration = Math.max(5, task.estimatedMinutes || 25);
    if (selected.length > completed.length && plannedMinutes + duration > settings.availableMinutes) continue;
    if (!selected.length || plannedMinutes + duration <= settings.availableMinutes) {
      selected.push(task);
      plannedMinutes += duration;
    }
  }
  if (!selected.length && candidates[0]) selected.push(candidates[0]);
  let cursor = toMinutes(settings.startTime);
  const items = selected.map((task) => {
    const duration = Math.max(5, task.estimatedMinutes || 25);
    const item: DailyPlanItem = { taskId: task.id, startTime: fromMinutes(cursor), endTime: fromMinutes(cursor + duration), risk: goalRisk(goalById.get(task.goalId ?? '')) };
    cursor += duration + 5;
    return item;
  });
  return { ...settings, date: today(), items, createdAt: new Date().toISOString() };
}

export function useAdaptivePlan() {
  const { user } = useAuth();
  const { goals, tasks, ensureTodayPlan } = useAppStore();
  const [plan, setPlan] = useState<AdaptivePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const storageKey = useMemo(() => `doit:adaptive-plan:${user?.id ?? 'demo'}:${today()}`, [user?.id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    AsyncStorage.getItem(storageKey).then((stored) => {
      if (!active) return;
      const parsed = stored ? JSON.parse(stored) as AdaptivePlan : null;
      setPlan(parsed?.date === today() ? parsed : null);
    }).catch(() => active && setPlan(null)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [storageKey]);

  const save = useCallback(async (next: AdaptivePlan | null) => {
    setPlan(next);
    if (next) await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    else await AsyncStorage.removeItem(storageKey);
  }, [storageKey]);

  const build = useCallback(async (settings: DailyPlanSettings) => {
    const prepared = (await ensureTodayPlan()) ?? [];
    const merged = [...prepared, ...tasks.filter((task) => !prepared.some((item) => item.id === task.id))];
    const next = composePlan(settings, merged, goals);
    await save(next);
    return next;
  }, [ensureTodayPlan, goals, save, tasks]);

  const rebalance = useCallback(async () => {
    if (!plan) return;
    const completedIds = plan.items.filter((item) => tasks.find((task) => task.id === item.taskId)?.status === 'completed').map((item) => item.taskId);
    await save(composePlan(plan, tasks, goals, completedIds));
  }, [goals, plan, save, tasks]);

  useEffect(() => {
    if (!plan) return;
    const invalid = plan.items.some((item) => {
      const status = tasks.find((task) => task.id === item.taskId)?.status;
      return !status || status === 'skipped' || status === 'moved';
    });
    if (invalid) void rebalance();
  }, [plan, rebalance, tasks]);

  return { plan, loading, build, rebalance, clear: () => save(null) };
}
