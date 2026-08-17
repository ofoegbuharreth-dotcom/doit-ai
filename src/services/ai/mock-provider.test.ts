import { describe, expect, it } from 'vitest';

import { analyzeGoalIntent, buildClarificationQuestions, shouldAskForClarification } from './goal-intent';
import { buildLocalGoalPlan, MockAIProvider } from './mock-provider';

describe('analyzeGoalIntent', () => {
  it('detects ambiguous Roblox goals before guessing Luau vs playing', () => {
    const intent = analyzeGoalIntent('Get better at Roblox');
    expect(intent.domain).toBe('roblox');
    expect(intent.ambiguities).toContain('roblox_focus');
    expect(shouldAskForClarification(intent)).toBe(true);
    expect(buildClarificationQuestions(intent)[0]).toMatch(/scripting|publish|playing/i);
  });

  it('detects ambiguous fitness goals instead of defaulting to gym strength', () => {
    const intent = analyzeGoalIntent('Get fit');
    expect(intent.ambiguities).toContain('fitness_focus');
    expect(shouldAskForClarification(intent)).toBe(true);
  });

  it('builds a confident sport plan without clarification', () => {
    const intent = analyzeGoalIntent('Get better at football');
    expect(intent.domain).toBe('sport');
    expect(intent.confidence).toBeGreaterThan(0.7);
    expect(shouldAskForClarification(intent)).toBe(false);
  });

  it('uses optional context to strengthen a confident plan', () => {
    const intent = analyzeGoalIntent('Run more', { currentProgress: 'I can jog 2 km', availableTime: '30 minutes a day' });
    expect(intent.domain).toBe('fitness');
    expect(buildLocalGoalPlan('Run more', { currentProgress: 'I can jog 2 km' }).goal.description).toMatch(/Starting point: I can jog 2 km/);
  });
});

