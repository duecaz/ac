-- Applied via MCP. Auth real + profiles + RLS endurecida.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  is_anonymous bool not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_name_idx on public.profiles(display_name);

alter table public.profiles enable row level security;
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update_self" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, is_anonymous)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Anónimo'),
          coalesce((new.is_anonymous)::bool, false))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Activities RLS hardened.
drop policy if exists "open_all" on public.activities;
create policy "activities_select" on public.activities for select using (
  visibility in ('public','unlisted') or author_id = auth.uid() or author_id is null
);
create policy "activities_insert" on public.activities for insert with check (
  auth.uid() is not null and (author_id = auth.uid() or author_id is null)
);
create policy "activities_update" on public.activities for update using (
  author_id = auth.uid() or author_id is null
) with check (author_id = auth.uid());
create policy "activities_delete" on public.activities for delete using (
  author_id = auth.uid() or author_id is null
);

drop policy if exists "open_all" on public.assignments;
create policy "assignments_select" on public.assignments for select using (true);
create policy "assignments_insert" on public.assignments for insert with check (
  auth.uid() is not null and (author_id = auth.uid() or author_id is null)
);
create policy "assignments_update" on public.assignments for update using (
  author_id = auth.uid() or author_id is null
) with check (author_id = auth.uid() or author_id is null);
create policy "assignments_delete" on public.assignments for delete using (
  author_id = auth.uid() or author_id is null
);

drop policy if exists "open_all" on public.sessions;
create policy "sessions_select" on public.sessions for select using (true);
create policy "sessions_insert" on public.sessions for insert with check (
  auth.uid() is not null and host_id = auth.uid()
);
create policy "sessions_update" on public.sessions for update using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy "sessions_delete" on public.sessions for delete using (host_id = auth.uid());

drop policy if exists "open_all" on public.players;
create policy "players_select" on public.players for select using (true);
create policy "players_insert" on public.players for insert with check (auth.uid() is not null);
create policy "players_update" on public.players for update using (
  user_id = auth.uid() or session_id in (select id from public.sessions where host_id = auth.uid())
);
create policy "players_delete" on public.players for delete using (
  user_id = auth.uid() or session_id in (select id from public.sessions where host_id = auth.uid())
);

drop policy if exists "open_all" on public.results;
create policy "results_select" on public.results for select using (true);
create policy "results_insert" on public.results for insert with check (true);

alter table public.activities add column if not exists tags text[] default '{}'::text[];
alter table public.activities add column if not exists language text default 'es';
create index if not exists activities_tags_idx on public.activities using gin (tags);
create index if not exists activities_lang_idx on public.activities(language) where visibility = 'public';
