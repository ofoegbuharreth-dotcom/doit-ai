import { describe, expect, it } from 'vitest';

import { calculateCadence, parseGoal, shouldClarifyParsedGoal, validateGoalFeasibility } from './index';

describe('deterministic goal parser', () => {
  it.each([
    ['I want to learn Python', 'learn', 'coding'],
    ['I want to get better at football', 'improve', 'fitness'],
    ['I want to make my school football team', 'prepare', 'fitness'],
    ['I want to save £500 in 10 weeks', 'save', 'money'],
    ['I want to make £1000 selling clothes', 'earn', 'money'],
    ['I need to revise for my maths GCSE', 'prepare', 'learning'],
    ['I want to build a website', 'build', 'project'],
    ['I want to stop procrastinating', 'reduce', 'productivity'],
    ['I want to run 5km', 'improve', 'fitness'],
    ['I want to read 300 pages this month', 'learn', 'learning'],
    ['I want to become better at speaking to people', 'improve', 'personal'],
    ['I need to finish my app before October', 'finish', 'project'],
  ] as const)('parses %s', (prompt, intent, category) => {
    const parsed = parseGoal(prompt);
    expect(parsed.intent).toBe(intent);
    expect(parsed.category).toBe(category);
    expect(parsed.subject.length).toBeGreaterThan(1);
  });

  it('extracts numeric targets, units, durations, months, and frequency', () => {
    const saving = parseGoal('Save five hundred pounds in ten weeks');
    expect(saving).toMatchObject({ targetValue: 500, targetUnit: '£' });
    expect(saving.deadline.durationDays).toBe(70);
    expect(calculateCadence(saving)?.weekly).toBe(50);

    const reading = parseGoal('Read 300 pages this month, 5 times a week');
    expect(reading).toMatchObject({ targetValue: 300, targetUnit: 'pages' });
    expect(reading.frequency).toMatchObject({ count: 5, period: 'week' });
    expect(reading.deadline.kind).toBe('month');
  });

  it.each(['I want to get fit', 'I want to improve', 'I want to make money'])('clarifies underspecified goal: %s', (prompt) => {
    const parsed = parseGoal(prompt);
    expect(shouldClarifyParsedGoal(parsed)).toBe(true);
    expect(parsed.missingInformation.length).toBeGreaterThan(0);
  });

  it('flags a mathematically unrealistic page cadence', () => {
    expect(validateGoalFeasibility(parseGoal('Read 10000 pages in 2 weeks'))).not.toHaveLength(0);
  });

  it('recognises a due-work backlog as completion work', () => {
    expect(parseGoal('I have 6 assignments due')).toMatchObject({
      category: 'learning',
      intent: 'finish',
      shape: 'backlog',
      targetValue: 6,
      targetUnit: 'assignments',
      subject: 'assignments',
    });
  });
});
