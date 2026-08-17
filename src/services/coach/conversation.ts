import type { AgentContext, AgentResponse } from '@/services/agent';
import type { Task } from '@/types';

export type CoachQuestion =
  | { kind: 'calendar_time'; taskId: string; date: string; durationMinutes: number }
  | { kind: 'reschedule_date'; taskId: string }
  | { kind: 'task_title'; date: string }
  | { kind: 'general' };

export type CoachTurn = { response: AgentResponse; question?: CoachQuestion; referencedTaskId?: string };

export function extractGoalRequest(request: string) {
  if (!/\b(goal)\b/i.test(request) || !/\b(add|create|start|new|make)\b/i.test(request)) return undefined;
  const quoted = request.match(/[“"]([^”"]+)[”"]/i)?.[1]?.trim();
  if (quoted && quoted.length >= 3) return quoted;
  const cleaned = request.replace(/^\s*(please\s+)?(add|create|start|make)\s+(a\s+)?(new\s+)?/i, '').replace(/\s+(as\s+)?(a\s+)?goal\s*[.!]?$/i, '').replace(/^goal\s+(?:(?:called|named|to)\s+)?/i, '').trim();
  return cleaned.length >= 3 ? cleaned : undefined;
}

export function interpretConversationTurn(request: string, context: AgentContext, question?: CoachQuestion | null, lastTaskId?: string | null): CoachTurn | null {
  const text = request.trim();
  const normalized = text.toLowerCase();
  const tasks = [...context.overdueTasks, ...context.todayTasks, ...context.upcomingTasks];
  const remembered = tasks.find((task) => task.id === lastTaskId);

  if (/^(cancel|never ?mind|forget it|stop)$/i.test(text)) return { response: { message: 'No problem — I haven’t changed anything.', actions: [] } };
  if (question) return answerQuestion(text, context, question);

  if (/^(hi|hey|hello|yo|hiya)(\s+\1)*[!. ]*$/i.test(text)) {
    return { response: { message: remembered ? `Hey! I’m with you. Last we were talking about “${remembered.title}”. What changed?` : 'Hey! I’m here. What are we working on today?', actions: [] }, referencedTaskId: remembered?.id };
  }
  if (/\b(what'?s up|how are you|you good)\b/i.test(text)) return { response: { message: 'All good here — ready to help you make the plan actually fit your day. What’s going on?', actions: [] } };
  if (/\b(thanks|thank you|cheers|nice one)\b/i.test(text)) return { response: { message: 'Anytime. We’ll keep it moving one clear step at a time.', actions: [] } };
  if (/\b(what can you do|how can you help|help me|who are you)\b/i.test(text)) return { response: { message: 'I can create and adjust actions, change priorities and deadlines, simplify a rough day, mark work complete, and put focus time in your calendar. Tell me naturally — I’ll ask if I need one detail.', actions: [] } };

  if (/\b(now what|what next|what should i do|next move)\b/i.test(text)) {
    const next = context.overdueTasks[0] ?? context.todayTasks[0] ?? context.upcomingTasks[0];
    if (!next) return { response: { message: 'You’re clear right now. Want to create a new goal, or add one useful action for today?', actions: [] } };
    const goal = context.activeGoals.find((item) => item.id === next.goalId);
    return { response: { message: `Start with “${next.title}”. It’s a ${next.estimatedMinutes || 10}-minute step${goal ? ` toward “${goal.title}”` : ''}. Want me to time-block it, make it easier, or mark it urgent?`, actions: [] }, referencedTaskId: next.id };
  }

  if (/\b(how am i doing|my progress|am i on track|progress update|status update)\b/i.test(text)) {
    if (!context.activeGoals.length) return { response: { message: 'You don’t have an active goal yet. Tell me what you want to accomplish and I’ll help shape it.', actions: [] } };
    const summaries = context.activeGoals.slice(0, 3).map((goal) => `${goal.title}: ${Math.min(100, Math.round((goal.currentValue / Math.max(1, goal.targetValue)) * 100))}%`).join(' · ');
    return { response: { message: `Here’s the honest snapshot — ${summaries}. ${context.recentCompletedTasks.length ? `You’ve recently completed ${context.recentCompletedTasks.length} action${context.recentCompletedTasks.length === 1 ? '' : 's'}.` : 'Your next completed action will matter more than checking the percentage again.'}`, actions: [] } };
  }

  const calendarIntent = /\b(calendar|time[ -]?block|block time|schedule it|put (?:it|this|that).*(?:calendar|schedule))\b/i.test(text);
  if (calendarIntent) {
    const task = matchTask(text, tasks) ?? remembered ?? (tasks.length === 1 ? tasks[0] : undefined);
    if (!task) return { response: { message: 'Sure — which action do you want me to put on your calendar?', actions: [] }, question: { kind: 'general' } };
    const date = parseDate(normalized) ?? task.scheduledDate;
    const time = parseTime(normalized);
    const duration = parseDuration(normalized) ?? task.estimatedMinutes ?? 25;
    if (!time) return { response: { message: `What time should I block “${task.title}”? You can say something like “6pm” or “tomorrow at 9:30am”.`, actions: [] }, question: { kind: 'calendar_time', taskId: task.id, date, durationMinutes: duration }, referencedTaskId: task.id };
    return calendarTurn(task, date, time, duration);
  }

  if (/\b(move|push|reschedule)\b/i.test(text) && !parseDate(normalized)) {
    const task = matchTask(text, tasks) ?? remembered ?? (tasks.length === 1 ? tasks[0] : undefined);
    if (!task) return { response: { message: 'Which action do you want to move?', actions: [] }, question: { kind: 'general' } };
    return { response: { message: `When should I move “${task.title}” to — tomorrow, or a specific date?`, actions: [] }, question: { kind: 'reschedule_date', taskId: task.id }, referencedTaskId: task.id };
  }

  if (/^(add|create|new)\s+(a\s+)?(task|action)\s*$/i.test(text)) return { response: { message: 'What exactly needs doing? Say the action in one sentence — for example, “call the bank about the savings account”.', actions: [] }, question: { kind: 'task_title', date: localDate() } };

  if (text.split(/\s+/).length <= 4 && !/\b(done|complete|urgent|priority|tomorrow|today|easier|move|add|create)\b/i.test(text)) {
    return { response: { message: 'I want to get that right. Are you trying to change an action, update a goal, or plan some time?', actions: [] }, question: { kind: 'general' } };
  }
  return null;
}

function answerQuestion(text: string, context: AgentContext, question: CoachQuestion): CoachTurn {
  const tasks = [...context.overdueTasks, ...context.todayTasks, ...context.upcomingTasks];
  if (question.kind === 'calendar_time') {
    const task = tasks.find((item) => item.id === question.taskId);
    if (!task) return { response: { message: 'That action is no longer in your plan. Which action should I schedule instead?', actions: [] }, question: { kind: 'general' } };
    const time = parseTime(text.toLowerCase());
    if (!time) return { response: { message: 'I still need a time. Try “6pm”, “09:30”, or “tomorrow at 7pm”.', actions: [] }, question };
    return calendarTurn(task, parseDate(text.toLowerCase()) ?? question.date, time, parseDuration(text.toLowerCase()) ?? question.durationMinutes);
  }
  if (question.kind === 'reschedule_date') {
    const task = tasks.find((item) => item.id === question.taskId);
    const date = parseDate(text.toLowerCase());
    if (!task) return { response: { message: 'That action is no longer available. Which one should I move?', actions: [] }, question: { kind: 'general' } };
    if (!date) return { response: { message: 'What date should I use? You can say “tomorrow” or enter YYYY-MM-DD.', actions: [] }, question };
    return { response: { message: `Got it — I can move “${task.title}” to ${friendlyDate(date)}.`, actions: [{ type: 'RESCHEDULE_TASK', taskId: task.id, newDate: date, reason: 'Changed with DOIT Coach' }] }, referencedTaskId: task.id };
  }
  if (question.kind === 'task_title') {
    if (text.length < 4) return { response: { message: 'Give me a little more detail so I can make the action useful. What needs to be done?', actions: [] }, question };
    return { response: { message: `I’ll add “${sentenceCase(text)}” for ${friendlyDate(parseDate(text.toLowerCase()) ?? question.date)}.`, actions: [{ type: 'CREATE_TASK', goalId: context.activeGoals.length === 1 ? context.activeGoals[0]?.id : undefined, title: sentenceCase(stripDateWords(text)), description: 'Captured with DOIT Coach', scheduledDate: parseDate(text.toLowerCase()) ?? question.date, priority: 'medium', estimatedMinutes: parseDuration(text.toLowerCase()) ?? 20 }] } };
  }
  return { response: { message: 'Tell me the specific goal or action, and what you want changed. I’ll handle the rest.', actions: [] } };
}

function calendarTurn(task: Task, date: string, time: string, duration: number): CoachTurn {
  const start = new Date(`${date}T${time}:00`);
  return { response: { message: `Perfect — ${friendlyDate(date)} at ${friendlyTime(time)} for ${duration} minutes. I’ll open your calendar so you can review it before saving.`, actions: [{ type: 'CREATE_CALENDAR_BLOCK', title: task.title, itemType: 'focus', startTime: start.toISOString(), endTime: new Date(start.getTime() + duration * 60_000).toISOString(), goalId: task.goalId, taskId: task.id, isFixed: false }] }, referencedTaskId: task.id };
}

function matchTask(text: string, tasks: Task[]) {
  const ignored = new Set(['put', 'this', 'that', 'task', 'action', 'calendar', 'schedule', 'move', 'make', 'urgent', 'please', 'today', 'tomorrow', 'with', 'into']);
  const words = text.toLowerCase().replace(/[^a-z0-9£]+/g, ' ').split(' ').filter((word) => word.length > 2 && !ignored.has(word));
  const scored = tasks.map((task) => ({ task, score: words.reduce((score, word) => score + (task.title.toLowerCase().includes(word) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0].task : undefined;
}

function parseDate(text: string) { const exact = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1]; if (exact) return exact; const date = new Date(); if (/\btomorrow\b/.test(text)) date.setDate(date.getDate() + 1); else if (!/\btoday\b/.test(text)) return undefined; return localDate(date); }
function parseTime(text: string) { const match = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) ?? text.match(/\bat\s+(\d{1,2}):(\d{2})\b/) ?? text.match(/^\s*(\d{1,2}):(\d{2})\s*$/); if (!match) return undefined; let hour = Number(match[1]); const minute = Number(match[2] ?? 0); if (match[3] === 'pm' && hour < 12) hour += 12; if (match[3] === 'am' && hour === 12) hour = 0; if (hour > 23 || minute > 59) return undefined; return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`; }
function parseDuration(text: string) { const minutes = text.match(/\b(\d{1,3})\s*(?:min|mins|minute|minutes)\b/)?.[1]; if (minutes) return Math.max(5, Math.min(240, Number(minutes))); const hours = text.match(/\b(\d+(?:\.\d+)?)\s*(?:hour|hours|hr|hrs)\b/)?.[1]; return hours ? Math.max(5, Math.min(240, Math.round(Number(hours) * 60))) : undefined; }
function localDate(date = new Date()) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }
function friendlyDate(date: string) { const today = localDate(); const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); return date === today ? 'today' : date === localDate(tomorrow) ? 'tomorrow' : date; }
function friendlyTime(time: string) { const [hour, minute] = time.split(':').map(Number); const suffix = hour! >= 12 ? 'pm' : 'am'; const displayHour = hour! % 12 || 12; return `${displayHour}:${String(minute).padStart(2, '0')}${suffix}`; }
function stripDateWords(text: string) { return text.replace(/\s+(today|tomorrow)(?:\s+at\s+.*)?$/i, '').replace(/\s+for\s+\d+(?:\.\d+)?\s*(minutes?|mins?|hours?|hrs?)\s*$/i, '').trim(); }
function sentenceCase(text: string) { const clean = text.trim(); return clean ? clean[0]!.toUpperCase() + clean.slice(1) : clean; }
