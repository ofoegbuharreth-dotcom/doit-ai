-- Stripe web billing. Only trusted Edge Functions using the service role can
-- mutate these fields; signed-in users retain read-only access to their row.
alter table public.subscriptions add column if not exists price_id text;
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;

create unique index if not exists subscriptions_stripe_customer_idx
  on public.subscriptions(provider_customer_id)
  where provider = 'stripe' and provider_customer_id is not null;

create unique index if not exists subscriptions_stripe_subscription_idx
  on public.subscriptions(provider_subscription_id)
  where provider = 'stripe' and provider_subscription_id is not null;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from anon, authenticated;

