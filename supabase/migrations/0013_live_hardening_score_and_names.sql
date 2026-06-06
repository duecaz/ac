-- 0013_live_hardening_score_and_names.sql
-- Robustez LIVE. Aplicar vía MCP / Supabase CLI (no se puede testear en Node).
--
-- (1) Score atómico: settle-item hacía read-modify-write de players.score en JS
--     (SELECT score → +delta → UPDATE), con riesgo de carrera entre settles
--     concurrentes. Esta función lo vuelve un único UPDATE atómico.
-- (2) Validación de nombre en servidor: el cliente ya filtra apodos
--     (core/nicknameFilter.js), pero un cliente modificado podía insertar
--     cualquier name. Este trigger no duplica la blocklist: bloquea el abuso
--     estructural (vacío, demasiado largo, caracteres de control que romperían
--     la pantalla del aula). La blocklist de insultos sigue en el cliente
--     (defensa en profundidad).

-- (1) Incremento atómico de puntuación.
create or replace function public.increment_player_score(p_player_id uuid, p_delta int)
returns int
language sql
security definer
set search_path = public
as $$
  update public.players
     set score = coalesce(score, 0) + p_delta
   where id = p_player_id
  returning score;
$$;

grant execute on function public.increment_player_score(uuid, int) to service_role;

-- (2) Validación básica de nombre (insert + cambios de name).
create or replace function public.validate_player_name()
returns trigger
language plpgsql
as $$
begin
  new.name := btrim(new.name);
  if char_length(new.name) < 2 then
    raise exception 'NAME_TOO_SHORT' using errcode = 'check_violation';
  end if;
  if char_length(new.name) > 40 then
    raise exception 'NAME_TOO_LONG' using errcode = 'check_violation';
  end if;
  if new.name ~ '[\x00-\x1F\x7F]' then
    raise exception 'NAME_INVALID_CHARS' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists players_name_validate on public.players;
create trigger players_name_validate
  before insert or update of name on public.players
  for each row execute function public.validate_player_name();
