import type { Goal, GoalActivity, Milestone, Task } from '@/types';
import { today, tomorrow } from '@/utils';

const now = new Date().toISOString();
export const demoUserId = 'demo-user';

export const initialGoals: Goal[] = [
  { id: 'goal-save', userId: demoUserId, title: 'Save £500 for a new PC', description: 'Turn unused things and weekly savings into a new setup.', status: 'active', targetValue: 500, currentValue: 127, unit: '£', targetDate: '2026-10-30', createdAt: now, updatedAt: now },
  { id: 'goal-spanish', userId: demoUserId, title: 'Hold a conversation in Spanish', description: 'Build a daily speaking habit.', status: 'active', targetValue: 100, currentValue: 36, unit: '%', targetDate: '2026-12-15', createdAt: now, updatedAt: now },
];

export const initialMilestones: Milestone[] = [
  { id: 'm1', goalId: 'goal-save', title: '£100 saved', description: 'First buffer secured.', targetValue: 100, sortOrder: 0, status: 'completed', completedAt: now },
  { id: 'm2', goalId: 'goal-save', title: '£250 saved', description: 'Halfway point in sight.', targetValue: 250, sortOrder: 1, status: 'current' },
  { id: 'm3', goalId: 'goal-save', title: '£400 saved', description: 'Final stretch.', targetValue: 400, sortOrder: 2, status: 'pending' },
  { id: 'm4', goalId: 'goal-save', title: '£500 achieved', description: 'Ready to buy.', targetValue: 500, sortOrder: 3, status: 'pending' },
  { id: 's1', goalId: 'goal-spanish', title: 'Complete 10 speaking sessions', description: 'Build confidence aloud.', targetValue: 25, sortOrder: 0, status: 'completed', completedAt: now },
  { id: 's2', goalId: 'goal-spanish', title: 'Talk for five minutes', description: 'Use familiar topics.', targetValue: 50, sortOrder: 1, status: 'current' },
  { id: 's3', goalId: 'goal-spanish', title: 'Hold a full conversation', description: 'Stay in Spanish.', targetValue: 100, sortOrder: 2, status: 'pending' },
];

export const initialTasks: Task[] = [
  { id: 't1', goalId: 'goal-save', userId: demoUserId, title: 'List two unused items', description: 'Photograph and price two items.', scheduledDate: today(), status: 'completed', priority: 'high', estimatedMinutes: 20, aiGenerated: true, createdAt: now, completedAt: now, moveCount: 0 },
  { id: 't2', goalId: 'goal-save', userId: demoUserId, title: 'Set this week’s saving target', description: 'Choose a realistic number and move it aside.', scheduledDate: today(), status: 'pending', priority: 'high', estimatedMinutes: 10, aiGenerated: true, createdAt: now, moveCount: 0 },
  { id: 't3', goalId: 'goal-spanish', userId: demoUserId, title: 'Speak Spanish for 10 minutes', description: 'Describe your day without switching language.', scheduledDate: today(), status: 'pending', priority: 'medium', estimatedMinutes: 10, aiGenerated: true, createdAt: now, moveCount: 0 },
  { id: 't4', goalId: 'goal-spanish', userId: demoUserId, title: 'Review 12 useful phrases', description: 'Focus on phrases you can use today.', scheduledDate: tomorrow(), status: 'pending', priority: 'low', estimatedMinutes: 15, aiGenerated: true, createdAt: now, moveCount: 0 },
];

export const initialActivity: GoalActivity[] = [
  { id: 'a1', goalId: 'goal-save', userId: demoUserId, type: 'task_completed', title: 'Completed “List two unused items”', detail: 'Save £500 for a new PC', createdAt: now },
  { id: 'a2', goalId: 'goal-save', userId: demoUserId, type: 'milestone_reached', title: 'Reached £100 saved', detail: 'Momentum unlocked', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'a3', goalId: 'goal-spanish', userId: demoUserId, type: 'plan_adjusted', title: 'DOIT adjusted tomorrow’s plan', detail: 'Shorter speaking block, same momentum', createdAt: new Date(Date.now() - 172800000).toISOString() },
];
