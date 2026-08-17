-- DOIT AI V2.1: additive, non-destructive agent foundation.
do $$ begin create type public.energy_level as enum ('low', 'medium', 'high'); exception when duplicate_object then null; end $$;
do $$ begin create type public.scheduling_flexibility as enum ('fixed', 'flexible', 'anytime'); exception when duplicate_object then null; end $$;
do $$ begin create type public.calendar_item_type as enum ('task', 'focus', 'event', 'break', 'deadline'); exception when duplicate_object then null; end $$;
do $$ begin create type public.recurrence_frequency as enum ('daily', 'weekdays', 'weekly', 'selected_days', 'monthly'); exception when duplicate_object then null; end $$;
do $$ begin create type public.inbox_status as enum ('unprocessed', 'processed', 'archived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.agent_action_status as enum ('pending', 'applied', 'cancelled', 'failed'); exception when duplicate_object then null; end $$;

create table if not exists public.recurrence_rules (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  frequency public.recurrence_frequency not null, interval integer not null default 1 check (interval > 0), days_of_week smallint[], day_of_month smallint,
  starts_on date not null default current_date, ends_on date, timezone text not null default 'UTC',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (days_of_week is null or days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]), check (day_of_month is null or day_of_month between 1 and 31), check (ends_on is null or ends_on >= starts_on)
);

alter table public.tasks alter column goal_id drop not null;
alter table public.tasks add column if not exists energy_level public.energy_level;
alter table public.tasks add column if not exists actual_minutes integer check (actual_minutes >= 0);
alter table public.tasks add column if not exists deadline timestamptz;
alter table public.tasks add column if not exists scheduling_flexibility public.scheduling_flexibility not null default 'flexible';
alter table public.tasks add column if not exists recurrence_rule_id uuid references public.recurrence_rules(id) on delete set null;
alter table public.tasks add column if not exists tags text[] not null default '{}';
alter table public.tasks add column if not exists notes text;

create table if not exists public.calendar_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, title text not null,
  type public.calendar_item_type not null, start_time timestamptz not null, end_time timestamptz not null,
  goal_id uuid references public.goals(id) on delete cascade, task_id uuid references public.tasks(id) on delete cascade, is_fixed boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (end_time > start_time)
);

create table if not exists public.task_dependencies (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade, depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(), unique(task_id, depends_on_task_id), check (task_id <> depends_on_task_id)
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  preferred_work_minutes integer not null default 30 check (preferred_work_minutes between 5 and 480), preferred_start_time time, preferred_end_time time,
  available_days smallint[] not null default array[1,2,3,4,5]::smallint[], energy_pattern jsonb not null default '{}', planning_style text not null default 'balanced' check (planning_style in ('light','balanced','ambitious')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, content text not null,
  classification text check (classification in ('task','note','goal_idea','reminder')), status public.inbox_status not null default 'unprocessed',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, task_id uuid references public.tasks(id) on delete set null,
  started_at timestamptz not null, ended_at timestamptz, paused_seconds integer not null default 0 check (paused_seconds >= 0), actual_minutes integer check (actual_minutes >= 0),
  status text not null check (status in ('active','paused','completed','abandoned')), created_at timestamptz not null default now(), check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  request text not null, response jsonb not null, status public.agent_action_status not null default 'pending', requires_confirmation boolean not null default false,
  error text, executed_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, week_start date not null, week_end date not null,
  tasks_completed integer not null default 0, completion_rate numeric not null default 0, minutes_spent integer not null default 0,
  summary text not null default '', wins jsonb not null default '[]', blockers jsonb not null default '[]', next_week_changes jsonb not null default '[]', created_at timestamptz not null default now(),
  unique(user_id, week_start), check (week_end >= week_start), check (completion_rate between 0 and 100)
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  task_reminders boolean not null default true, daily_planning boolean not null default true, check_ins boolean not null default true,
  goal_warnings boolean not null default true, weekly_review boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.goal_snapshots (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, goal_id uuid not null references public.goals(id) on delete cascade,
  captured_on date not null, current_value numeric not null, progress_percent numeric not null check (progress_percent between 0 and 100), status public.goal_status not null,
  created_at timestamptz not null default now(), unique(goal_id, captured_on)
);

create index if not exists recurrence_rules_user_idx on public.recurrence_rules(user_id);
create index if not exists tasks_recurrence_idx on public.tasks(recurrence_rule_id) where recurrence_rule_id is not null;
create index if not exists calendar_items_user_time_idx on public.calendar_items(user_id, start_time);
create index if not exists task_dependencies_task_idx on public.task_dependencies(task_id);
create index if not exists inbox_items_user_status_idx on public.inbox_items(user_id, status, created_at desc);
create index if not exists focus_sessions_user_started_idx on public.focus_sessions(user_id, started_at desc);
create index if not exists agent_actions_user_created_idx on public.agent_actions(user_id, created_at desc);
create index if not exists weekly_reviews_user_week_idx on public.weekly_reviews(user_id, week_start desc);
create index if not exists goal_snapshots_goal_date_idx on public.goal_snapshots(goal_id, captured_on desc);

alter table public.recurrence_rules enable row level security;
alter table public.calendar_items enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.user_preferences enable row level security;
alter table public.inbox_items enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.agent_actions enable row level security;
alter table public.weekly_reviews enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.goal_snapshots enable row level security;

create policy "own recurrence rules" on public.recurrence_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own calendar items" on public.calendar_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own task dependencies" on public.task_dependencies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own user preferences" on public.user_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own inbox items" on public.inbox_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own focus sessions" on public.focus_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own agent actions" on public.agent_actions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own weekly reviews" on public.weekly_reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own notification preferences" on public.notification_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own goal snapshots" on public.goal_snapshots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Relationship-aware ownership checks prevent a valid user from attaching
-- their records to another user's goal, task, or recurrence rule.
drop policy if exists "own tasks" on public.tasks;
create policy "own tasks" on public.tasks for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (goal_id is null or exists (select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid()))
    and (recurrence_rule_id is null or exists (select 1 from public.recurrence_rules r where r.id = recurrence_rule_id and r.user_id = auth.uid()))
  );

drop policy if exists "own calendar items" on public.calendar_items;
create policy "own calendar items" on public.calendar_items for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (goal_id is null or exists (select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid()))
    and (task_id is null or exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()))
  );

drop policy if exists "own task dependencies" on public.task_dependencies;
create policy "own task dependencies" on public.task_dependencies for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid())
    and exists (select 1 from public.tasks d where d.id = depends_on_task_id and d.user_id = auth.uid())
  );

drop policy if exists "own focus sessions" on public.focus_sessions;
create policy "own focus sessions" on public.focus_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and (task_id is null or exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid())));

drop policy if exists "own goal snapshots" on public.goal_snapshots;
create policy "own goal snapshots" on public.goal_snapshots for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid()));

create trigger recurrence_rules_updated_at before update on public.recurrence_rules for each row execute function public.set_updated_at();
create trigger calendar_items_updated_at before update on public.calendar_items for each row execute function public.set_updated_at();
create trigger user_preferences_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();
create trigger inbox_items_updated_at before update on public.inbox_items for each row execute function public.set_updated_at();
create trigger notification_preferences_updated_at before update on public.notification_preferences for each row execute function public.set_updated_at();
