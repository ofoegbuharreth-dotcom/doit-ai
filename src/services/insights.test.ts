import { describe, expect, it } from 'vitest';

import type { FocusSession, Goal, Task } from '@/types';
import { buildInsights } from './insights';

const now = new Date('2026-08-11T18:00:00.000Z');
const goal: Goal = { id: 'g1', userId: 'u1', title: 'Save £1,000', description: '', status: 'active', targetValue: 1000, currentValue: 250, unit: '£', createdAt: now.toISOString(), updatedAt: now.toISOString() };
const task = (id: string, date: string, status: Task['status'], completedAt?: string): Task => ({ id, userId: 'u1', goalId: 'g1', title: id, description: '', scheduledDate: date, status, priority: 'high', estimatedMinutes: 10, aiGenerated: true, createdAt: now.toISOString(), completedAt, moveCount: 0 });

describe('DOIT Insights', () => {
  it('calculates weekly execution and goal metrics', () => {
    const result = buildInsights([task('done', '2026-08-11', 'completed', '2026-08-11T10:00:00.000Z'), task('pending', '2026-08-11', 'pending')], [goal], [], [], now);
    expect(result.completionRate).toBe(50);
    expect(result.completedCount).toBe(1);
    expect(result.goalStats[0]).toMatchObject({ progress: 25, completed: 1, total: 2 });
  });

  it('uses focus sessions without double-counting task minutes', () => {
    const focusedTask = { ...task('focused', '2026-08-11', 'completed', '2026-08-11T09:15:00.000Z'), actualMinutes: 12 };
    const session: FocusSession = { id: 's1', userId: 'u1', taskId: 'focused', startedAt: '2026-08-11T09:00:00.000Z', endedAt: '2026-08-11T09:12:00.000Z', pausedSeconds: 0, actualMinutes: 12, status: 'completed', createdAt: now.toISOString() };
    const result = buildInsights([focusedTask], [goal], [session], [], now);
    expect(result.focusMinutes).toBe(12);
    expect(result.todayFocusMinutes).toBe(12);
    expect(result.bestTimeLabel).toContain('Morning');
  });
});
