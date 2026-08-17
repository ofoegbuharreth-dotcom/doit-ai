import { describe, expect, it } from 'vitest';
import type { Goal, Task } from '@/types';
import { buildAgentContext } from './context-builder';

const goal: Goal = { id: 'goal-1', userId: 'user-1', title: 'Ship V2', description: '', status: 'active', targetValue: 100, currentValue: 40, unit: '%', targetDate: '2026-08-15', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' };
const task = (id: string, scheduledDate: string, status: Task['status']): Task => ({ id, goalId: goal.id, userId: goal.userId, title: id, description: '', scheduledDate, status, priority: 'medium', estimatedMinutes: 20, aiGenerated: true, createdAt: '2026-08-01T00:00:00Z', completedAt: status === 'completed' ? '2026-08-09T12:00:00Z' : undefined, moveCount: 0 });
const source = { goals: [goal], milestones: [], tasks: [task('overdue', '2026-08-09', 'pending'), task('today', '2026-08-10', 'pending'), task('done', '2026-08-09', 'completed')], checkIns: [], activity: [] };

describe('buildAgentContext', () => {
  it('selects current execution context without sending history unnecessarily', () => {
    const context = buildAgentContext('What should I do now?', source, new Date('2026-08-10T12:00:00Z'));
    expect(context.todayTasks.map((item) => item.id)).toEqual(['today']);
    expect(context.overdueTasks.map((item) => item.id)).toEqual(['overdue']);
    expect(context.recentCompletedTasks).toEqual([]);
  });

  it('includes bounded history for weekly progress questions', () => {
    const context = buildAgentContext('How am I doing this week?', source, new Date('2026-08-10T12:00:00Z'));
    expect(context.recentCompletedTasks.map((item) => item.id)).toEqual(['done']);
    expect(context.approachingDeadlines.map((item) => item.id)).toEqual(['goal-1']);
  });
});
