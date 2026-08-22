-- MAX intelligence uses existing task dependencies but enforces entitlement
-- in Postgres so client-side gating cannot be bypassed.
drop policy if exists "own task dependencies" on public.task_dependencies;
create policy "read own task dependencies" on public.task_dependencies for select using (auth.uid() = user_id);
revoke insert, update, delete on public.task_dependencies from authenticated;
grant select on public.task_dependencies to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['task_dependencies', 'subscriptions', 'calendar_items', 'weekly_reviews']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

create or replace function public.set_max_task_dependency(p_task_id uuid, p_depends_on_task_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  dependency_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required.'; end if;
  if not exists (
    select 1 from public.subscriptions s
    where s.user_id = current_user_id
      and s.plan::text in ('max', 'premium')
      and (s.status = 'active'::public.subscription_status or (s.status = 'trialing'::public.subscription_status and s.trial_ends_at > now()))
  ) then raise exception 'DOIT MAX is required for goal dependencies.'; end if;

  if not exists (select 1 from public.tasks where id = p_task_id and user_id = current_user_id) then
    raise exception 'Action not found.';
  end if;

  delete from public.task_dependencies where user_id = current_user_id and task_id = p_task_id;
  if p_depends_on_task_id is null then return null; end if;
  if p_depends_on_task_id = p_task_id then raise exception 'An action cannot depend on itself.'; end if;
  if not exists (select 1 from public.tasks where id = p_depends_on_task_id and user_id = current_user_id) then
    raise exception 'Prerequisite action not found.';
  end if;
  if exists (
    with recursive dependency_chain as (
      select d.task_id, d.depends_on_task_id
      from public.task_dependencies d
      where d.user_id = current_user_id and d.task_id = p_depends_on_task_id
      union
      select d.task_id, d.depends_on_task_id
      from public.task_dependencies d
      join dependency_chain chain on d.task_id = chain.depends_on_task_id
      where d.user_id = current_user_id
    )
    select 1 from dependency_chain where depends_on_task_id = p_task_id
  ) then
    raise exception 'That dependency would create a cycle.';
  end if;

  insert into public.task_dependencies (user_id, task_id, depends_on_task_id)
  values (current_user_id, p_task_id, p_depends_on_task_id)
  returning id into dependency_id;
  return dependency_id;
end;
$$;

revoke all on function public.set_max_task_dependency(uuid, uuid) from public;
grant execute on function public.set_max_task_dependency(uuid, uuid) to authenticated;
