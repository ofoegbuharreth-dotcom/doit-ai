import { describe, expect, it } from 'vitest';

import type { RecurrenceRule, Task } from '@/types';
import { buildRecoveryChanges, materialiseRecurringTasks, materialiseRecurringTasksThrough, ruleOccursOn } from './recurrence';

const rule = (values: Partial<RecurrenceRule> = {}): RecurrenceRule => ({ id: 'rule', userId: 'user', frequency: 'daily', interval: 1, startsOn: '2026-08-20', timezone: 'Europe/London', createdAt: '', updatedAt: '', ...values });
const task = (values: Partial<Task> = {}): Task => ({ id: 'task', userId: 'user', goalId: 'goal', title: 'Train', description: '', scheduledDate: '2026-08-20', status: 'completed', priority: 'high', estimatedMinutes: 20, aiGenerated: false, createdAt: '', moveCount: 0, recurrenceRuleId: 'rule', ...values });

describe('recurring actions', () => {
  it('supports weekdays without scheduling weekends', () => {
    expect(ruleOccursOn(rule({ frequency: 'weekdays' }), '2026-08-21')).toBe(true);
    expect(ruleOccursOn(rule({ frequency: 'weekdays' }), '2026-08-22')).toBe(false);
  });
  it('materialises one idempotent occurrence from the latest action', () => {
    const first = materialiseRecurringTasks([task()], [rule()], '2026-08-21', () => 'new');
    expect(first).toMatchObject([{ id: 'new', scheduledDate: '2026-08-21', status: 'pending' }]);
    expect(materialiseRecurringTasks([...first, task()], [rule()], '2026-08-21', () => 'duplicate')).toEqual([]);
  });
  it('reconstructs only the capped recent backlog after time away', () => {
    const created = materialiseRecurringTasksThrough([task()], [rule()], '2026-08-23', () => `new-${Math.random()}`, 2);
    expect(created.map((item) => item.scheduledDate)).toEqual(['2026-08-21', '2026-08-22', '2026-08-23']);
  });
  it('can spread missed actions over three days', () => {
    expect(buildRecoveryChanges([task({ id: '1' }), task({ id: '2' }), task({ id: '3' })], '2026-08-23', 'spread').map((item) => item.scheduledDate)).toEqual(['2026-08-24', '2026-08-25', '2026-08-26']);
  });
});
