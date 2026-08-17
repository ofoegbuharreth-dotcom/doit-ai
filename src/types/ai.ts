import type { DailyCheckIn, Goal, Milestone, Task } from './domain';
import type { AgentContext } from '@/services/agent/context-builder';
import type { AgentResponse } from '@/services/agent/schemas';

export interface GeneratedMilestone {
  title: string;
  description: string;
  targetValue: number;
}

export interface GeneratedTask {
  title: string;
  description: string;
  priority: Task['priority'];
  estimatedMinutes: number;
}

export interface GoalPlanResponse {
  goal: { title: string; description: string; targetValue: number; unit: string };
  milestones: GeneratedMilestone[];
  todayTasks: GeneratedTask[];
  insight: string;
}

export interface GoalPlanClarification {
  type: 'clarification';
  message: string;
  questions: string[];
}

export type GoalPlanGenerationResult = GoalPlanResponse | GoalPlanClarification;

export interface AdaptationContext {
  goal: Goal;
  milestones: Milestone[];
  recentTasks: Task[];
  completedTasks: Task[];
  skippedTasks: Task[];
  checkIns: DailyCheckIn[];
  currentProgress: number;
}

export interface AIProvider {
  generateGoalPlan(prompt: string, context?: Record<string, string>): Promise<GoalPlanGenerationResult>;
  generateDailyTasks(context: AdaptationContext): Promise<GeneratedTask[]>;
  adaptPlan(context: AdaptationContext): Promise<{ tasks: GeneratedTask[]; reason: string }>;
  generateInsight(context: AdaptationContext): Promise<string>;
}

export interface AgentAIProvider extends AIProvider {
  interpretAgentRequest(request: string, context: AgentContext): Promise<AgentResponse>;
}
