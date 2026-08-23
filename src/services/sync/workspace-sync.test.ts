import { describe, expect, it } from 'vitest';

import { bindMutationToUser } from './workspace-ownership';
import { isSafelyStaleQueuedMutation, workspaceSyncErrorMessage } from './sync-errors';

describe('workspace sync recovery', () => {
  it('shows the useful message from Supabase error objects', () => {
    expect(workspaceSyncErrorMessage({ code: '23503', message: 'Goal no longer exists' })).toBe('Goal no longer exists');
  });

  it('drops only idempotent stale mutations after a foreign-key failure', () => {
    const staleError = { code: '23503', message: 'Referenced goal was deleted' };
    expect(isSafelyStaleQueuedMutation(staleError, { type: 'activity' } as never)).toBe(true);
    expect(isSafelyStaleQueuedMutation(staleError, { type: 'goal_plan' } as never)).toBe(false);
    expect(isSafelyStaleQueuedMutation({ code: '42501' }, { type: 'activity' } as never)).toBe(false);
  });

  it('repairs stale recurrence ownership before retrying a queued write', () => {
    const mutation = bindMutationToUser({
      type: 'recurrence_rule',
      rule: { id: 'rule', userId: 'old-user' },
      task: { id: 'task', userId: 'old-user' },
    } as never, 'signed-in-user');

    expect(mutation.type).toBe('recurrence_rule');
    if (mutation.type !== 'recurrence_rule') return;
    expect(mutation.rule.userId).toBe('signed-in-user');
    expect(mutation.task.userId).toBe('signed-in-user');
  });
});
