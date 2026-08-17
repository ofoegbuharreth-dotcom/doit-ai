import { describe, expect, it } from 'vitest';

import type { AgentContext } from '@/services/agent';
import type { Goal, Task } from '@/types';
import { extractGoalRequest, interpretConversationTurn } from './conversation';

const goal: Goal = { id: 'goal-1', userId: 'user-1', title: 'Save £756', description: '', status: 'active', currentValue: 100, targetValue: 756, unit: '£', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' };
const task: Task = { id: 'task-1', userId: 'user-1', goalId: goal.id, title: 'Create a separate savings pot', description: '', scheduledDate: new Date().toISOString().slice(0, 10), status: 'pending', priority: 'high', estimatedMinutes: 10, aiGenerated: true, createdAt: '2026-08-11T00:00:00.000Z', moveCount: 0 };
const context: AgentContext = { generatedAt: new Date().toISOString(), request: '', activeGoals: [goal], relevantMilestones: [], todayTasks: [task], upcomingTasks: [], overdueTasks: [], recentCompletedTasks: [], recentSkippedTasks: [], checkIns: [], approachingDeadlines: [], calendarItems: [] };

describe('DOIT Coach conversation', () => {
  it('extracts a natural goal without keeping the word called', () => {
    expect(extractGoalRequest('Create a goal called saving 756 pounds in the bank account')).toBe('saving 756 pounds in the bank account');
    expect(extractGoalRequest('Add a "save £730" goal')).toBe('save £730');
  });

  it('handles repeated greetings like a conversation', () => {
    const turn = interpretConversationTurn('hello hello', context);
    expect(turn?.response.message).toContain('I’m');
    expect(turn?.response.actions).toEqual([]);
  });

  it('asks for a missing calendar time and uses the answer', () => {
    const first = interpretConversationTurn('put it in my calendar bro', context, null, task.id);
    expect(first?.question).toMatchObject({ kind: 'calendar_time', taskId: task.id });
    expect(first?.response.message).toContain('What time');
    const second = interpretConversationTurn('6pm', context, first?.question, task.id);
    if (!second) throw new Error('Expected the Coach to answer the clarification');
    expect(second.response.actions[0]).toMatchObject({ type: 'CREATE_CALENDAR_BLOCK', taskId: task.id });
    const action = second.response.actions[0];
    if (action?.type !== 'CREATE_CALENDAR_BLOCK') throw new Error('Expected a calendar block');
    expect(new Date(action.startTime).getHours()).toBe(18);
  });

  it('asks for the date instead of guessing when rescheduling', () => {
    const turn = interpretConversationTurn('move it', context, null, task.id);
    expect(turn?.question).toMatchObject({ kind: 'reschedule_date', taskId: task.id });
  });

  it('answers now what with the actual next action', () => {
    const turn = interpretConversationTurn('now what', context);
    expect(turn?.response.message).toContain(task.title);
    expect(turn?.referencedTaskId).toBe(task.id);
  });

  it('asks a focused question for unclear messages', () => {
    const turn = interpretConversationTurn('do something', context);
    expect(turn?.question?.kind).toBe('general');
    expect(turn?.response.message).toContain('trying to change');
  });
});
