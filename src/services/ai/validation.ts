import type { GoalPlanClarification, GoalPlanGenerationResult, GoalPlanResponse } from '@/types';

export function isGoalPlanResponse(value: unknown): value is GoalPlanResponse {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Partial<GoalPlanResponse>;
  return Boolean(
    plan.goal && typeof plan.goal.title === 'string' && typeof plan.goal.targetValue === 'number' &&
    Array.isArray(plan.milestones) && plan.milestones.length > 0 &&
    plan.milestones.every((item) => typeof item.title === 'string' && typeof item.targetValue === 'number') &&
    Array.isArray(plan.todayTasks) && plan.todayTasks.length > 0 &&
    plan.todayTasks.every((item) => typeof item.title === 'string' && typeof item.estimatedMinutes === 'number') &&
    typeof plan.insight === 'string'
  );
}

export function isGoalPlanClarification(value: unknown): value is GoalPlanClarification {
  if (!value || typeof value !== 'object') return false;
  const clarification = value as Partial<GoalPlanClarification>;
  return clarification.type === 'clarification' &&
    typeof clarification.message === 'string' &&
    Array.isArray(clarification.questions) &&
    clarification.questions.length > 0 &&
    clarification.questions.length <= 3 &&
    clarification.questions.every((question) => typeof question === 'string' && question.trim().length > 0);
}

export function isGoalPlanGenerationResult(value: unknown): value is GoalPlanGenerationResult {
  return isGoalPlanResponse(value) || isGoalPlanClarification(value);
}
