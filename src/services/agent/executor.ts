import type { Goal, Task } from '@/types';
import { createActionPreview, type AgentActionPreview } from './confirmation';
import { AgentResponseSchema, type AgentAction, type AgentResponse } from './schemas';

export interface AgentExecutionGateway {
  getTask(userId: string, taskId: string): Promise<Task | null>;
  getGoal(userId: string, goalId: string): Promise<Goal | null>;
  createTask(userId: string, action: Extract<AgentAction, { type: 'CREATE_TASK' }>): Promise<string>;
  updateTask(userId: string, taskId: string, changes: Record<string, unknown>): Promise<void>;
  updateGoal(userId: string, goalId: string, changes: Record<string, unknown>): Promise<void>;
  createCalendarBlock(userId: string, action: Extract<AgentAction, { type: 'CREATE_CALENDAR_BLOCK' }>): Promise<string>;
  generatePlan(userId: string, action: Extract<AgentAction, { type: 'GENERATE_PLAN' }>): Promise<void>;
  generateInsight(userId: string, action: Extract<AgentAction, { type: 'GENERATE_INSIGHT' }>): Promise<void>;
  recordAgentAction(input: { userId: string; request: string; response: AgentResponse; status: 'pending' | 'applied' | 'cancelled' | 'failed'; requiresConfirmation: boolean; error?: string }): Promise<void>;
}

export type AgentExecutionResult =
  | { status: 'awaiting_confirmation'; preview: AgentActionPreview }
  | { status: 'applied'; appliedCount: number; preview: AgentActionPreview }
  | { status: 'failed'; error: string; preview: AgentActionPreview };

export async function executeAgentResponse(input: unknown, options: { request: string; userId: string; confirmed?: boolean; gateway: AgentExecutionGateway }): Promise<AgentExecutionResult> {
  const response = AgentResponseSchema.parse(input); const preview = createActionPreview(response);
  if (preview.requiresConfirmation && !options.confirmed) {
    return { status: 'awaiting_confirmation', preview };
  }
  try {
    await authorizeAll(response.actions, options.userId, options.gateway);
    for (const action of response.actions) await applyAction(action, options.userId, options.gateway);
    await options.gateway.recordAgentAction({ userId: options.userId, request: options.request, response, status: 'applied', requiresConfirmation: preview.requiresConfirmation });
    return { status: 'applied', appliedCount: response.actions.length, preview };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent action execution failed.';
    await options.gateway.recordAgentAction({ userId: options.userId, request: options.request, response, status: 'failed', requiresConfirmation: preview.requiresConfirmation, error: message }).catch(() => undefined);
    return { status: 'failed', error: message, preview };
  }
}

export async function cancelAgentResponse(request: string, userId: string, preview: AgentActionPreview, gateway: AgentExecutionGateway) {
  await gateway.recordAgentAction({ userId, request, response: preview.response, status: 'cancelled', requiresConfirmation: preview.requiresConfirmation });
}

async function authorizeAll(actions: AgentAction[], userId: string, gateway: AgentExecutionGateway) {
  const taskIds = new Set<string>(); const goalIds = new Set<string>();
  for (const action of actions) {
    if ('taskId' in action && action.taskId) taskIds.add(action.taskId);
    if ('goalId' in action && action.goalId) goalIds.add(action.goalId);
    if (action.type === 'ADJUST_PLAN') action.taskChanges.forEach((change) => taskIds.add(change.taskId));
  }
  const [tasks, goals] = await Promise.all([
    Promise.all([...taskIds].map((taskId) => gateway.getTask(userId, taskId))),
    Promise.all([...goalIds].map((goalId) => gateway.getGoal(userId, goalId))),
  ]);
  if (tasks.some((task) => !task) || goals.some((goal) => !goal)) throw new Error('An action referenced data that does not belong to this user.');
}

async function applyAction(action: AgentAction, userId: string, gateway: AgentExecutionGateway) {
  switch (action.type) {
    case 'CREATE_TASK': await gateway.createTask(userId, action); break;
    case 'UPDATE_TASK': await gateway.updateTask(userId, action.taskId, action.changes); break;
    case 'RESCHEDULE_TASK': await gateway.updateTask(userId, action.taskId, { scheduledDate: action.newDate, status: 'pending', moveCountIncrement: 1 }); break;
    case 'COMPLETE_TASK': await gateway.updateTask(userId, action.taskId, { status: 'completed', completedAt: new Date().toISOString(), actualMinutes: action.actualMinutes }); break;
    case 'UPDATE_GOAL': await gateway.updateGoal(userId, action.goalId, action.changes); break;
    case 'ADJUST_PLAN': for (const change of action.taskChanges) await gateway.updateTask(userId, change.taskId, change); break;
    case 'CREATE_CALENDAR_BLOCK': await gateway.createCalendarBlock(userId, action); break;
    case 'GENERATE_PLAN': await gateway.generatePlan(userId, action); break;
    case 'GENERATE_INSIGHT': await gateway.generateInsight(userId, action); break;
  }
}
