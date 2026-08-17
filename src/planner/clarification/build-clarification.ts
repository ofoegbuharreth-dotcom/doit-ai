import type { ParsedGoal } from '../types';

const QUESTION_BANK: Record<string, string> = {
  desired_outcome: 'What would “done” look like? Choose one measurable result or describe your own.',
  specific_subject: 'What specifically do you want to work on? Name the skill, project, habit, or result.',
  target_amount: 'How much do you want to earn? Choose a target amount, such as £250, £500, or £1,000.',
  earning_method: 'How do you want to earn it? Choose: sell products, offer a service, freelance, get a job, or another route.',
  fitness_outcome: 'What matters most right now? Choose: build strength, run farther, lose weight, improve fitness, or make a sports team.',
  starting_point: 'Where are you starting today? Give one honest baseline, example, or current result.',
  available_time: 'How much time can you realistically give this? Choose a daily or weekly amount that works on a busy week.',
  backlog_details: 'What are the items and deadlines? Paste each assignment, task, or report with its due date—even a rough list is enough.',
};

export function shouldClarifyParsedGoal(parsed: ParsedGoal) {
  return parsed.missingInformation.length > 0 || parsed.confidence < 0.48;
}

export function buildParsedGoalClarification(parsed: ParsedGoal) {
  const keys = parsed.missingInformation.length ? parsed.missingInformation : ['desired_outcome', 'starting_point'];
  return {
    type: 'clarification' as const,
    message: `I understand this as a ${parsed.intent === 'unknown' ? 'new' : parsed.intent} goal${parsed.subject ? ` about ${parsed.subject}` : ''}. Answer these and I’ll build a plan around your real outcome—not a generic checklist.`,
    questions: keys.slice(0, 3).map((key) => QUESTION_BANK[key] ?? QUESTION_BANK.desired_outcome ?? 'What exact result do you want?'),
  };
}
