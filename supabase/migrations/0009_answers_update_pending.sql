-- Applied via MCP. Allow players to UPDATE their own PENDING answer.
-- Without this, upsert() from the client (reconnects, double clicks) fails
-- because UPDATE has no policy. Pending = correct null AND points 0.
create policy "answers_update_own_pending" on public.answers for update
  using (
    correct is null and points = 0
    and player_id in (select id from public.players where user_id = auth.uid())
  )
  with check (
    correct is null and points = 0
    and player_id in (select id from public.players where user_id = auth.uid())
  );
