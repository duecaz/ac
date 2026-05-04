-- Mirror of migration 0001_init_schema applied via MCP.
-- See supabase/migrations/0001_init_schema.sql for the canonical version.

create extension if not exists "pgcrypto";

create table if not exists public.activities (
  id text primary key check (id ~ '^act_[A-Za-z0-9_-]{4,32}$'),
  data jsonb not null,
  author_id uuid,
  visibility text not null default 'private' check (visibility in ('private','unlisted','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists activities_author_idx on public.activities(author_id);
create index if not exists activities_visibility_idx on public.activities(visibility) where visibility <> 'private';

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid not null,
  activity_id text references public.activities(id),
  activity_snap jsonb not null,
  status text not null default 'lobby' check (status in ('lobby','running','review','ended')),
  current_item int not null default -1,
  phase text not null default 'idle' check (phase in ('idle','question','reveal','leaderboard','ended')),
  deadline timestamptz,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);
create index if not exists sessions_host_idx on public.sessions(host_id);
create index if not exists sessions_status_created_idx on public.sessions(status, created_at);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  score int not null default 0,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (session_id, user_id)
);
create index if not exists players_session_idx on public.players(session_id);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  item_index int not null,
  value jsonb not null,
  correct bool,
  points int not null default 0,
  ms_taken int,
  created_at timestamptz not null default now(),
  unique (session_id, player_id, item_index)
);
create index if not exists answers_session_item_idx on public.answers(session_id, item_index);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  activity_id text references public.activities(id),
  session_id uuid references public.sessions(id),
  user_id uuid,
  player_name text,
  score_auto int,
  score_final int,
  max_score int,
  time_used int,
  overrides jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (activity_id is not null or session_id is not null)
);
create index if not exists results_activity_created_idx on public.results(activity_id, created_at desc);
create index if not exists results_session_idx on public.results(session_id);

alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.answers;

alter table public.activities enable row level security;
alter table public.sessions enable row level security;
alter table public.players enable row level security;
alter table public.answers enable row level security;
alter table public.results enable row level security;

create policy "open_all" on public.activities for all using (true) with check (true);
create policy "open_all" on public.sessions for all using (true) with check (true);
create policy "open_all" on public.players for all using (true) with check (true);
create policy "open_all" on public.answers for all using (true) with check (true);
create policy "open_all" on public.results for all using (true) with check (true);

create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists activities_updated_at on public.activities;
create trigger activities_updated_at before update on public.activities
  for each row execute function public.set_updated_at();
