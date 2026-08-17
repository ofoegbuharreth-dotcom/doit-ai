export type GoalCategory =
  | 'fitness'
  | 'learning'
  | 'coding'
  | 'money'
  | 'productivity'
  | 'career'
  | 'personal'
  | 'creative'
  | 'project'
  | 'health'
  | 'other';

export type GoalIntent =
  | 'learn'
  | 'build'
  | 'improve'
  | 'finish'
  | 'prepare'
  | 'earn'
  | 'save'
  | 'start'
  | 'reduce'
  | 'increase'
  | 'maintain'
  | 'unknown';

export type GoalDeadline = {
  raw: string;
  date?: string;
  durationDays?: number;
  kind: 'date' | 'duration' | 'month' | 'none';
};

export type GoalFrequency = {
  raw: string;
  count: number;
  period: 'day' | 'week' | 'month';
};

export type GoalShape =
  | 'backlog'
  | 'quantity'
  | 'project'
  | 'skill'
  | 'performance'
  | 'habit'
  | 'financial'
  | 'wellbeing'
  | 'open';

export type ParsedGoal = {
  originalText: string;
  normalizedText: string;
  category: GoalCategory;
  intent: GoalIntent;
  subject: string;
  targetValue?: number;
  targetUnit?: string;
  deadline: GoalDeadline;
  frequency?: GoalFrequency;
  shape: GoalShape;
  confidence: number;
  missingInformation: string[];
  categoryScores: Partial<Record<GoalCategory, number>>;
  intentScores: Partial<Record<GoalIntent, number>>;
  signals: string[];
};

export type PlanTemplate = {
  intent: GoalIntent;
  outcomeFrame: string;
  milestoneFrames: string[];
  weeklyFrame: string;
  todayFrame: string;
};
