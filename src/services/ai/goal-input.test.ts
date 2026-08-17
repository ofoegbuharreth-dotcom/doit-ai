import { describe, expect, it } from 'vitest';
import { checkGoalPrompt } from './goal-input';

describe('checkGoalPrompt', () => {
  it.each(['aaaaaa', 'asdfgh', 'qwerty', 'a b c d', 'x', '12345', 'hfjd kslf', 'abc def ghi'])(
    'rejects meaningless input before AI usage: %s',
    (prompt) => expect(checkGoalPrompt(prompt).valid).toBe(false),
  );

  it.each([
    'Save £500',
    'Build an app',
    'Learn Python',
    'I have 6 assignments due Friday',
    'Improve my sleep',
    'Run 5k',
    'Quiero aprender español',
    'Apprendre le français',
  ])('accepts a meaningful goal: %s', (prompt) => expect(checkGoalPrompt(prompt).valid).toBe(true));
});
