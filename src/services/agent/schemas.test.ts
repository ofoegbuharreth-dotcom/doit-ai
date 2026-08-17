import { describe, expect, it } from 'vitest';
import { AgentResponseSchema } from './schemas';

describe('AgentResponseSchema', () => {
  it('accepts a valid, typed reschedule action', () => {
    const result = AgentResponseSchema.safeParse({ message: 'I can move it.', actions: [{ type: 'RESCHEDULE_TASK', taskId: 'task-1', newDate: '2026-08-11' }] });
    expect(result.success).toBe(true);
  });

  it('rejects unknown action fields and malformed dates', () => {
    const result = AgentResponseSchema.safeParse({ message: 'Unsafe output', actions: [{ type: 'RESCHEDULE_TASK', taskId: 'task-1', newDate: 'tomorrow', userId: 'someone-else' }] });
    expect(result.success).toBe(false);
  });

  it('rejects calendar blocks whose end precedes their start', () => {
    const result = AgentResponseSchema.safeParse({ message: 'Schedule it.', actions: [{ type: 'CREATE_CALENDAR_BLOCK', title: 'Focus', itemType: 'focus', startTime: '2026-08-11T12:00:00.000Z', endTime: '2026-08-11T11:00:00.000Z', isFixed: false }] });
    expect(result.success).toBe(false);
  });
});
