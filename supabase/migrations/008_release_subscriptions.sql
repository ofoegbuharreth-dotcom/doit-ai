-- RevenueCat/Google Play is authoritative for entitlement state. This RPC only
-- records cancellation intent; the client then opens Google Play management.
create or replace function public.submit_subscription_cancellation_feedback(p_reason text, p_details text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare feedback_id uuid; old_plan public.subscription_plan;
begin
  if p_reason not in ('too_expensive','not_using_enough','missing_features','difficult_to_use','technical_issues','other') then raise exception 'Choose a valid cancellation reason.'; end if;
  if char_length(coalesce(p_details, '')) > 2000 then raise exception 'Feedback is too long.'; end if;
  select plan into old_plan from public.subscriptions where user_id = auth.uid();
  insert into public.subscription_cancellation_feedback (user_id, previous_plan, reason, details)
  values (auth.uid(), coalesce(nullif(old_plan, 'free'::public.subscription_plan), 'pro'::public.subscription_plan), p_reason, nullif(trim(p_details), ''))
  returning id into feedback_id;
  return feedback_id;
end;
$$;
revoke all on function public.submit_subscription_cancellation_feedback(text, text) from public;
grant execute on function public.submit_subscription_cancellation_feedback(text, text) to authenticated;
