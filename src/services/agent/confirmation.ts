import type { AgentAction, AgentResponse } from './schemas';

const confirmationTypes = new Set<AgentAction['type']>(['UPDATE_TASK', 'RESCHEDULE_TASK', 'UPDATE_GOAL', 'ADJUST_PLAN', 'CREATE_CALENDAR_BLOCK', 'GENERATE_PLAN']);
export const actionRequiresConfirmation = (action: AgentAction) => confirmationTypes.has(action.type);

export function summarizeAgentAction(action: AgentAction): string {
  switch (action.type) {
    case 'CREATE_TASK': return `Add “${action.title}” on ${action.scheduledDate}`;
    case 'UPDATE_TASK': return `Update task ${action.taskId}`;
    case 'RESCHEDULE_TASK': return `Move task ${action.taskId} to ${action.newDate}`;
    case 'COMPLETE_TASK': return `Mark task ${action.taskId} complete`;
    case 'UPDATE_GOAL': return `Update goal ${action.goalId}`;
    case 'ADJUST_PLAN': return `Adjust ${action.taskChanges.length} task${action.taskChanges.length === 1 ? '' : 's'}`;
    case 'CREATE_CALENDAR_BLOCK': return `Schedule “${action.title}”`;
    case 'GENERATE_PLAN': return `Generate a plan for ${action.date}`;
    case 'GENERATE_INSIGHT': return `Generate insight: ${action.topic}`;
  }
}

export interface AgentActionPreview { response: AgentResponse; requiresConfirmation: boolean; summaries: string[] }
export const createActionPreview = (response: AgentResponse): AgentActionPreview => ({ response, requiresConfirmation: response.actions.some(actionRequiresConfirmation), summaries: response.actions.map(summarizeAgentAction) });
