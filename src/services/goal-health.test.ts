import { describe, expect, it } from 'vitest';

import { getGoalHealth } from './goal-health';
import type { Goal, Task } from '@/types';

const now = new Date('2026-08-12T12:00:00Z');
const goal: Goal = { id: 'g1', userId: 'u1', title: 'Ship project', description: 'Finish it', status: 'active', targetValue: 10, currentValue: 2, unit: 'steps', targetDate: '2026-08-15', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' };
const task = (id: string, scheduledDate: string, status: Task['status'] = 'pending'): Task => ({ id, userId: 'u1', goalId: 'g1', title: id, description: id, scheduledDate, status, priority: 'medium', estimatedMinutes: 20, aiGenerated: true, createdAt: '2026-08-01T00:00:00Z', moveCount: 0 });

describe('getGoalHealth', () => {
  it('warns when a deadline is close and much of the goal remains', () => expect(getGoalHealth(goal, [], [], now)).toMatchObject({ level: 'at-risk', title: 'Deadline pressure' }));
  it('detects an overdue backlog without a deadline', () => expect(getGoalHealth({ ...goal, targetDate: undefined }, [task('a', '2026-08-01'), task('b', '2026-08-02'), task('c', '2026-08-03')], [], now)).toMatchObject({ level: 'at-risk', title: 'Plan is backing up' }));
  it('reports recent completed work as healthy', () => expect(getGoalHealth({ ...goal, targetDate: undefined }, [{ ...task('a', '2026-08-11', 'completed'), completedAt: '2026-08-11T12:00:00Z' }], [], now)).toMatchObject({ level: 'healthy', title: 'On track' }));
});
