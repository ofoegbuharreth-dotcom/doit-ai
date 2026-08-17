import type { Goal, GoalProgressEntry, Task } from '@/types';

export type GoalHealth = { level: 'healthy' | 'watch' | 'at-risk'; title: string; message: string };

export function getGoalHealth(goal: Goal, tasks: Task[], progress: GoalProgressEntry[], now = new Date()): GoalHealth {
  if (goal.status === 'completed') return { level: 'healthy', title: 'Goal achieved', message: 'The target has been completed.' };
  if (goal.status === 'paused') return { level: 'watch', title: 'Goal paused', message: 'Resume it when you are ready for actions to return to Today.' };
  const date = now.toISOString().slice(0, 10);
  const goalTasks = tasks.filter((task) => task.goalId === goal.id);
  const overdue = goalTasks.filter((task) => task.status === 'pending' && task.scheduledDate < date);
  const recentCutoff = now.getTime() - 7 * 86_400_000;
  const recentWins = goalTasks.filter((task) => task.status === 'completed' && task.completedAt && new Date(task.completedAt).getTime() >= recentCutoff).length;
  const recentProgress = progress.some((entry) => entry.goalId === goal.id && new Date(entry.createdAt).getTime() >= recentCutoff);
  const skipped = goalTasks.filter((task) => task.status === 'skipped').length;
  const completed = goalTasks.filter((task) => task.status === 'completed').length;
  if (goal.targetDate) {
    const daysLeft = Math.ceil((new Date(`${goal.targetDate}T23:59:59`).getTime() - now.getTime()) / 86_400_000);
    const remainingPercent = Math.max(0, 1 - goal.currentValue / Math.max(1, goal.targetValue));
    if (daysLeft < 0) return { level: 'at-risk', title: 'Deadline passed', message: 'Move the deadline or simplify the remaining outcome today.' };
    if (daysLeft <= 7 && remainingPercent > 0.35) return { level: 'at-risk', title: 'Deadline pressure', message: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left with ${Math.round(remainingPercent * 100)}% still to complete.` };
  }
  if (overdue.length >= 3) return { level: 'at-risk', title: 'Plan is backing up', message: `${overdue.length} actions are overdue. Reschedule, replace, or remove the least useful ones.` };
  if (skipped >= Math.max(3, completed)) return { level: 'watch', title: 'Actions are not fitting', message: 'Skipped actions are outnumbering wins. Ask Coach to make the plan easier or more specific.' };
  if (!recentWins && !recentProgress && goalTasks.length) return { level: 'watch', title: 'No movement this week', message: 'Complete one small action or log real progress to restart momentum.' };
  return { level: 'healthy', title: 'On track', message: recentWins ? `${recentWins} action${recentWins === 1 ? '' : 's'} completed in the last seven days.` : 'The plan has no urgent warning signs.' };
}
