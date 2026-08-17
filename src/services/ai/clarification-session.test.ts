import { describe, expect, it } from 'vitest';

import type { GoalPlanClarification } from '@/types';
import { buildClarificationContext, clarificationWasResolved, uniqueClarificationQuestions } from './clarification-session';
import { MockAIProvider } from './mock-provider';

const clarification: GoalPlanClarification = {
  type: 'clarification',
  message: 'A quick check',
  questions: ['What does done look like?', 'How much time can you give it each week?'],
};

describe('goal clarification session', () => {
  it('preserves question-answer relationships and marks the only round resolved', () => {
    const context = buildClarificationContext(clarification, ['Publish a playable game', 'Three hours']);
    expect(context.additionalDetails).toBe('Publish a playable game\nThree hours');
    expect(JSON.parse(context.clarificationTranscript)).toEqual([
      { question: 'What does done look like?', answer: 'Publish a playable game' },
      { question: 'How much time can you give it each week?', answer: 'Three hours' },
    ]);
    expect(clarificationWasResolved(context)).toBe(true);
  });

  it('removes questions that ask for the same information in different words', () => {
    expect(uniqueClarificationQuestions([
      'What does done look like for this goal?',
      'What would done look like for your goal?',
      'How much time can you give it each week?',
    ])).toEqual(['What does done look like for this goal?', 'How much time can you give it each week?']);
  });

  it('never asks a second clarification after answers were supplied', async () => {
    const provider = new MockAIProvider();
    const first = await provider.generateGoalPlan('I want to get fit');
    expect(first).toMatchObject({ type: 'clarification' });
    const result = await provider.generateGoalPlan('I want to get fit', buildClarificationContext(first as GoalPlanClarification, ['Build gym strength', 'Three workouts a week', 'Beginner']));
    expect(result).not.toHaveProperty('type', 'clarification');
  });
});