describe('buildLocalGoalPlan', () => {
  it('creates a concrete savings plan from words rather than a currency symbol', () => {
    const plan = buildLocalGoalPlan('save 1000 pounds');
    expect(plan.goal).toMatchObject({ targetValue: 1000, unit: '£' });
    expect(plan.todayTasks.map((task) => task.title)).toEqual([
      'Create the dedicated savings pot',
      'Transfer the first £50',
      'Set a £50 weekly transfer',
    ]);
    expect(plan.milestones[0]?.title).toBe('£100 saved and the system is running');
  });

  it('uses the deadline to calculate a savings cadence', () => {
    const targetDate = new Date(Date.now() + 70 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const plan = buildLocalGoalPlan('I want to save £1,000', { targetDate });
    expect(plan.todayTasks[2]?.title).toMatch(/^Set a £\d+ weekly transfer$/);
    expect(plan.todayTasks[2]?.title).not.toBe('Set a £1000 weekly transfer');
  });

  it('generates different actions for software and fitness goals', () => {
    const app = buildLocalGoalPlan('Build a budgeting app');
    const fitness = buildLocalGoalPlan('Run a 5k');
    expect(app.todayTasks[0]?.title).toBe('Write the one-sentence user promise');
    expect(fitness.todayTasks[0]?.title).toBe('Complete a 20-minute easy baseline run');
    expect(app.todayTasks).not.toEqual(fitness.todayTasks);
  });

  it('turns a broad Python skill goal into evidence instead of percentages', () => {
    const plan = buildLocalGoalPlan('Get better at Python scripting');
    expect(plan.goal).toMatchObject({ targetValue: 3, unit: 'projects' });
    expect(plan.milestones.map((milestone) => milestone.title)).toEqual([
      'First useful project works end-to-end',
      'Second project uses files or an external API',
      'Third project completed independently',
    ]);
    expect(plan.todayTasks[0]?.title).toBe('Build a script that renames five test files');
    expect(JSON.stringify(plan)).not.toMatch(/% complete|choose three checkpoints/i);
  });

  it('builds a specific strength programme instead of generic milestone filler', () => {
    const plan = buildLocalGoalPlan('To become strong in the gym');
    expect(plan.goal).toMatchObject({ title: 'Build measurable strength in the gym', targetValue: 24, unit: 'workouts' });
    expect(plan.milestones.map((item) => item.title)).toEqual([
      'Four workouts completed and baseline lifts logged',
      'Eight workouts completed with a stable routine',
      'Sixteen workouts completed with three lifts improved',
      'Twenty-four workouts completed and strength retested',
    ]);
    expect(plan.todayTasks[0]?.description).toMatch(/squat or leg press.*chest press.*row.*Romanian deadlift/i);
    expect(JSON.stringify(plan)).not.toMatch(/first concrete result|half of the planned work|outcome is complete/i);
  });

  it('understands Roblox Luau as a platform-specific coding skill', () => {
    const plan = buildLocalGoalPlan('Be the best at Roblox Luau');
    expect(plan.goal).toMatchObject({ title: 'Build advanced Roblox Luau skills', targetValue: 4, unit: 'working Roblox systems' });
    expect(plan.todayTasks[0]?.title).toBe('Build a secure RemoteEvent interaction');
    expect(plan.todayTasks[0]?.description).toMatch(/LocalScript.*server Script.*validates.*two players/i);
    expect(plan.milestones.map((item) => item.title)).toEqual([
      'Interactive system works across client and server',
      'Player data saves and loads safely',
      'Multiplayer round or ability system is complete',
      'Published vertical slice passes five playtests',
    ]);
  });

  it('uses deliberate-practice plans for sports and repeatable systems for habits', () => {
    expect(buildLocalGoalPlan('Get better at football').goal.unit).toBe('deliberate sessions');
    expect(buildLocalGoalPlan('Build a daily meditation habit').goal.unit).toBe('tracked days');
  });

  it('distinguishes weight in pounds from saving pounds', () => {
    expect(buildLocalGoalPlan('Lose 20 pounds').goal.unit).toBe('lb lost');
    expect(buildLocalGoalPlan('Save 20 pounds').goal.unit).toBe('£');
  });

  it('builds an earning system instead of a savings plan for selling', () => {
    const plan = buildLocalGoalPlan('I want to make £1000 selling clothes');
    expect(plan.goal).toMatchObject({ targetValue: 1000, unit: '£ earned' });
    expect(plan.todayTasks[0]?.title).toBe('Choose the first 10 items to sell');
    expect(plan.goal.description).toMatch(/customer payment/i);
  });

  it('uses pages as the progress unit for a page-count reading goal', () => {
    const plan = buildLocalGoalPlan('I want to read 300 pages this month');
    expect(plan.goal).toMatchObject({ targetValue: 300, unit: 'pages' });
    expect(plan.todayTasks[0]?.title).toMatch(/Read the first \d+ pages/);
  });

  it('uses a communication plan for speaking to people', () => {
    const plan = buildLocalGoalPlan('I want to become better at speaking to people');
    expect(plan.goal.unit).toBe('real conversations');
    expect(plan.todayTasks[0]?.title).toMatch(/conversation/i);
  });

  it('asks for an earning route and amount before planning generic money goals', async () => {
    const result = await new MockAIProvider().generateGoalPlan('I want to make money');
    expect(result).toMatchObject({ type: 'clarification' });
    if ('type' in result) expect(result.questions.join(' ')).toMatch(/how much|earn it/i);
  });

  it('asks for missing evidence instead of inventing an unknown plan', async () => {
    const result = await new MockAIProvider().generateGoalPlan('Make my life amazing somehow');
    expect(result).toMatchObject({ type: 'clarification' });
    if ('type' in result) expect(result.questions).toHaveLength(3);
  });

  it('uses clarification answers without asking the same question again', async () => {
    const provider = new MockAIProvider();
    const first = await provider.generateGoalPlan('I want to improve');
    expect(first).toMatchObject({ type: 'clarification' });

    const resolved = await provider.generateGoalPlan('I want to improve', {
      additionalDetails: 'Speak confidently for five minutes in front of my class\nI currently avoid presenting\nTwo 30-minute sessions each week',
    });
    expect(resolved).not.toHaveProperty('type', 'clarification');
    if (!('type' in resolved)) {
      expect(resolved.todayTasks.length).toBeGreaterThan(0);
    }
  });

  it('asks before guessing for vague Roblox goals', async () => {
    const result = await new MockAIProvider().generateGoalPlan('Get better at Roblox');
    expect(result).toMatchObject({ type: 'clarification' });
    if ('type' in result) expect(result.questions[0]).toMatch(/scripting|publish|playing/i);
  });

  it('asks before guessing for vague fitness goals', async () => {
    const result = await new MockAIProvider().generateGoalPlan('Get fit');
    expect(result).toMatchObject({ type: 'clarification' });
    if ('type' in result) expect(result.questions[0]).toMatch(/lose weight|run|gym strength/i);
  });

  it('uses the reusable skill strategy for an unfamiliar but clear hobby', async () => {
    const result = await new MockAIProvider().generateGoalPlan('Get better at pottery');
    expect(result).not.toHaveProperty('type', 'clarification');
    if (!('type' in result)) {
      expect(result.goal.unit).toBe('deliberate sessions');
      expect(result.todayTasks[0]?.title).toMatch(/pottery/i);
    }
  });

  it('clarifies backlog details and then builds an assignment completion plan', async () => {
    const provider = new MockAIProvider();
    const first = await provider.generateGoalPlan('I have 6 assignments due');
    expect(first).toMatchObject({ type: 'clarification' });
    if ('type' in first) expect(first.questions[0]).toMatch(/items and deadlines/i);

    const result = await provider.generateGoalPlan('I have 6 assignments due', {
      additionalDetails: 'Maths Friday, English Monday, science next Wednesday, and three coursework tasks next month',
    });
    expect(result).not.toHaveProperty('type', 'clarification');
    if (!('type' in result)) {
      expect(result.goal).toMatchObject({ targetValue: 6, unit: 'assignments completed' });
      expect(result.todayTasks[0]?.title).toBe('Build the assignment priority board');
      expect(JSON.stringify(result)).not.toMatch(/success test|honest baseline|retested/i);
    }
  });

  it.each([
    ['Organize 200 photos', 'photos'],
    ['Complete 12 client reports', 'reports'],
    ['Write 20 songs', 'songs'],
    ['Submit 30 job applications', 'applications'],
    ['Finish 8 course lessons', 'lessons'],
  ])('generalises clear quantity goals without domain-specific hardcoding: %s', async (prompt, unit) => {
    const result = await new MockAIProvider().generateGoalPlan(prompt);
    expect(result).not.toHaveProperty('type', 'clarification');
    if (!('type' in result)) {
      expect(result.goal.unit).toBe(unit);
      expect(result.goal.targetValue).toBeGreaterThan(1);
      expect(result.todayTasks[0]?.title).toMatch(/Complete the first/i);
      expect(JSON.stringify(result)).not.toMatch(/success test|honest baseline|retested/i);
    }
  });

  it('uses a safe wellbeing strategy for a clear health goal', async () => {
    const result = await new MockAIProvider().generateGoalPlan('Improve my sleep');
    expect(result).not.toHaveProperty('type', 'clarification');
    if (!('type' in result)) {
      expect(result.goal.unit).toBe('tracked days');
      expect(result.insight).toMatch(/qualified help|professional/i);
    }
  });

  it.each([
    ['Improve my grades', 'marked practices'],
    ['Learn Spanish', 'conversations'],
    ['Get a new job', 'quality applications'],
    ['Declutter my bedroom', 'areas'],
    ['Write a short film', 'versions'],
    ['Plan a trip to Japan', 'preparations'],
  ])('uses a real-world progress unit for %s', (prompt, unit) => {
    expect(buildLocalGoalPlan(prompt).goal.unit).toBe(unit);
  });
});
