-- Repair the auth signup trigger after profile identity (021) replaced the
-- Founding 50 trigger (018) without the now-required referral_code column.
-- The failed profile insert rolls the entire auth.users insert back and is
-- surfaced by GoTrue as "Database error saving new user".

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_code text := upper(trim(coalesce(metadata->>'referral_code', '')));
  referrer_id uuid;
  next_founding_number integer;
begin
  -- Serialise the limited Founding 50 allocation without blocking unrelated
  -- profile edits or relying on client-provided values.
  perform pg_advisory_xact_lock(hashtext('doit-founding-50'));

  if requested_code <> '' then
    select profile.id
      into referrer_id
      from public.profiles profile
      where profile.referral_code = requested_code
        and profile.id <> new.id
      limit 1;
  end if;

  select coalesce(max(profile.founding_number), 0) + 1
    into next_founding_number
    from public.profiles profile
    where profile.founding_number is not null;

  if next_founding_number > 50 then
    next_founding_number := null;
  end if;

  insert into public.profiles (
    id,
    display_name,
    avatar_url,
    gender,
    referral_code,
    referred_by,
    founding_number
  )
  values (
    new.id,
    coalesce(
      nullif(trim(metadata->>'name'), ''),
      nullif(trim(metadata->>'full_name'), ''),
      'Executor'
    ),
    nullif(trim(coalesce(metadata->>'avatar_url', metadata->>'picture', '')), ''),
    case
      when metadata->>'gender' in ('male', 'woman', 'prefer_not_to_say') then metadata->>'gender'
      else 'prefer_not_to_say'
    end,
    upper(substr(replace(new.id::text, '-', ''), 1, 10)),
    referrer_id,
    next_founding_number
  )
  on conflict (id) do update
  set display_name = excluded.display_name,
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      gender = excluded.gender,
      updated_at = now();

  return new;
end;
$$;

-- Recreate the trigger explicitly so a partially applied migration cannot
-- leave Auth pointing at an older function definition.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Self-heal Auth accounts created while a profile trigger was unavailable.
-- Founding numbers are deliberately not fabricated during this backfill.
insert into public.profiles (id, display_name, avatar_url, gender, referral_code)
select
  auth_user.id,
  coalesce(
    nullif(trim(auth_user.raw_user_meta_data->>'name'), ''),
    nullif(trim(auth_user.raw_user_meta_data->>'full_name'), ''),
    'Executor'
  ),
  nullif(trim(coalesce(auth_user.raw_user_meta_data->>'avatar_url', auth_user.raw_user_meta_data->>'picture', '')), ''),
  case
    when auth_user.raw_user_meta_data->>'gender' in ('male', 'woman', 'prefer_not_to_say') then auth_user.raw_user_meta_data->>'gender'
    else 'prefer_not_to_say'
  end,
  upper(substr(replace(auth_user.id::text, '-', ''), 1, 10))
from auth.users auth_user
left join public.profiles profile on profile.id = auth_user.id
where profile.id is null
on conflict (id) do nothing;

-- Keep subscription defaults complete even if its independent auth trigger
-- was absent during an earlier deployment.
insert into public.subscriptions (user_id)
select auth_user.id
from auth.users auth_user
left join public.subscriptions subscription on subscription.user_id = auth_user.id
where subscription.user_id is null
on conflict (user_id) do nothing;

