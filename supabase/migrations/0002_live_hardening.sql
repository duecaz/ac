-- Applied via MCP. See live mode anti-cheat strategy.

drop policy if exists "open_all" on public.answers;
create policy "answers_select" on public.answers for select using (true);
create policy "answers_insert" on public.answers for insert with check (
  correct is null and points = 0
);
create policy "answers_delete" on public.answers for delete using (true);
-- No update policy => only service_role can update correct/points.

create or replace function public.generate_session_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  attempts int := 0;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    perform 1 from public.sessions where sessions.code = generate_session_code.code and status <> 'ended';
    if not found then return code; end if;
    attempts := attempts + 1;
    if attempts > 50 then raise exception 'could not generate unique code'; end if;
  end loop;
end $$;

alter table public.sessions replica identity full;
alter table public.players replica identity full;
alter table public.answers replica identity full;
