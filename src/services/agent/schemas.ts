import { z } from 'zod';

const id = z.string().trim().min(1).max(128);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const dateTime = z.string().datetime({ offset: true });
const title = z.string().trim().min(1).max(200);
const priority = z.enum(['low', 'medium', 'high']);
const energy = z.enum(['low', 'medium', 'high']);

export const CreateTaskActionSchema = z.object({
  type: z.literal('CREATE_TASK'), goalId: id.optional(), title, description: z.string().trim().max(2000).default(''),
  scheduledDate: date, priority: priority.default('medium'), estimatedMinutes: z.number().int().min(1).max(1440), energyLevel: energy.optional(),
}).strict();

export const UpdateTaskActionSchema = z.object({
  type: z.literal('UPDATE_TASK'), taskId: id,
  changes: z.object({ title: title.optional(), description: z.string().trim().max(2000).optional(), priority: priority.optional(), estimatedMinutes: z.number().int().min(1).max(1440).optional(), energyLevel: energy.optional(), notes: z.string().trim().max(4000).optional() }).strict().refine((value) => Object.keys(value).length > 0, 'At least one task change is required'),
}).strict();

export const RescheduleTaskActionSchema = z.object({ type: z.literal('RESCHEDULE_TASK'), taskId: id, newDate: date, reason: z.string().trim().max(500).optional() }).strict();
export const CompleteTaskActionSchema = z.object({ type: z.literal('COMPLETE_TASK'), taskId: id, actualMinutes: z.number().int().min(0).max(1440).optional() }).strict();

export const UpdateGoalActionSchema = z.object({
  type: z.literal('UPDATE_GOAL'), goalId: id,
  changes: z.object({ title: title.optional(), description: z.string().trim().max(4000).optional(), targetDate: date.nullable().optional(), currentValue: z.number().min(0).optional(), status: z.enum(['active', 'completed', 'archived']).optional() }).strict().refine((value) => Object.keys(value).length > 0, 'At least one goal change is required'),
}).strict();

export const AdjustPlanActionSchema = z.object({
  type: z.literal('ADJUST_PLAN'), goalId: id.optional(), reason: z.string().trim().min(1).max(1000),
  taskChanges: z.array(z.object({ taskId: id, newDate: date.optional(), estimatedMinutes: z.number().int().min(1).max(1440).optional(), priority: priority.optional() }).strict()).min(1).max(50),
}).strict();

export const CreateCalendarBlockActionSchema = z.object({
  type: z.literal('CREATE_CALENDAR_BLOCK'), title, itemType: z.enum(['task', 'focus', 'event', 'break', 'deadline']),
  startTime: dateTime, endTime: dateTime, goalId: id.optional(), taskId: id.optional(), isFixed: z.boolean().default(false),
}).strict().refine((value) => new Date(value.endTime) > new Date(value.startTime), { message: 'End time must be after start time', path: ['endTime'] });

export const GeneratePlanActionSchema = z.object({ type: z.literal('GENERATE_PLAN'), goalId: id.optional(), date }).strict();
export const GenerateInsightActionSchema = z.object({ type: z.literal('GENERATE_INSIGHT'), goalId: id.optional(), topic: z.string().trim().min(1).max(300) }).strict();

export const AgentActionSchema = z.discriminatedUnion('type', [CreateTaskActionSchema, UpdateTaskActionSchema, RescheduleTaskActionSchema, CompleteTaskActionSchema, UpdateGoalActionSchema, AdjustPlanActionSchema, CreateCalendarBlockActionSchema, GeneratePlanActionSchema, GenerateInsightActionSchema]);
export const AgentResponseSchema = z.object({ message: z.string().trim().min(1).max(2000), actions: z.array(AgentActionSchema).max(50) }).strict();

export type AgentAction = z.infer<typeof AgentActionSchema>;
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export function parseAgentResponse(input: unknown): AgentResponse {
  return AgentResponseSchema.parse(input);
}
