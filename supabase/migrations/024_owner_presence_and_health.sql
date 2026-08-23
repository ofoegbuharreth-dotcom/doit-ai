-- Private, privacy-minimal presence. Users may only touch their own row;
-- only the database-authorised DOIT owner can read the directory.
create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  app_kind text not null default 'web' check (app_kind in ('web', 'installed-web', 'desktop', 'native')),
  online boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_presence enable row level security;
revoke all on table public.user_presence from anon, authenticated;

create or replace function public.touch_my_presence(p_app_kind text, p_online boolean default true)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  safe_kind text := case when p_app_kind in ('web', 'installed-web', 'desktop', 'native') then p_app_kind else 'web' end;
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  insert into public.user_presence (user_id, last_seen_at, app_kind, online, updated_at)
  values (current_user_id, now(), safe_kind, coalesce(p_online, true), now())
  on conflict (user_id) do update
  set last_seen_at = now(),
      app_kind = excluded.app_kind,
      online = excluded.online,
      updated_at = now();
end;
$$;

revoke all on function public.touch_my_presence(text, boolean) from public;
grant execute on function public.touch_my_presence(text, boolean) to authenticated;

create or replace function public.get_owner_presence()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  result jsonb;
begin
  if not public.is_doit_owner() then
    raise exception 'Owner access required.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', auth_user.id,
    'online', coalesce(presence.online, false) and presence.last_seen_at >= now() - interval '2 minutes',
    'lastSeenAt', presence.last_seen_at,
    'appKind', presence.app_kind
  ) order by presence.last_seen_at desc nulls last), '[]'::jsonb)
  into result
  from auth.users auth_user
  left join public.user_presence presence on presence.user_id = auth_user.id;

  return result;
end;
$$;

revoke all on function public.get_owner_presence() from public;
grant execute on function public.get_owner_presence() to authenticated;

