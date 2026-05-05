-- Applied via MCP. Reports persistence + client error logging.

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  page text,
  message text not null,
  stack text,
  user_agent text,
  url text,
  created_at timestamptz not null default now()
);
create index if not exists client_errors_created_idx on public.client_errors(created_at desc);

alter table public.client_errors enable row level security;
create policy "errors_insert" on public.client_errors for insert with check (true);
-- No select for anon/authenticated.

create or replace function public.finalize_session_results(p_session_id uuid)
returns int language plpgsql security definer as $$
declare
  inserted int := 0;
  max_score int;
  v_started timestamptz;
begin
  select s.started_at into v_started from public.sessions s where s.id = p_session_id;
  if v_started is null then return 0; end if;

  select coalesce(
    nullif((s.activity_snap->'scoring'->>'maxScore')::int, 0),
    coalesce((s.activity_snap->'scoring'->>'pointsPerCorrect')::int, 1) *
    jsonb_array_length(s.activity_snap->'content'->'items')
  ) into max_score from public.sessions s where s.id = p_session_id;

  insert into public.results (
    activity_id, session_id, user_id, player_name,
    score_auto, score_final, max_score, time_used
  )
  select
    s.activity_id, s.id, p.user_id, p.name,
    p.score, p.score, max_score,
    extract(epoch from (coalesce(s.ended_at, now()) - s.started_at))::int
  from public.sessions s
  join public.players p on p.session_id = s.id
  where s.id = p_session_id
  on conflict do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end $$;
grant execute on function public.finalize_session_results(uuid) to anon, authenticated;
