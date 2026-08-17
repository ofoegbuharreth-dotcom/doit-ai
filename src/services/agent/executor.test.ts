import { describe, expect, it, vi } from 'vitest';
import type { Goal, Task } from '@/types';
import type { AgentExecutionGateway } from './executor';
import { cancelAgentResponse, executeAgentResponse } from './executor';
import { createActionPreview } from './confirmation';

const task: Task = { id: 'task-1', goalId: 'goal-1', userId: 'user-1', title: 'Test', description: '', scheduledDate: '2026-08-10', status: 'pending', priority: 'high', estimatedMinutes: 20, aiGenerated: true, createdAt: '2026-08-10T00:00:00Z', moveCount: 0 };
const goal: Goal = { id: 'goal-1', userId: 'user-1', title: 'Goal', description: '', status: 'active', targetValue: 100, currentValue: 20, unit: '%', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' };
const gateway = (owned = true): AgentExecutionGateway => ({
  getTask: vi.fn(async () => owned ? task : null), getGoal: vi.fn(async () => owned ? goal : null), createTask: vi.fn(async () => 'new-task'),
  updateTask: vi.fn(async () => undefined), updateGoal: vi.fn(async () => undefined), createCalendarBlock: vi.fn(async () => 'block-1'),
  generatePlan: vi.fn(async () => undefined), generateInsight: vi.fn(async () => undefined), recordAgentAction: vi.fn(async () => undefined),
});
const response = { message: 'I can move it.', actions: [{ type: 'RESCHEDULE_TASK' as const, taskId: 'task-1', newDate: '2026-08-11' }] };

describe('executeAgentResponse', () => {
  it('previews meaningful changes without applying them', async () => {
    const data = gateway(); const result = await executeAgentResponse(response, { request: 'Move it', userId: 'user-1', gateway: data });
    expect(result.status).toBe('awaiting_confirmation'); expect(data.updateTask).not.toHaveBeenCalled();
  });

  it('applies confirmed changes after ownership validation', async () => {
    const data = gateway(); const result = await executeAgentResponse(response, { request: 'Move it', userId: 'user-1', gateway: data, confirmed: true });
    expect(result.status).toBe('applied'); expect(data.getTask).toHaveBeenCalledWith('user-1', 'task-1'); expect(data.updateTask).toHaveBeenCalledOnce();
  });

  it('blocks references that are not owned by the active user', async () => {
    const data = gateway(false); const result = await executeAgentResponse(response, { request: 'Move it', userId: 'user-1', gateway: data, confirmed: true });
    expect(result.status).toBe('failed'); expect(data.updateTask).not.toHaveBeenCalled();
  });

  it('allows explicit completion without a confirmation round-trip', async () => {
    const data = gateway(); const completion = { message: 'Done.', actions: [{ type: 'COMPLETE_TASK' as const, taskId: 'task-1' }] };
    const result = await executeAgentResponse(completion, { request: 'Mark it complete', userId: 'user-1', gateway: data });
    expect(result.status).toBe('applied'); expect(data.updateTask).toHaveBeenCalledOnce();
  });

  it('records a cancelled preview without mutating data', async () => {
    const data = gateway(); await cancelAgentResponse('Move it', 'user-1', createActionPreview(response), data);
    expect(data.recordAgentAction).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' })); expect(data.updateTask).not.toHaveBeenCalled();
  });
});
