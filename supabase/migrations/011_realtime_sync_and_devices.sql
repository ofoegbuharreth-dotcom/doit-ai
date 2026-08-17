-- Cross-device workspace sync and user-controlled device sessions.
create table if not exists public.app_devices (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  platform text not null,
  app_kind text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists app_devices_user_seen_idx on public.app_devices(user_id, last_seen_at desc);
alter table public.app_devices enable row level security;
drop policy if exists "own app devices" on public.app_devices;
create policy "own app devices" on public.app_devices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant select, insert, update, delete on public.app_devices to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['goals','milestones','tasks','goal_activity','daily_checkins','goal_progress_entries','focus_sessions','app_devices']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
