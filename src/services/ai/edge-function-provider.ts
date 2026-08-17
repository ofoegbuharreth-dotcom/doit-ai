import { supabase } from '@/services/supabase/client';
import type { AdaptationContext, AgentAIProvider, GoalPlanGenerationResult } from '@/types';
import type { AgentContext } from '@/services/agent';
import { buildLocalGoalPlan } from './mock-provider';
import { clarificationWasResolved, uniqueClarificationQuestions } from './clarification-session';
import { isGoalPlanClarification, isGoalPlanGenerationResult } from './validation';

export class EdgeFunctionAIProvider implements AgentAIProvider {
  constructor(private readonly fallback: AgentAIProvider) {}

  private async invoke<T>(name: string, body: Record<string, unknown>, validate: (value: unknown) => value is T): Promise<T> {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
      let message = error.message;
      const response = (error as { context?: { json?: () => Promise<unknown> } }).context;
      if (response?.json) {
        try {
          const payload = await response.json() as { error?: unknown };
          if (typeof payload?.error === 'string') message = payload.error;
        } catch { /* Keep the Supabase error when the response is not JSON. */ }
      }
      throw new Error(message);
    }
    if (!validate(data)) throw new Error('DOIT received an invalid AI response.');
    return data;
  }

  async generateGoalPlan(prompt: string, context?: Record<string, string>) {
    try {
      const result = await this.invoke<GoalPlanGenerationResult>('generate-goal-plan', { prompt, context }, isGoalPlanGenerationResult);
      // A user who answered a clarification has finished clarifying. Never make
      // them complete another question screen if the model ignores that rule.
      if (isGoalPlanClarification(result) && clarificationWasResolved(context)) {
        console.warn('Remote planner repeated clarification; completing with the built-in planner.');
        return buildLocalGoalPlan(prompt, context);
      }
      if (isGoalPlanClarification(result)) return { ...result, questions: uniqueClarificationQuestions(result.questions) };
      return result;
    } catch (error) {
      console.warn('Remote goal planner unavailable; using the built-in planner.', error instanceof Error ? error.message : error);
      return buildLocalGoalPlan(prompt, context);
    }
  }

  generateDailyTasks(context: AdaptationContext) {
    return this.fallback.generateDailyTasks(context);
  }

  adaptPlan(context: AdaptationContext) {
    return this.fallback.adaptPlan(context);
  }

  generateInsight(context: AdaptationContext) {
    return this.fallback.generateInsight(context);
  }

  interpretAgentRequest(request: string, context: AgentContext) {
    return this.fallback.interpretAgentRequest(request, context);
  }
}
