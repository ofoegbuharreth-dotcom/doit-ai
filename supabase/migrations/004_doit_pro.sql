-- DOIT AI Pro entitlements. Billing providers should update this table only
-- from a trusted webhook/service-role environment.
do $$ begin create type public.subscription_plan as enum ('free', 'pro', 'premium'); exception when duplicate_object then null; end $$;
do $$ begin create type public.subscription_status as enum ('active', 'trialing', 'expired', 'cancelled'); exception when duplicate_object then null; end $$;

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan public.subscription_plan not null default 'free',
  status public.subscription_status not null default 'active',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscriptions (user_id)
select id from auth.users
on conflict (user_id) do nothing;

alter table public.subscriptions enable row level security;
drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions for select using (auth.uid() = user_id);

create or replace function public.create_subscription_for_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_subscription_created on auth.users;
create trigger on_auth_user_subscription_created after insert on auth.users for each row execute function public.create_subscription_for_user();

create or replace function public.start_doit_pro_trial()
returns table(plan public.subscription_plan, status public.subscription_status, trial_ends_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  return query
  update public.subscriptions s
  set plan = 'pro', status = 'trialing', trial_started_at = now(), trial_ends_at = now() + interval '7 days', updated_at = now()
  where s.user_id = auth.uid() and s.trial_started_at is null and s.plan = 'free'
  returning s.plan, s.status, s.trial_ends_at;
end;
$$;

revoke all on table public.subscriptions from anon, authenticated;
grant select on table public.subscriptions to authenticated;
revoke all on function public.start_doit_pro_trial() from public;
grant execute on function public.start_doit_pro_trial() to authenticated;

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
