-- Presence is tracked per installation so closing one of a user's devices does
-- not hide another device that is still actively using DOIT.
alter table public.user_presence
  add column if not exists client_id text;

update public.user_presence
set client_id = 'legacy'
where client_id is null;

alter table public.user_presence
  alter column client_id set default 'legacy',
  alter column client_id set not null;

alter table public.user_presence
  drop constraint if exists user_presence_pkey;

alter table public.user_presence
  add primary key (user_id, client_id);

create or replace function public.touch_my_presence(p_client_id text, p_app_kind text, p_online boolean default true)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  safe_client_id text := left(coalesce(nullif(trim(p_client_id), ''), 'legacy'), 100);
  safe_kind text := case when p_app_kind in ('web', 'installed-web', 'desktop', 'native') then p_app_kind else 'web' end;
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  insert into public.user_presence (user_id, client_id, last_seen_at, app_kind, online, updated_at)
  values (current_user_id, safe_client_id, now(), safe_kind, coalesce(p_online, true), now())
  on conflict (user_id, client_id) do update
  set last_seen_at = now(),
      app_kind = excluded.app_kind,
      online = excluded.online,
      updated_at = now();
end;
$$;

revoke all on function public.touch_my_presence(text, text, boolean) from public;
grant execute on function public.touch_my_presence(text, text, boolean) to authenticated;

-- Keep already-installed clients harmless until they refresh to the new build.
create or replace function public.touch_my_presence(p_app_kind text, p_online boolean default true)
returns void
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select public.touch_my_presence('legacy', p_app_kind, p_online);
$$;

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
    'online', coalesce(presence.online, false),
    'lastSeenAt', presence.last_seen_at,
    'appKind', presence.app_kind
  ) order by presence.last_seen_at desc nulls last), '[]'::jsonb)
  into result
  from auth.users auth_user
  left join lateral (
    select
      bool_or(item.online and item.last_seen_at >= now() - interval '2 minutes') as online,
      max(item.last_seen_at) as last_seen_at,
      (array_agg(item.app_kind order by item.last_seen_at desc))[1] as app_kind
    from public.user_presence item
    where item.user_id = auth_user.id
  ) presence on true;

  return result;
end;
$$;

revoke all on function public.get_owner_presence() from public;
grant execute on function public.get_owner_presence() to authenticated;
