-- Applied via MCP (Supabase) as migration `create_repo_ac_schema`.
-- Moves the whole app into a dedicated `repo_ac` schema so this shared Supabase
-- project clearly identifies the `ac` repo's data. Consolidates the final state
-- of 0001–0013. The client (core/supabase.js db.schema), realtime filters
-- (core/transport/live.js) and Edge Functions (admin client db.schema) target
-- repo_ac. IMPORTANT: add `repo_ac` to Dashboard → API → Exposed schemas.
create extension if not exists "pgcrypto";
create schema if not exists repo_ac;

create table if not exists repo_ac.activities (
  id text primary key check (id ~ '^act_[A-Za-z0-9_-]{4,32}$'),
  data jsonb not null,
  author_id uuid,
  visibility text not null default 'private' check (visibility in ('private','unlisted','public')),
  tags text[] default '{}'::text[],
  language text default 'es',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists activities_author_idx on repo_ac.activities(author_id);
create index if not exists activities_visibility_idx on repo_ac.activities(visibility) where visibility <> 'private';
create index if not exists activities_tags_idx on repo_ac.activities using gin (tags);
create index if not exists activities_lang_idx on repo_ac.activities(language) where visibility = 'public';

create table if not exists repo_ac.sessions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid not null,
  activity_id text references repo_ac.activities(id),
  activity_snap jsonb not null,
  status text not null default 'lobby' check (status in ('lobby','running','review','ended')),
  current_item int not null default -1,
  phase text not null default 'idle' check (phase in ('idle','question','reveal','leaderboard','ended')),
  deadline timestamptz,
  rules jsonb not null default '{}'::jsonb,
  host_seen_at timestamptz default now(),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);
create index if not exists sessions_host_idx on repo_ac.sessions(host_id);
create index if not exists sessions_status_created_idx on repo_ac.sessions(status, created_at);
create index if not exists sessions_host_seen_idx on repo_ac.sessions(host_seen_at) where status not in ('ended');

create table if not exists repo_ac.players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references repo_ac.sessions(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  score int not null default 0,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (session_id, user_id)
);
create index if not exists players_session_idx on repo_ac.players(session_id);

create table if not exists repo_ac.answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references repo_ac.sessions(id) on delete cascade,
  player_id uuid not null references repo_ac.players(id) on delete cascade,
  item_index int not null,
  value jsonb not null,
  correct bool,
  points int not null default 0,
  ms_taken int,
  created_at timestamptz not null default now(),
  unique (session_id, player_id, item_index)
);
create index if not exists answers_session_item_idx on repo_ac.answers(session_id, item_index);

create table if not exists repo_ac.assignments (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  activity_id text references repo_ac.activities(id),
  activity_snap jsonb not null,
  author_id uuid, title text, due_at timestamptz,
  max_attempts int not null default 1,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);
create index if not exists assignments_author_idx on repo_ac.assignments(author_id);
create index if not exists assignments_activity_idx on repo_ac.assignments(activity_id);

create table if not exists repo_ac.results (
  id uuid primary key default gen_random_uuid(),
  activity_id text references repo_ac.activities(id),
  session_id uuid references repo_ac.sessions(id),
  assignment_id uuid references repo_ac.assignments(id),
  user_id uuid, player_name text,
  score_auto int, score_final int, max_score int, time_used int,
  overrides jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (activity_id is not null or session_id is not null)
);
create index if not exists results_activity_created_idx on repo_ac.results(activity_id, created_at desc);
create index if not exists results_session_idx on repo_ac.results(session_id);
create index if not exists results_assignment_idx on repo_ac.results(assignment_id);

create table if not exists repo_ac.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, page text, message text not null, stack text,
  user_agent text, url text, created_at timestamptz not null default now()
);
create index if not exists client_errors_created_idx on repo_ac.client_errors(created_at desc);

create table if not exists repo_ac.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text, avatar_url text,
  is_anonymous bool not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_name_idx on repo_ac.profiles(display_name);

create or replace function repo_ac.set_updated_at() returns trigger
  language plpgsql set search_path = repo_ac as $$ begin new.updated_at = now(); return new; end; $$;
create or replace function repo_ac.generate_session_code() returns text
  language plpgsql set search_path = repo_ac as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; new_code text; attempts int := 0;
begin loop new_code := '';
  for i in 1..6 loop new_code := new_code || substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1); end loop;
  perform 1 from repo_ac.sessions s where s.code = new_code and s.status <> 'ended';
  if not found then return new_code; end if;
  attempts := attempts + 1; if attempts > 50 then raise exception 'could not generate unique code'; end if;
