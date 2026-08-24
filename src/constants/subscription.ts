export type DoitPlan = 'free' | 'pro' | 'max';

/** The introductory trial offered to eligible new Pro and MAX subscribers. */
export const SUBSCRIPTION_TRIAL_DAYS = 3;

export const PLAN_LIMITS = {
  free: { activeGoals: 2, aiPlansPerMonth: 10, adaptationsPerMonth: 5 },
  pro: { activeGoals: 20, aiPlansPerMonth: 60, adaptationsPerMonth: 100 },
  max: { activeGoals: 100, aiPlansPerMonth: 150, adaptationsPerMonth: 500 },
} as const;

export function normalisePlan(plan?: string | null): DoitPlan {
  if (plan === 'max' || plan === 'premium') return 'max';
  if (plan === 'pro') return 'pro';
  return 'free';
}

export function planLabel(plan: DoitPlan) {
  return plan === 'max' ? 'DOIT MAX' : plan === 'pro' ? 'DOIT Pro' : 'DOIT Free';
}
