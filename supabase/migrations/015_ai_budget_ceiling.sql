-- With GPT-5.6 Luna pinned and max_output_tokens=1800, 750 reservations
-- (including at most one quality retry each) keep the model-side worst-case
-- monthly estimate below approximately US$5 at the deployment-time rates.
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
  global_limit constant integer := 750;
  current_user_requests integer := 0;
  current_global_requests integer := 0;
  has_pro boolean := false;
begin
  if current_user_id is null then raise exception 'Authentication required.'; end if;

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

  select coalesce(max(u.request_count), 0)::integer
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
