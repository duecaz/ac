-- Applied via MCP. Address Supabase advisor warnings.

drop view if exists public.players_active;
create view public.players_active with (security_invoker = true) as
  select *, (now() - last_seen) < interval '30 seconds' as online
  from public.players;

alter function public.set_updated_at() set search_path = public;
alter function public.generate_session_code() set search_path = public;
alter function public.generate_assignment_code() set search_path = public;
alter function public.enforce_max_players() set search_path = public;
alter function public.finalize_session_results(uuid) set search_path = public;
alter function public.handle_new_user() set search_path = public;

revoke execute on function public.handle_new_user() from anon, authenticated, public;

drop policy if exists "answers_delete" on public.answers;
create policy "answers_delete" on public.answers for delete using (
  player_id in (select id from public.players where user_id = auth.uid())
  or session_id in (select id from public.sessions where host_id = auth.uid())
);

drop policy if exists "media_read" on storage.objects;
drop policy if exists "media_write" on storage.objects;
create policy "media_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_insert_anon" on storage.objects for insert to anon
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
