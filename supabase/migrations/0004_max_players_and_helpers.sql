-- Applied via MCP. Enforce maxPlayers and add presence view.

create or replace function public.enforce_max_players()
returns trigger language plpgsql as $$
declare
  cap int;
  cur int;
begin
  select coalesce((s.activity_snap->'live'->>'maxPlayers')::int, 60)
    into cap from public.sessions s where s.id = new.session_id;
  select count(*) into cur from public.players where session_id = new.session_id;
  if cur >= cap then
    raise exception 'MAX_PLAYERS_REACHED' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists players_max on public.players;
create trigger players_max before insert on public.players
  for each row execute function public.enforce_max_players();

create or replace view public.players_active as
  select *, (now() - last_seen) < interval '30 seconds' as online
  from public.players;
