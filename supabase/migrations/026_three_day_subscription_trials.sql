-- New DOIT Pro and MAX introductory trials last three days.
-- Existing Stripe subscriptions keep the trial_end already promised by Stripe.
-- This RPC remains for legacy/dev clients that still start a database-backed trial.
create or replace function public.start_doit_pro_trial()
returns table(plan public.subscription_plan, status public.subscription_status, trial_ends_at timestamptz, trial_use_count integer)
language sql
security definer
set search_path = public
as $$
  update public.subscriptions s
  set plan = 'pro',
      status = 'trialing',
      trial_started_at = now(),
      trial_ends_at = now() + interval '3 days',
      trial_use_count = s.trial_use_count + 1,
      updated_at = now()
  where s.user_id = auth.uid()
    and s.trial_use_count < 2
    and (
      s.plan = 'free'
      or s.status in ('cancelled', 'expired')
      or (s.status = 'trialing' and s.trial_ends_at <= now())
    )
  returning s.plan, s.status, s.trial_ends_at, s.trial_use_count;
$$;

revoke all on function public.start_doit_pro_trial() from public;
grant execute on function public.start_doit_pro_trial() to authenticated;
