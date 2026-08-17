-- TEMPORARY QA POLICY: allow each account to activate the Pro preview twice.
-- Replace the limit with the production trial policy before store launch.
alter table public.subscriptions add column if not exists trial_use_count integer not null default 0;
update public.subscriptions set trial_use_count = 1 where trial_started_at is not null and trial_use_count = 0;

do $$ begin
  alter table public.subscriptions add constraint subscriptions_trial_use_count_check check (trial_use_count between 0 and 2);
exception when duplicate_object then null;
end $$;

drop function if exists public.start_doit_pro_trial();
create function public.start_doit_pro_trial()
returns table(plan public.subscription_plan, status public.subscription_status, trial_ends_at timestamptz, trial_use_count integer)
language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  return query
  update public.subscriptions s
  set plan = 'pro', status = 'trialing', trial_started_at = now(), trial_ends_at = now() + interval '7 days',
      trial_use_count = s.trial_use_count + 1, updated_at = now()
  where s.user_id = auth.uid()
    and s.trial_use_count < 2
    and (s.plan = 'free' or s.status in ('cancelled','expired') or (s.status = 'trialing' and s.trial_ends_at <= now()))
  returning s.plan, s.status, s.trial_ends_at, s.trial_use_count;
end;
$$;

revoke all on function public.start_doit_pro_trial() from public;
grant execute on function public.start_doit_pro_trial() to authenticated;
