create extension if not exists "pgcrypto";

create type public.goal_status as enum ('active', 'completed', 'archived');
create type public.milestone_status as enum ('pending', 'current', 'completed');
create type public.task_status as enum ('pending', 'completed', 'skipped', 'moved');
create type public.task_priority as enum ('low', 'medium', 'high');
create type public.checkin_mood as enum ('great', 'okay', 'bad');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160), description text not null default '', status public.goal_status not null default 'active',
  target_value numeric not null default 100 check (target_value > 0), current_value numeric not null default 0 check (current_value >= 0), unit text not null default '%', target_date date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(), goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null, description text not null default '', target_value numeric not null, sort_order integer not null default 0,
  status public.milestone_status not null default 'pending', completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(), goal_id uuid not null references public.goals(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, description text not null default '', scheduled_date date not null, status public.task_status not null default 'pending', priority public.task_priority not null default 'medium',
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0), ai_generated boolean not null default true, move_count integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz
);

create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, date date not null,
  mood public.checkin_mood not null, blocker text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, date)
);

create table public.goal_activity (
  id uuid primary key default gen_random_uuid(), goal_id uuid references public.goals(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, title text not null, detail text, created_at timestamptz not null default now()
);

create index goals_user_id_idx on public.goals(user_id);
create index tasks_user_date_idx on public.tasks(user_id, scheduled_date);
create index milestones_goal_id_idx on public.milestones(goal_id);
create index activity_user_created_idx on public.goal_activity(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.goal_activity enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own goals" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own milestones" on public.milestones for all using (exists (select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid())) with check (exists (select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid()));
create policy "own tasks" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own checkins" on public.daily_checkins for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own activity" on public.goal_activity for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger goals_updated_at before update on public.goals for each row execute function public.set_updated_at();
create trigger milestones_updated_at before update on public.milestones for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger checkins_updated_at before update on public.daily_checkins for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Executor')); return new; end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
