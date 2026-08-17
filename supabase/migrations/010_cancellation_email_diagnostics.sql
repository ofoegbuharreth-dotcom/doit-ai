alter table public.subscription_cancellation_feedback
  add column if not exists email_error text;

-- Error details are operational data and remain service-role only.
revoke all on table public.subscription_cancellation_feedback from anon, authenticated;
grant select (id, user_id, previous_plan, reason, details, emailed_at, created_at)
  on public.subscription_cancellation_feedback to authenticated;