end loop; end $$;
create or replace function repo_ac.generate_assignment_code() returns text
  language plpgsql set search_path = repo_ac as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; new_code text; attempts int := 0;
begin loop new_code := '';
  for i in 1..6 loop new_code := new_code || substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1); end loop;
  perform 1 from repo_ac.assignments a where a.code = new_code;
  if not found then return new_code; end if;
  attempts := attempts + 1; if attempts > 50 then raise exception 'could not generate unique code'; end if;
end loop; end $$;
create or replace function repo_ac.enforce_max_players() returns trigger
  language plpgsql set search_path = repo_ac as $$
declare cap int; cur int;
begin select coalesce((s.activity_snap->'live'->>'maxPlayers')::int, 60) into cap from repo_ac.sessions s where s.id = new.session_id;
  select count(*) into cur from repo_ac.players where session_id = new.session_id;
  if cur >= cap then raise exception 'MAX_PLAYERS_REACHED' using errcode = 'check_violation'; end if;
  return new; end $$;
create or replace function repo_ac.finalize_session_results(p_session_id uuid) returns int
  language plpgsql security definer set search_path = repo_ac as $$
declare inserted int := 0; max_score int; v_started timestamptz;
begin select s.started_at into v_started from repo_ac.sessions s where s.id = p_session_id;
  if v_started is null then return 0; end if;
  select coalesce(nullif((s.activity_snap->'scoring'->>'maxScore')::int, 0),
    coalesce((s.activity_snap->'scoring'->>'pointsPerCorrect')::int, 1) * jsonb_array_length(s.activity_snap->'content'->'items'))
    into max_score from repo_ac.sessions s where s.id = p_session_id;
  insert into repo_ac.results (activity_id, session_id, user_id, player_name, score_auto, score_final, max_score, time_used)
  select s.activity_id, s.id, p.user_id, p.name, p.score, p.score, max_score,
    extract(epoch from (coalesce(s.ended_at, now()) - s.started_at))::int
  from repo_ac.sessions s join repo_ac.players p on p.session_id = s.id where s.id = p_session_id on conflict do nothing;
  get diagnostics inserted = row_count; return inserted; end $$;
create or replace function repo_ac.handle_new_user() returns trigger
  language plpgsql security definer set search_path = repo_ac as $$
begin insert into repo_ac.profiles (id, display_name, is_anonymous)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Anónimo'),
          coalesce((new.is_anonymous)::bool, false)) on conflict (id) do nothing; return new; end $$;
create or replace function repo_ac.ping_host_session(p_session_id uuid) returns void
  language sql security invoker set search_path = repo_ac as $$
  update repo_ac.sessions set host_seen_at = now() where id = p_session_id and host_id = auth.uid(); $$;
create or replace function repo_ac.cleanup_zombie_sessions() returns int
  language plpgsql security definer set search_path = repo_ac as $$
declare c int; begin update repo_ac.sessions set status='ended', phase='ended', ended_at=now()
  where status not in ('ended') and host_seen_at < now() - interval '5 minutes';
  get diagnostics c = row_count; return c; end $$;
create or replace function repo_ac.increment_player_score(p_player_id uuid, p_delta int) returns int
  language sql security definer set search_path = repo_ac as $$
  update repo_ac.players set score = coalesce(score,0) + p_delta where id = p_player_id returning score; $$;
create or replace function repo_ac.validate_player_name() returns trigger
  language plpgsql set search_path = repo_ac as $$
begin new.name := btrim(new.name);
  if char_length(new.name) < 2 then raise exception 'NAME_TOO_SHORT' using errcode='check_violation'; end if;
  if char_length(new.name) > 40 then raise exception 'NAME_TOO_LONG' using errcode='check_violation'; end if;
  if new.name ~ '[\x00-\x1F\x7F]' then raise exception 'NAME_INVALID_CHARS' using errcode='check_violation'; end if;
  return new; end $$;

drop trigger if exists activities_updated_at on repo_ac.activities;
create trigger activities_updated_at before update on repo_ac.activities for each row execute function repo_ac.set_updated_at();
drop trigger if exists players_max on repo_ac.players;
create trigger players_max before insert on repo_ac.players for each row execute function repo_ac.enforce_max_players();
drop trigger if exists players_name_validate on repo_ac.players;
create trigger players_name_validate before insert or update of name on repo_ac.players for each row execute function repo_ac.validate_player_name();
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function repo_ac.handle_new_user();

drop view if exists repo_ac.players_active;
create view repo_ac.players_active with (security_invoker = true) as
  select *, (now() - last_seen) < interval '30 seconds' as online from repo_ac.players;

