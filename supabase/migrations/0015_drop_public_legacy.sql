-- Applied via MCP (Supabase) as `drop_public_legacy_objects` +
-- `harden_validate_player_name_search_path`. Removes the legacy `ac` objects
-- from `public` after 0014 recreated them under `repo_ac`. The auth.users
-- new-user trigger was already repointed to repo_ac.handle_new_user in 0014.
drop table if exists public.answers cascade;
drop table if exists public.players cascade;
drop table if exists public.results cascade;
drop table if exists public.assignments cascade;
drop table if exists public.sessions cascade;
drop table if exists public.activities cascade;
drop table if exists public.client_errors cascade;
drop table if exists public.profiles cascade;
drop view if exists public.players_active cascade;

drop function if exists public.set_updated_at() cascade;
drop function if exists public.generate_session_code() cascade;
drop function if exists public.generate_assignment_code() cascade;
drop function if exists public.enforce_max_players() cascade;
drop function if exists public.finalize_session_results(uuid) cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.ping_host_session(uuid) cascade;
drop function if exists public.cleanup_zombie_sessions() cascade;
drop function if exists public.increment_player_score(uuid, int) cascade;
drop function if exists public.validate_player_name() cascade;

-- Old storage policies for the previous 'media' bucket (replaced by repo-ac-media).
drop policy if exists "media_insert_own" on storage.objects;
drop policy if exists "media_update_own" on storage.objects;
drop policy if exists "media_delete_own" on storage.objects;
drop policy if exists "media_insert_anon" on storage.objects;

-- Pin search_path on the name validator (advisor: function_search_path_mutable).
alter function repo_ac.validate_player_name() set search_path = repo_ac;
