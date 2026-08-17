-- DOIT AI: Today, goal management, milestones, and account controls.
do $$ begin alter type public.goal_status add value if not exists 'paused'; exception when duplicate_object then null; end $$;

alter table public.daily_checkins add column if not exists accomplishment text;
alter table public.milestones add column if not exists due_date date;

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_user_account() from public;
grant execute on function public.delete_user_account() to authenticated;
