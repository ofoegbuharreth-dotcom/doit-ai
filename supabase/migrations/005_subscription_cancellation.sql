-- Secure cancellation feedback. The client can cancel only its own account
-- through the RPC and cannot modify subscription rows directly.
create table if not exists public.subscription_cancellation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  previous_plan public.subscription_plan not null,
  reason text not null check (reason in ('too_expensive','not_using_enough','missing_features','difficult_to_use','technical_issues','other')),
  details text check (char_length(details) <= 2000),
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists cancellation_feedback_user_created_idx on public.subscription_cancellation_feedback(user_id, created_at desc);
alter table public.subscription_cancellation_feedback enable row level security;
drop policy if exists "read own cancellation feedback" on public.subscription_cancellation_feedback;
create policy "read own cancellation feedback" on public.subscription_cancellation_feedback for select using (auth.uid() = user_id);
revoke all on table public.subscription_cancellation_feedback from anon, authenticated;
grant select on table public.subscription_cancellation_feedback to authenticated;

create or replace function public.cancel_doit_subscription(p_reason text, p_details text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  feedback_id uuid;
  old_plan public.subscription_plan;
begin
  if p_reason not in ('too_expensive','not_using_enough','missing_features','difficult_to_use','technical_issues','other') then
    raise exception 'Choose a valid cancellation reason.';
  end if;
  if char_length(coalesce(p_details, '')) > 2000 then raise exception 'Feedback is too long.'; end if;

  select plan into old_plan from public.subscriptions where user_id = auth.uid() for update;
  if old_plan is null or old_plan = 'free' then raise exception 'No active DOIT Pro subscription was found.'; end if;

  insert into public.subscription_cancellation_feedback (user_id, previous_plan, reason, details)
  values (auth.uid(), old_plan, p_reason, nullif(trim(p_details), '')) returning id into feedback_id;

  update public.subscriptions
  set plan = 'free', status = 'cancelled', trial_ends_at = null, current_period_ends_at = null, updated_at = now()
  where user_id = auth.uid();
  return feedback_id;
end;
$$;

revoke all on function public.cancel_doit_subscription(text, text) from public;
grant execute on function public.cancel_doit_subscription(text, text) to authenticated;
