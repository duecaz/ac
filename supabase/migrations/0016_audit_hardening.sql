-- Applied via MCP (Supabase) as `harden_increment_score_and_fk_index`.
-- Security + performance hardening found during the audit.

-- SECURITY (critical): increment_player_score is SECURITY DEFINER and only the
-- Edge Function (service_role) must call it. Postgres grants EXECUTE to PUBLIC
-- by default, so without this revoke any student could call
-- rpc('increment_player_score', { p_player_id, p_delta }) and set ANY score
-- (the function bypasses RLS). Revoke from everyone but service_role.
revoke execute on function repo_ac.increment_player_score(uuid, int) from public, anon, authenticated;

-- PERF: covering indexes for the two foreign keys flagged as unindexed.
create index if not exists answers_player_idx on repo_ac.answers(player_id);
create index if not exists sessions_activity_idx on repo_ac.sessions(activity_id);
