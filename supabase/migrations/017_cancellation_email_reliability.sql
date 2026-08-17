-- Keep cancellation email failures observable and retryable. The Stripe event
-- handler only marks a cancellation as notified after Resend accepts it.
alter table public.subscriptions
  add column if not exists cancellation_email_error text,
  add column if not exists cancellation_email_last_attempt_at timestamptz;

revoke all on table public.stripe_webhook_events from anon, authenticated;
