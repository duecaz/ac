-- Applied via MCP. Audit follow-up.
-- #3 Anti-cheat: move the answer key out of the student-readable session row.
create table if not exists repo_ac.session_keys (
  session_id uuid primary key references repo_ac.sessions(id) on delete cascade,
  snap jsonb not null,
  created_at timestamptz not null default now()
);
alter table repo_ac.session_keys enable row level security;
drop policy if exists "session_keys_select_host" on repo_ac.session_keys;
create policy "session_keys_select_host" on repo_ac.session_keys for select
  using (session_id in (select id from repo_ac.sessions where host_id = (select auth.uid())));
grant select on repo_ac.session_keys to anon, authenticated;
grant all on repo_ac.session_keys to service_role;

-- #4 finalize_session_results: only the session host may finalize.
create or replace function repo_ac.finalize_session_results(p_session_id uuid)
returns int language plpgsql security definer set search_path = repo_ac as $$
declare inserted int := 0; max_score int; v_started timestamptz;
begin
  if not exists (select 1 from repo_ac.sessions s where s.id = p_session_id and s.host_id = (select auth.uid())) then
    return 0;
  end if;
  select s.started_at into v_started from repo_ac.sessions s where s.id = p_session_id;
  if v_started is null then return 0; end if;
  select coalesce(nullif((s.activity_snap->'scoring'->>'maxScore')::int, 0),
    coalesce((s.activity_snap->'scoring'->>'pointsPerCorrect')::int, 1) * jsonb_array_length(s.activity_snap->'content'->'items'))
    into max_score from repo_ac.sessions s where s.id = p_session_id;
  insert into repo_ac.results (activity_id, session_id, user_id, player_name, score_auto, score_final, max_score, time_used)
  select s.activity_id, s.id, p.user_id, p.name, p.score, p.score, max_score,
    extract(epoch from (coalesce(s.ended_at, now()) - s.started_at))::int
  from repo_ac.sessions s join repo_ac.players p on p.session_id = s.id
  where s.id = p_session_id on conflict do nothing;
  get diagnostics inserted = row_count; return inserted;
end $$;

-- #7 PERF: wrap auth.uid() in (select auth.uid()) across policies (advisor 0003).
-- (Applied via ALTER POLICY; predicates unchanged. See migration rls_initplan_perf.)
