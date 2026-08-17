create table if not exists public.goal_progress_entries (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount <> 0),
  note text check (char_length(note) <= 500),
  recorded_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists progress_entries_goal_date_idx on public.goal_progress_entries(goal_id, recorded_on desc, created_at desc);
alter table public.goal_progress_entries enable row level security;
drop policy if exists "read own progress entries" on public.goal_progress_entries;
create policy "read own progress entries" on public.goal_progress_entries for select using (auth.uid() = user_id);
revoke all on table public.goal_progress_entries from anon, authenticated;
grant select on table public.goal_progress_entries to authenticated;

create or replace function public.sync_goal_milestones(p_goal_id uuid, p_current numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.milestones
  set status = case when target_value <= p_current then 'completed'::public.milestone_status else 'pending'::public.milestone_status end,
      completed_at = case when target_value <= p_current then coalesce(completed_at, now()) else null end
  where goal_id = p_goal_id;
  update public.milestones set status = 'current'
  where id = (select id from public.milestones where goal_id = p_goal_id and status = 'pending' order by sort_order limit 1);
end;
$$;
revoke all on function public.sync_goal_milestones(uuid, numeric) from public;

create or replace function public.log_goal_progress(p_goal_id uuid, p_amount numeric, p_note text default null)
returns table(entry_id uuid, new_current_value numeric, new_goal_status public.goal_status)
language plpgsql security definer set search_path = public as $$
declare next_value numeric; next_status public.goal_status; new_entry uuid;
begin
  if p_amount <= 0 then raise exception 'Progress must be greater than zero.'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'Progress note is too long.'; end if;
  select greatest(0, g.current_value + p_amount), case when g.current_value + p_amount >= g.target_value then 'completed'::public.goal_status else g.status end
  into next_value, next_status from public.goals g where g.id = p_goal_id and g.user_id = auth.uid() for update;
  if not found then raise exception 'Goal not found.'; end if;
  insert into public.goal_progress_entries(goal_id, user_id, amount, note) values (p_goal_id, auth.uid(), p_amount, nullif(trim(p_note), '')) returning id into new_entry;
  update public.goals set current_value = next_value, status = next_status where id = p_goal_id;
  perform public.sync_goal_milestones(p_goal_id, next_value);
  return query select new_entry, next_value, next_status;
end;
$$;

create or replace function public.edit_goal_progress(p_entry_id uuid, p_amount numeric, p_note text default null)
returns table(new_current_value numeric, new_goal_status public.goal_status)
language plpgsql security definer set search_path = public as $$
declare selected public.goal_progress_entries%rowtype; next_value numeric; next_status public.goal_status;
begin
  if p_amount <= 0 then raise exception 'Progress must be greater than zero.'; end if;
  select * into selected from public.goal_progress_entries where id = p_entry_id and user_id = auth.uid() for update;
  if not found then raise exception 'Progress entry not found.'; end if;
  select greatest(0, g.current_value - selected.amount + p_amount), g.status into next_value, next_status from public.goals g where g.id = selected.goal_id for update;
  select case when next_value >= g.target_value then 'completed'::public.goal_status when next_status = 'completed' then 'active'::public.goal_status else next_status end into next_status from public.goals g where g.id = selected.goal_id;
  update public.goal_progress_entries set amount = p_amount, note = nullif(trim(p_note), ''), updated_at = now() where id = p_entry_id;
  update public.goals set current_value = next_value, status = next_status where id = selected.goal_id;
  perform public.sync_goal_milestones(selected.goal_id, next_value);
  return query select next_value, next_status;
end;
$$;

create or replace function public.delete_goal_progress(p_entry_id uuid)
returns table(goal_id uuid, new_current_value numeric, new_goal_status public.goal_status)
language plpgsql security definer set search_path = public as $$
declare selected public.goal_progress_entries%rowtype; next_value numeric; next_status public.goal_status;
begin
  select * into selected from public.goal_progress_entries where id = p_entry_id and user_id = auth.uid() for update;
  if not found then raise exception 'Progress entry not found.'; end if;
  select greatest(0, g.current_value - selected.amount), g.status into next_value, next_status from public.goals g where g.id = selected.goal_id for update;
  select case when next_value >= g.target_value then 'completed'::public.goal_status when next_status = 'completed' then 'active'::public.goal_status else next_status end into next_status from public.goals g where g.id = selected.goal_id;
  delete from public.goal_progress_entries where id = p_entry_id;
  update public.goals set current_value = next_value, status = next_status where id = selected.goal_id;
  perform public.sync_goal_milestones(selected.goal_id, next_value);
  return query select selected.goal_id, next_value, next_status;
end;
$$;

revoke all on function public.log_goal_progress(uuid, numeric, text) from public;
revoke all on function public.edit_goal_progress(uuid, numeric, text) from public;
revoke all on function public.delete_goal_progress(uuid) from public;
grant execute on function public.log_goal_progress(uuid, numeric, text) to authenticated;
grant execute on function public.edit_goal_progress(uuid, numeric, text) to authenticated;
grant execute on function public.delete_goal_progress(uuid) to authenticated;

drop trigger if exists progress_entries_updated_at on public.goal_progress_entries;
create trigger progress_entries_updated_at before update on public.goal_progress_entries for each row execute function public.set_updated_at();
