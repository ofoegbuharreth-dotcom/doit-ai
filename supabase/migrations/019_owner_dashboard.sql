-- Private owner analytics. Authorization is enforced in Postgres so the
-- dashboard cannot be exposed by guessing a route or modifying the client.
create or replace function public.is_doit_owner()
returns boolean
language sql
stable
security definer
set search_path = auth, public
as $$
  select lower(coalesce((select email from auth.users where id = auth.uid()), '')) = 'ofoegbuharreth@gmail.com';
$$;

revoke all on function public.is_doit_owner() from public;
grant execute on function public.is_doit_owner() to authenticated;

create or replace function public.get_owner_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_doit_owner() then
    raise exception 'Owner access required.' using errcode = '42501';
  end if;

  with activity_events as (
    select user_id, created_at as happened_at from public.goal_activity
    union all
    select user_id, completed_at from public.tasks where completed_at is not null
    union all
    select user_id, created_at from public.daily_checkins
    union all
    select user_id, coalesce(ended_at, started_at) from public.focus_sessions
  ),
  totals as (
    select
      count(*)::integer as users,
      count(*) filter (where created_at >= now() - interval '24 hours')::integer as users_today,
      count(*) filter (where created_at >= now() - interval '7 days')::integer as users_7d,
      count(*) filter (where created_at >= now() - interval '30 days')::integer as users_30d,
      count(*) filter (where exists(select 1 from public.goals g where g.user_id = p.id))::integer as activated,
      count(*) filter (where p.created_at <= now() - interval '7 days')::integer as return_eligible,
      count(*) filter (
        where p.created_at <= now() - interval '7 days'
          and exists(select 1 from activity_events a where a.user_id = p.id and a.happened_at >= now() - interval '7 days')
      )::integer as returned_7d,
      count(*) filter (where p.referred_by is not null)::integer as referred_users,
      count(*) filter (where p.founding_number is not null)::integer as founding_members
    from public.profiles p
  ),
  subscription_totals as (
    select
      count(*) filter (where plan = 'pro' and status = 'active')::integer as pro_paid,
      count(*) filter (where plan in ('max', 'premium') and status = 'active')::integer as max_paid,
      count(*) filter (where plan <> 'free' and status = 'trialing' and trial_ends_at > now())::integer as trials,
      count(*) filter (where plan <> 'free' and status = 'active')::integer as paid
    from public.subscriptions
  ),
  feedback_totals as (
    select
      count(*)::integer as all_feedback,
      count(*) filter (where status = 'new')::integer as new_feedback,
      coalesce(round(avg(rating)::numeric, 1), 0) as average_rating
    from public.product_feedback
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'metrics', jsonb_build_object(
      'totalUsers', t.users,
      'signupsToday', t.users_today,
      'signups7d', t.users_7d,
      'signups30d', t.users_30d,
      'activatedUsers', t.activated,
      'activationRate', case when t.users = 0 then 0 else round(t.activated * 100.0 / t.users, 1) end,
      'returningUsers7d', t.returned_7d,
      'returnRate7d', case when t.return_eligible = 0 then 0 else round(t.returned_7d * 100.0 / t.return_eligible, 1) end,
      'paidSubscribers', s.paid,
      'proSubscribers', s.pro_paid,
      'maxSubscribers', s.max_paid,
      'activeTrials', s.trials,
      'paidConversionRate', case when t.users = 0 then 0 else round(s.paid * 100.0 / t.users, 1) end,
      'referredUsers', t.referred_users,
      'foundingMembers', t.founding_members,
      'feedbackCount', f.all_feedback,
      'newFeedbackCount', f.new_feedback,
      'averageRating', f.average_rating
    ),
    'dailySignups', (
      select coalesce(jsonb_agg(jsonb_build_object('date', day::date, 'count', count) order by day), '[]'::jsonb)
      from (
        select days.day, count(p.id)::integer as count
        from generate_series(current_date - 13, current_date, interval '1 day') days(day)
        left join public.profiles p on p.created_at >= days.day and p.created_at < days.day + interval '1 day'
        group by days.day
      ) series
    ),
    'recentUsers', (
      select coalesce(jsonb_agg(to_jsonb(recent) order by recent.created_at desc), '[]'::jsonb)
      from (
        select u.id, u.email, p.display_name, p.created_at,
          p.founding_number, (p.referred_by is not null) as referred,
          count(distinct g.id)::integer as goal_count,
          coalesce(s.plan::text, 'free') as plan,
          coalesce(s.status::text, 'active') as subscription_status
        from public.profiles p
        join auth.users u on u.id = p.id
        left join public.goals g on g.user_id = p.id
        left join public.subscriptions s on s.user_id = p.id
        group by u.id, u.email, p.display_name, p.created_at, p.founding_number, p.referred_by, s.plan, s.status
        order by p.created_at desc
        limit 25
      ) recent
    ),
    'feedback', (
      select coalesce(jsonb_agg(to_jsonb(items) order by items.created_at desc), '[]'::jsonb)
      from (
        select f.id, f.category, f.rating, f.message, f.source, f.status, f.created_at,
          u.email as user_email
        from public.product_feedback f
        join auth.users u on u.id = f.user_id
        order by f.created_at desc
        limit 50
      ) items
    )
  ) into result
  from totals t cross join subscription_totals s cross join feedback_totals f;

  return result;
end;
$$;

revoke all on function public.get_owner_dashboard() from public;
grant execute on function public.get_owner_dashboard() to authenticated;

create or replace function public.set_owner_feedback_status(p_feedback_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_doit_owner() then
    raise exception 'Owner access required.' using errcode = '42501';
  end if;
  if p_status not in ('new', 'reviewing', 'planned', 'resolved') then
    raise exception 'Invalid feedback status.';
  end if;
  update public.product_feedback set status = p_status where id = p_feedback_id;
end;
$$;

revoke all on function public.set_owner_feedback_status(uuid, text) from public;
grant execute on function public.set_owner_feedback_status(uuid, text) to authenticated;
