-- Server-enforced AI planning quotas. These protect the OpenAI budget even if
-- a modified client calls the Edge Function directly.
create table if not exists public.ai_goal_plan_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  request_count integer not null default 0 check (request_count >= 0),
  successful_count integer not null default 0 check (successful_count >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start)
);

alter table public.ai_goal_plan_usage enable row level security;
drop policy if exists "read own AI plan usage" on public.ai_goal_plan_usage;
create policy "read own AI plan usage" on public.ai_goal_plan_usage
  for select using (auth.uid() = user_id);

revoke all on table public.ai_goal_plan_usage from anon, authenticated;
grant select on table public.ai_goal_plan_usage to authenticated;

drop trigger if exists ai_goal_plan_usage_updated_at on public.ai_goal_plan_usage;
create trigger ai_goal_plan_usage_updated_at
  before update on public.ai_goal_plan_usage
  for each row execute function public.set_updated_at();

create or replace function public.reserve_ai_goal_plan_generation()
returns table(allowed boolean, requests_used integer, request_limit integer, denial_reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_period date := date_trunc('month', now())::date;
  per_user_limit integer := 10;
  global_limit constant integer := 2500;
  current_user_requests integer := 0;
  current_global_requests integer := 0;
  has_pro boolean := false;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  -- A monthly advisory lock makes the global ceiling atomic across users.
  perform pg_advisory_xact_lock(hashtext('doit-ai-plan-' || current_period::text));

  select exists (
    select 1 from public.subscriptions s
    where s.user_id = current_user_id
      and s.plan <> 'free'::public.subscription_plan
      and (
        s.status = 'active'::public.subscription_status
        or (s.status = 'trialing'::public.subscription_status and s.trial_ends_at > now())
      )
  ) into has_pro;

  if has_pro then per_user_limit := 60; end if;

  select coalesce(sum(u.request_count), 0)::integer
    into current_global_requests
    from public.ai_goal_plan_usage u
    where u.period_start = current_period;

  select coalesce(u.request_count, 0)
    into current_user_requests
    from public.ai_goal_plan_usage u
    where u.user_id = current_user_id and u.period_start = current_period;

  if current_global_requests >= global_limit then
    return query select false, current_user_requests, per_user_limit, 'monthly_budget_reached'::text;
    return;
  end if;

  if current_user_requests >= per_user_limit then
    return query select false, current_user_requests, per_user_limit, 'user_limit_reached'::text;
    return;
  end if;

  insert into public.ai_goal_plan_usage (user_id, period_start, request_count)
  values (current_user_id, current_period, 1)
  on conflict (user_id, period_start) do update
    set request_count = public.ai_goal_plan_usage.request_count + 1;

  return query select true, current_user_requests + 1, per_user_limit, ''::text;
end;
$$;

revoke all on function public.reserve_ai_goal_plan_generation() from public;
grant execute on function public.reserve_ai_goal_plan_generation() to authenticated;

create or replace function public.complete_ai_goal_plan_generation(
  p_user_id uuid,
  p_success boolean,
  p_input_tokens integer default 0,
  p_output_tokens integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_goal_plan_usage
  set successful_count = successful_count + case when p_success then 1 else 0 end,
      input_tokens = input_tokens + greatest(coalesce(p_input_tokens, 0), 0),
      output_tokens = output_tokens + greatest(coalesce(p_output_tokens, 0), 0)
  where user_id = p_user_id
    and period_start = date_trunc('month', now())::date;
end;
$$;

revoke all on function public.complete_ai_goal_plan_generation(uuid, boolean, integer, integer) from public;
grant execute on function public.complete_ai_goal_plan_generation(uuid, boolean, integer, integer) to service_role;
