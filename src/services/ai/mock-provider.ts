import type { AgentContext, AgentResponse } from '@/services/agent';
import type { AdaptationContext, AgentAIProvider, GoalPlanGenerationResult } from '@/types';
import { analyzeGoalIntent, buildClarificationMessage, buildClarificationQuestions, shouldAskForClarification } from './goal-intent';
import { buildGoalNextTasks, buildGoalPlan } from './local-goal-planner';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type PlanContext = Record<string, string> | undefined;

export const buildLocalGoalPlan = buildGoalPlan;

export class MockAIProvider implements AgentAIProvider {
  async generateGoalPlan(prompt: string, context?: PlanContext): Promise<GoalPlanGenerationResult> {
    await wait(260);
    const intent = analyzeGoalIntent(prompt, context);
    if (shouldAskForClarification(intent, context)) {
      return {
        type: 'clarification',
        message: buildClarificationMessage(intent),
        questions: buildClarificationQuestions(intent),
      };
    }
    return buildLocalGoalPlan(prompt, context);
  }

  async generateDailyTasks(context: AdaptationContext) {
    await wait(250);
    const candidates = buildGoalNextTasks(context.goal.title, context.goal.description, { targetDate: context.goal.targetDate ?? '' });
    const previousTitles = new Set(context.recentTasks.map((task) => task.title.toLowerCase()));
    const fresh = candidates.filter((task) => !previousTitles.has(task.title.toLowerCase()));
    if (fresh.length) return fresh;
    const nextMilestone = [...context.milestones].sort((a, b) => a.sortOrder - b.sortOrder).find((item) => item.status !== 'completed');
    return [{ title: nextMilestone ? `Work on: ${nextMilestone.title}` : `Advance ${context.goal.title}`, description: nextMilestone?.description ?? `Complete one result that can be recorded in ${context.goal.unit}.`, priority: 'high' as const, estimatedMinutes: 25 }];
  }

  async adaptPlan(context: AdaptationContext) { return { tasks: await this.generateDailyTasks(context), reason: 'The plan was simplified around your recent pace.' }; }
  async generateInsight() { return 'Complete the smallest result that produces evidence, then use that evidence to choose the next move.'; }

  async interpretAgentRequest(request: string, context: AgentContext): Promise<AgentResponse> {
    const normalized = request.toLowerCase();
    const availableTasks = [...context.overdueTasks, ...context.todayTasks, ...context.upcomingTasks];
    const matchedTask = matchTask(request, availableTasks);
    const matchedGoal = matchGoal(request, context.activeGoals);
    const requestedDate = parseRequestedDate(normalized);

    if (/^(hi|hey|hello|yo|hiya)[!. ]*$/.test(normalized)) {
      const next = context.overdueTasks[0] ?? context.todayTasks[0];
      return { message: next ? `Hey — I’m ready. Your current next move is “${next.title}”. Tell me what you want to change.` : 'Hey — I’m ready. Add a goal, capture an action, or tell me how your day changed.', actions: [] };
    }
    if (/\b(urgent|high priority|prioritise|prioritize)\b/.test(normalized)) {
      const priorityTask = matchedTask ?? context.overdueTasks[0] ?? context.todayTasks[0];
      if (priorityTask) return { message: `I can make “${priorityTask.title}” high priority.`, actions: [{ type: 'UPDATE_TASK', taskId: priorityTask.id, changes: { priority: 'high' } }] };
    }
    if (/\b(complete|completed|finish|finished|done)\b/.test(normalized) && matchedTask) {
      return { message: `Nice. I’ll mark “${matchedTask.title}” complete.`, actions: [{ type: 'COMPLETE_TASK', taskId: matchedTask.id }] };
    }
    if (/\b(time[ -]?block|calendar|schedule)\b/.test(normalized) && matchedTask && /\b(at|for|calendar|block)\b/.test(normalized)) {
      const start = parseRequestedStart(normalized, requestedDate ?? matchedTask.scheduledDate);
      const duration = parseDuration(normalized) ?? matchedTask.estimatedMinutes ?? 25;
      return { message: `I found a ${duration}-minute focus slot for “${matchedTask.title}”. Android will let you choose the calendar before saving.`, actions: [{ type: 'CREATE_CALENDAR_BLOCK', title: matchedTask.title, itemType: 'focus', startTime: start.toISOString(), endTime: new Date(start.getTime() + duration * 60_000).toISOString(), goalId: matchedTask.goalId, taskId: matchedTask.id, isFixed: false }] };
    }
    if (/\b(move|push|reschedule)\b/.test(normalized) && (matchedTask || context.todayTasks.length)) {
      const targetDate = requestedDate ?? tomorrowDate();
      const selected = matchedTask ? [matchedTask] : context.todayTasks;
      return { message: `I can move ${selected.length === 1 ? `“${selected[0]!.title}”` : `${selected.length} unfinished actions`} to ${friendlyDate(targetDate)}.`, actions: selected.map((task) => ({ type: 'RESCHEDULE_TASK' as const, taskId: task.id, newDate: targetDate, reason: 'Changed in DOIT Coach' })) };
    }
    if (/\b(easier|lighter|overwhelmed|too much|less time|simplify)\b/.test(normalized) && context.todayTasks.length) {
      return { message: 'Let’s lower the friction without losing the day. I’ll shorten today’s actions and keep the most important one first.', actions: [{ type: 'ADJUST_PLAN', reason: 'User asked DOIT Coach for a lighter plan', taskChanges: context.todayTasks.map((task, index) => ({ taskId: task.id, estimatedMinutes: Math.max(5, Math.min(task.estimatedMinutes, index === 0 ? 20 : 10)), priority: index === 0 ? 'high' as const : 'medium' as const })) }] };
    }
    if (/\b(deadline|target date|due date)\b/.test(normalized) && requestedDate && matchedGoal) {
      return { message: `I can change the deadline for “${matchedGoal.title}” to ${friendlyDate(requestedDate)}.`, actions: [{ type: 'UPDATE_GOAL', goalId: matchedGoal.id, changes: { targetDate: requestedDate } }] };
    }
    if (/\b(add|create|new|remind me to)\b/.test(normalized) && /\b(task|action|remind me to)\b/.test(normalized)) {
      const title = extractTaskTitle(request);
      const duration = parseDuration(normalized) ?? 20;
      const scheduledDate = requestedDate ?? new Date().toISOString().slice(0, 10);
      return { message: `I’ll add “${title}” to ${friendlyDate(scheduledDate)}.`, actions: [{ type: 'CREATE_TASK', goalId: matchedGoal?.id ?? context.activeGoals[0]?.id, title, description: 'Captured with DOIT Coach', scheduledDate, priority: 'medium', estimatedMinutes: duration }] };
    }
    const next = context.overdueTasks[0] ?? context.todayTasks[0];
    return { message: next ? `I want to make sure I understood you. Are you asking me to change “${next.title}”, update the goal, or plan time for it?` : 'I want to get that right. Are you trying to create an action, change a goal, or plan some time?', actions: [] };
  }
}

