import { describe, expect, it } from 'vitest';

import type { AgentContext } from '@/services/agent';
import type { Goal, Task } from '@/types';
import { MockAIProvider } from './mock-provider';

const goal: Goal = { id: 'goal-1', userId: 'user-1', title: 'Save £1,000', description: '', status: 'active', currentValue: 0, targetValue: 1000, unit: '£', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' };
const task: Task = { id: 'task-1', userId: 'user-1', goalId: goal.id, title: 'Transfer the first £50', description: '', scheduledDate: '2026-08-11', status: 'pending', priority: 'high', estimatedMinutes: 15, aiGenerated: true, createdAt: '2026-08-11T00:00:00.000Z', moveCount: 0 };
const context: AgentContext = { generatedAt: '2026-08-11T10:00:00.000Z', request: '', activeGoals: [goal], relevantMilestones: [], todayTasks: [task], upcomingTasks: [], overdueTasks: [], recentCompletedTasks: [], recentSkippedTasks: [], checkIns: [], approachingDeadlines: [], calendarItems: [] };

describe('DOIT Coach local interpretation', () => {
  it('targets a named action when rescheduling', async () => {
    const response = await new MockAIProvider().interpretAgentRequest('move the transfer action to tomorrow', context);
    expect(response.actions[0]).toMatchObject({ type: 'RESCHEDULE_TASK', taskId: task.id });
  });

  it('creates the requested calendar time and duration', async () => {
    const response = await new MockAIProvider().interpretAgentRequest('time block the transfer at 6pm for 30 minutes', context);
    const action = response.actions[0];
    expect(action).toMatchObject({ type: 'CREATE_CALENDAR_BLOCK', taskId: task.id });
    if (!action || action.type !== 'CREATE_CALENDAR_BLOCK') throw new Error('Expected a calendar block');
    expect(new Date(action.endTime).getTime() - new Date(action.startTime).getTime()).toBe(30 * 60_000);
    expect(new Date(action.startTime).getHours()).toBe(18);
  });

  it('understands urgent as a priority change', async () => {
    const response = await new MockAIProvider().interpretAgentRequest('make the transfer action urgent', context);
    expect(response.actions[0]).toMatchObject({ type: 'UPDATE_TASK', taskId: task.id, changes: { priority: 'high' } });
  });

  it('responds naturally to a greeting instead of repeating an empty-state error', async () => {
    const response = await new MockAIProvider().interpretAgentRequest('Hi', context);
    expect(response.message).toContain('I’m ready');
    expect(response.actions).toEqual([]);
  });
});
