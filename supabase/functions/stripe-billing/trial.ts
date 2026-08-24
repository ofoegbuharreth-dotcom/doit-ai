export const STRIPE_TRIAL_DAYS = 3;

export function stripeTrialParameters(trialUseCount: number | null | undefined) {
  const eligible = Number(trialUseCount ?? 0) < 2;
  return eligible ? { 'subscription_data[trial_period_days]': STRIPE_TRIAL_DAYS } : {};
}