function matchTask(request: string, tasks: AgentContext['todayTasks']) {
  const words = usefulWords(request);
  const sorted = [...tasks].sort((a, b) => scoreMatch(b.title, words) - scoreMatch(a.title, words));
  const first = sorted[0];
  return first && scoreMatch(first.title, words) > 0 ? first : tasks.length === 1 ? tasks[0] : undefined;
}
function matchGoal(request: string, goals: AgentContext['activeGoals']) {
  const words = usefulWords(request);
  const sorted = [...goals].sort((a, b) => scoreMatch(b.title, words) - scoreMatch(a.title, words));
  const first = sorted[0];
  return first && scoreMatch(first.title, words) > 0 ? first : goals.length === 1 ? goals[0] : undefined;
}
function usefulWords(value: string) {
  const ignored = new Set(['the', 'and', 'please', 'task', 'action', 'move', 'push', 'complete', 'finish', 'schedule', 'calendar', 'today', 'tomorrow', 'minutes', 'minute']);
  return value.toLowerCase().replace(/[^a-z0-9£]+/g, ' ').split(' ').filter((word) => word.length > 2 && !ignored.has(word));
}
function scoreMatch(title: string, words: string[]) { const normalized = title.toLowerCase(); return words.reduce((score, word) => score + (normalized.includes(word) ? 1 : 0), 0); }
function parseRequestedDate(value: string) { const exact = value.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1]; if (exact) return exact; const date = new Date(); if (/\btomorrow\b/.test(value)) date.setDate(date.getDate() + 1); else if (!/\btoday\b/.test(value)) return undefined; return date.toISOString().slice(0, 10); }
function parseRequestedStart(value: string, date: string) { const match = value.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/) ?? value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/); let hour = match ? Number(match[1]) : 18; const minute = match?.[2] ? Number(match[2]) : 0; if (match?.[3] === 'pm' && hour < 12) hour += 12; if (match?.[3] === 'am' && hour === 12) hour = 0; return new Date(`${date}T${String(Math.min(hour, 23)).padStart(2, '0')}:${String(Math.min(minute, 59)).padStart(2, '0')}:00`); }
function parseDuration(value: string) { const minutes = value.match(/\b(?:for\s*)?(\d{1,3})\s*(?:min|mins|minute|minutes)\b/)?.[1]; if (minutes) return Math.max(5, Math.min(240, Number(minutes))); const hours = value.match(/\b(?:for\s*)?(\d+(?:\.\d+)?)\s*(?:hour|hours|hr|hrs)\b/)?.[1]; return hours ? Math.max(5, Math.min(240, Math.round(Number(hours) * 60))) : undefined; }
function extractTaskTitle(request: string) { const cleaned = request.replace(/^\s*(please\s+)?(add|create)\s+(a\s+)?(new\s+)?(task|action)\s+(to\s+)?/i, '').replace(/^\s*(please\s+)?remind me to\s+/i, '').replace(/\s+(today|tomorrow|on\s+20\d{2}-\d{2}-\d{2})(?:\s+at\s+.*)?$/i, '').replace(/\s+for\s+\d+(?:\.\d+)?\s*(minutes?|mins?|hours?|hrs?)\s*$/i, '').trim(); return cleaned.slice(0, 200) || 'New action'; }
function tomorrowDate() { const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10); }
function friendlyDate(value: string) { return value === new Date().toISOString().slice(0, 10) ? 'today' : value === tomorrowDate() ? 'tomorrow' : value; }
