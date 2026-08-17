import type { GoalPlanClarification } from '@/types';

export const MAX_GOAL_CLARIFICATION_ROUNDS = 1;

export function buildClarificationContext(clarification: GoalPlanClarification, answers: string[]) {
  const answered = clarification.questions.map((question, index) => ({
    question: question.trim(),
    answer: answers[index]?.trim() ?? '',
  })).filter((item) => item.answer);

  return {
    // The local planner can interpret the answers without question wording
    // being mistaken for part of the goal itself.
    additionalDetails: answered.map((item) => item.answer).join('\n'),
    // The remote planner receives the exact question-to-answer relationship.
    clarificationTranscript: JSON.stringify(answered),
    clarificationRound: String(MAX_GOAL_CLARIFICATION_ROUNDS),
    clarificationResolved: 'true',
  };
}

export function clarificationWasResolved(context?: Record<string, string>) {
  return context?.clarificationResolved === 'true' || Number(context?.clarificationRound ?? 0) >= MAX_GOAL_CLARIFICATION_ROUNDS;
}

export function uniqueClarificationQuestions(questions: string[]) {
  const accepted: { question: string; words: Set<string> }[] = [];
  for (const raw of questions) {
    const question = raw.trim();
    if (!question) continue;
    const words = meaningfulWords(question);
    const repeats = accepted.some((item) => similarity(words, item.words) >= 0.62);
    if (!repeats) accepted.push({ question, words });
  }
  return accepted.map((item) => item.question).slice(0, 3);
}

function meaningfulWords(value: string) {
  const ignored = new Set(['a', 'an', 'and', 'are', 'can', 'do', 'does', 'for', 'give', 'how', 'is', 'it', 'look', 'like', 'me', 'one', 'or', 'right', 'the', 'this', 'to', 'what', 'which', 'you', 'your']);
  return new Set(value.toLowerCase().replace(/[^a-z0-9£]+/g, ' ').split(' ').filter((word) => word.length > 1 && !ignored.has(word)));
}

function similarity(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  left.forEach((word) => { if (right.has(word)) shared += 1; });
  return shared / Math.min(left.size, right.size);
}
