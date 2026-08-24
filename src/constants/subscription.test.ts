import { describe, expect, it } from 'vitest';

import { STRIPE_TRIAL_DAYS, stripeTrialParameters } from '../../supabase/functions/stripe-billing/trial';
import { normalisePlan, PLAN_LIMITS, planLabel, SUBSCRIPTION_TRIAL_DAYS } from './subscription';

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

  it('uses the same three-day trial in the app and Stripe checkout', () => {
    expect(SUBSCRIPTION_TRIAL_DAYS).toBe(3);
    expect(STRIPE_TRIAL_DAYS).toBe(SUBSCRIPTION_TRIAL_DAYS);
    expect(stripeTrialParameters(0)).toEqual({ 'subscription_data[trial_period_days]': 3 });
    expect(stripeTrialParameters(2)).toEqual({});
  });
});
