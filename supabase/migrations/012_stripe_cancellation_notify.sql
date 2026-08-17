-- Track when the owner was notified about a Stripe cancellation so webhook retries
-- do not send duplicate emails.
alter table public.subscriptions
  add column if not exists cancellation_notified_at timestamptz;
