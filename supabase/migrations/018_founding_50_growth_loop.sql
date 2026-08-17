-- Founding 50 launch campaign, referral attribution, and durable product feedback.
alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null,
  add column if not exists founding_number integer check (founding_number between 1 and 50);

update public.profiles
set referral_code = upper(substr(replace(id::text, '-', ''), 1, 10))
where referral_code is null;

alter table public.profiles alter column referral_code set not null;
create unique index if not exists profiles_referral_code_key on public.profiles(referral_code);
create unique index if not exists profiles_founding_number_key on public.profiles(founding_number) where founding_number is not null;
create index if not exists profiles_referred_by_idx on public.profiles(referred_by) where referred_by is not null;

-- Existing launch users receive the earliest founding numbers in signup order.
with ranked as (
  select id, row_number() over (order by created_at, id) as position
  from public.profiles
)
update public.profiles profile
set founding_number = ranked.position
from ranked
where profile.id = ranked.id
  and profile.founding_number is null
  and ranked.position <= 50;

create table if not exists public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('idea', 'confusing', 'bug', 'love')),
  rating integer check (rating between 1 and 5),
  message text not null check (char_length(trim(message)) between 3 and 2000),
  source text not null default 'profile' check (char_length(source) <= 80),
  status text not null default 'new' check (status in ('new', 'reviewing', 'planned', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists product_feedback_created_idx on public.product_feedback(created_at desc);
create index if not exists product_feedback_user_idx on public.product_feedback(user_id, created_at desc);
alter table public.product_feedback enable row level security;
drop policy if exists "submit own product feedback" on public.product_feedback;
create policy "submit own product feedback" on public.product_feedback for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "read own product feedback" on public.product_feedback;
create policy "read own product feedback" on public.product_feedback for select to authenticated using (auth.uid() = user_id);
revoke all on table public.product_feedback from anon, authenticated;
grant insert (user_id, category, rating, message, source), select (id, user_id, category, rating, message, source, status, created_at)
  on public.product_feedback to authenticated;

create or replace function public.get_founding_50_status(p_referral_code text default null)
returns table(spots_claimed integer, spots_remaining integer, valid_referral boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where founding_number is not null)::integer,
    greatest(0, 50 - count(*) filter (where founding_number is not null))::integer,
    case when nullif(trim(p_referral_code), '') is null then false
      else exists(select 1 from public.profiles where referral_code = upper(trim(p_referral_code)))
    end
  from public.profiles;
$$;

revoke all on function public.get_founding_50_status(text) from public;
grant execute on function public.get_founding_50_status(text) to anon, authenticated;

create or replace function public.get_my_founding_profile()
returns table(referral_code text, founding_number integer, successful_invites integer)
language sql
stable
security definer
set search_path = public
as $$
  select profile.referral_code, profile.founding_number,
    (select count(*)::integer from public.profiles invited where invited.referred_by = auth.uid())
  from public.profiles profile
  where profile.id = auth.uid();
$$;

revoke all on function public.get_my_founding_profile() from public;
grant execute on function public.get_my_founding_profile() to authenticated;

-- Signup metadata carries only the public referral code. Attribution and the
-- first-50 allocation happen inside this trigger under one advisory lock.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_code text := upper(trim(coalesce(new.raw_user_meta_data->>'referral_code', '')));
  referrer_id uuid;
  next_founding_number integer;
begin
  perform pg_advisory_xact_lock(hashtext('doit-founding-50'));

  if requested_code <> '' then
    select id into referrer_id from public.profiles where referral_code = requested_code limit 1;
  end if;

  select coalesce(max(founding_number), 0) + 1 into next_founding_number
  from public.profiles
  where founding_number is not null;
  if next_founding_number > 50 then next_founding_number := null; end if;

  insert into public.profiles (id, display_name, referral_code, referred_by, founding_number)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), 'Executor'),
    upper(substr(replace(new.id::text, '-', ''), 1, 10)),
    referrer_id,
    next_founding_number
  );
  return new;
end;
$$;