alter table repo_ac.sessions replica identity full;
alter table repo_ac.players replica identity full;
alter table repo_ac.answers replica identity full;
alter publication supabase_realtime add table repo_ac.sessions;
alter publication supabase_realtime add table repo_ac.players;
alter publication supabase_realtime add table repo_ac.answers;

alter table repo_ac.activities enable row level security;
alter table repo_ac.sessions enable row level security;
alter table repo_ac.players enable row level security;
alter table repo_ac.answers enable row level security;
alter table repo_ac.results enable row level security;
alter table repo_ac.assignments enable row level security;
alter table repo_ac.client_errors enable row level security;
alter table repo_ac.profiles enable row level security;

create policy "activities_select" on repo_ac.activities for select using (visibility in ('public','unlisted') or author_id = auth.uid() or author_id is null);
create policy "activities_insert" on repo_ac.activities for insert with check (auth.uid() is not null and (author_id = auth.uid() or author_id is null));
create policy "activities_update" on repo_ac.activities for update using (author_id = auth.uid() or author_id is null) with check (author_id = auth.uid());
create policy "activities_delete" on repo_ac.activities for delete using (author_id = auth.uid() or author_id is null);
create policy "sessions_select" on repo_ac.sessions for select using (true);
create policy "sessions_insert" on repo_ac.sessions for insert with check (auth.uid() is not null and host_id = auth.uid());
create policy "sessions_update" on repo_ac.sessions for update using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy "sessions_delete" on repo_ac.sessions for delete using (host_id = auth.uid());
create policy "players_select" on repo_ac.players for select using (true);
create policy "players_insert" on repo_ac.players for insert with check (auth.uid() is not null);
create policy "players_update" on repo_ac.players for update using (user_id = auth.uid() or session_id in (select id from repo_ac.sessions where host_id = auth.uid()));
create policy "players_delete" on repo_ac.players for delete using (user_id = auth.uid() or session_id in (select id from repo_ac.sessions where host_id = auth.uid()));
create policy "answers_select" on repo_ac.answers for select using (true);
create policy "answers_insert" on repo_ac.answers for insert with check (correct is null and points = 0);
create policy "answers_delete" on repo_ac.answers for delete using (player_id in (select id from repo_ac.players where user_id = auth.uid()) or session_id in (select id from repo_ac.sessions where host_id = auth.uid()));
create policy "answers_update_own_pending" on repo_ac.answers for update
  using (correct is null and points = 0 and player_id in (select id from repo_ac.players where user_id = auth.uid()))
  with check (correct is null and points = 0 and player_id in (select id from repo_ac.players where user_id = auth.uid()));
create policy "results_select" on repo_ac.results for select using (true);
create policy "results_insert" on repo_ac.results for insert with check (true);
create policy "assignments_select" on repo_ac.assignments for select using (true);
create policy "assignments_insert" on repo_ac.assignments for insert with check (auth.uid() is not null and (author_id = auth.uid() or author_id is null));
create policy "assignments_update" on repo_ac.assignments for update using (author_id = auth.uid() or author_id is null) with check (author_id = auth.uid() or author_id is null);
create policy "assignments_delete" on repo_ac.assignments for delete using (author_id = auth.uid() or author_id is null);
create policy "errors_insert" on repo_ac.client_errors for insert with check (true);
create policy "profiles_select" on repo_ac.profiles for select using (true);
create policy "profiles_update_self" on repo_ac.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

grant usage on schema repo_ac to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema repo_ac to anon, authenticated;
grant all on all tables in schema repo_ac to service_role;
alter default privileges in schema repo_ac grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema repo_ac grant all on tables to service_role;
grant execute on function repo_ac.finalize_session_results(uuid) to anon, authenticated;
grant execute on function repo_ac.generate_assignment_code() to anon, authenticated;
grant execute on function repo_ac.generate_session_code() to anon, authenticated, service_role;
grant execute on function repo_ac.ping_host_session(uuid) to authenticated, anon;
grant execute on function repo_ac.increment_player_score(uuid, int) to service_role;
revoke execute on function repo_ac.handle_new_user() from anon, authenticated, public;
revoke execute on function repo_ac.cleanup_zombie_sessions() from public, anon, authenticated;

insert into storage.buckets (id, name, public) values ('repo-ac-media','repo-ac-media', true) on conflict (id) do nothing;
create policy "repo_ac_media_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'repo-ac-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "repo_ac_media_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'repo-ac-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "repo_ac_media_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'repo-ac-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "repo_ac_media_insert_anon" on storage.objects for insert to anon
  with check (bucket_id = 'repo-ac-media' and (storage.foldername(name))[1] = auth.uid()::text);
