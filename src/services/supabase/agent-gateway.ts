import type { Goal, Task } from '@/types';
import type { AgentAction, AgentExecutionGateway } from '@/services/agent';
import { supabase } from './client';

type Row = Record<string, any>;
const toTask = (row: Row): Task => ({ id: row.id, userId: row.user_id, goalId: row.goal_id ?? undefined, title: row.title, description: row.description ?? '', scheduledDate: row.scheduled_date, status: row.status, priority: row.priority, estimatedMinutes: row.estimated_minutes ?? 0, actualMinutes: row.actual_minutes ?? undefined, energyLevel: row.energy_level ?? undefined, deadline: row.deadline ?? undefined, flexibility: row.scheduling_flexibility ?? undefined, recurrenceRuleId: row.recurrence_rule_id ?? undefined, tags: row.tags ?? undefined, notes: row.notes ?? undefined, aiGenerated: row.ai_generated, createdAt: row.created_at, completedAt: row.completed_at ?? undefined, moveCount: row.move_count ?? 0 });
const toGoal = (row: Row): Goal => ({ id: row.id, userId: row.user_id, title: row.title, description: row.description ?? '', status: row.status, targetValue: Number(row.target_value), currentValue: Number(row.current_value), unit: row.unit, targetDate: row.target_date ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at });
const assertNoError = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

export const supabaseAgentGateway: AgentExecutionGateway = {
  async getTask(userId, taskId) {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId).eq('user_id', userId).maybeSingle(); assertNoError(error); return data ? toTask(data) : null;
  },
  async getGoal(userId, goalId) {
    const { data, error } = await supabase.from('goals').select('*').eq('id', goalId).eq('user_id', userId).maybeSingle(); assertNoError(error); return data ? toGoal(data) : null;
  },
  async createTask(userId, action) {
    const { data, error } = await supabase.from('tasks').insert({ user_id: userId, goal_id: action.goalId ?? null, title: action.title, description: action.description, scheduled_date: action.scheduledDate, priority: action.priority, estimated_minutes: action.estimatedMinutes, energy_level: action.energyLevel ?? null, ai_generated: true }).select('id').single(); assertNoError(error); return data!.id;
  },
  async updateTask(userId, taskId, changes) {
    const row: Row = {};
    const mapping: Record<string, string> = { title: 'title', description: 'description', priority: 'priority', estimatedMinutes: 'estimated_minutes', energyLevel: 'energy_level', notes: 'notes', scheduledDate: 'scheduled_date', status: 'status', completedAt: 'completed_at', actualMinutes: 'actual_minutes', newDate: 'scheduled_date' };
    Object.entries(changes).forEach(([key, value]) => { const column = mapping[key]; if (column && value !== undefined) row[column] = value; });
    if (changes.moveCountIncrement) { const current = await this.getTask(userId, taskId); if (!current) throw new Error('Task not found.'); row.move_count = current.moveCount + Number(changes.moveCountIncrement); }
    const { error } = await supabase.from('tasks').update(row).eq('id', taskId).eq('user_id', userId); assertNoError(error);
  },
  async updateGoal(userId, goalId, changes) {
    const row: Row = {}; const mapping: Record<string, string> = { title: 'title', description: 'description', targetDate: 'target_date', currentValue: 'current_value', status: 'status' };
    Object.entries(changes).forEach(([key, value]) => { const column = mapping[key]; if (column) row[column] = value; });
    const { error } = await supabase.from('goals').update(row).eq('id', goalId).eq('user_id', userId); assertNoError(error);
  },
  async createCalendarBlock(userId, action: Extract<AgentAction, { type: 'CREATE_CALENDAR_BLOCK' }>) {
    const { data, error } = await supabase.from('calendar_items').insert({ user_id: userId, title: action.title, type: action.itemType, start_time: action.startTime, end_time: action.endTime, goal_id: action.goalId ?? null, task_id: action.taskId ?? null, is_fixed: action.isFixed }).select('id').single(); assertNoError(error); return data!.id;
  },
  async generatePlan() { return Promise.resolve(); },
  async generateInsight() { return Promise.resolve(); },
  async recordAgentAction(input) {
    const { error } = await supabase.from('agent_actions').insert({ user_id: input.userId, request: input.request, response: input.response, status: input.status, requires_confirmation: input.requiresConfirmation, error: input.error ?? null, executed_at: input.status === 'applied' ? new Date().toISOString() : null }); assertNoError(error);
  },
};
