import { describe, expect, it } from 'vitest';

import { normalisePlan, PLAN_LIMITS, planLabel } from './subscription';

describe('subscription plans', () => {
  it('keeps legacy premium customers on the MAX tier', () => {
    expect(normalisePlan('premium')).toBe('max');
  });

  it('orders active goal and AI allowances by tier', () => {
    expect(PLAN_LIMITS.free.activeGoals).toBeLessThan(PLAN_LIMITS.pro.activeGoals);
    expect(PLAN_LIMITS.pro.activeGoals).toBeLessThan(PLAN_LIMITS.max.activeGoals);
    expect(PLAN_LIMITS.pro.aiPlansPerMonth).toBeLessThan(PLAN_LIMITS.max.aiPlansPerMonth);
  });

  it('uses the public MAX name', () => {
    expect(planLabel('max')).toBe('DOIT MAX');
  });
});
