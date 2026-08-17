import type { Goal, Task } from '@/types';

export const goalProgress = (goal: Goal) =>
  goal.targetValue <= 0 ? 0 : Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));

export const taskProgress = (tasks: Task[]) => {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((task) => task.status === 'completed').length / tasks.length) * 100);
};

export const completionStreak = (tasks: Task[]) => {
  const days = new Set(tasks.filter((task) => task.status === 'completed' && task.completedAt).map((task) => task.completedAt!.slice(0, 10)));
  const cursor = new Date();
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
  return streak;
};
