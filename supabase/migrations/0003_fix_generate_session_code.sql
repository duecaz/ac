-- Fix: in 0002, local var `code` collided with the qualified reference
-- generate_session_code.code (which would only be valid for a parameter,
-- not a declared local). Rename to new_code.

create or replace function public.generate_session_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  attempts int := 0;
begin
  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    perform 1 from public.sessions s where s.code = new_code and s.status <> 'ended';
    if not found then return new_code; end if;
    attempts := attempts + 1;
    if attempts > 50 then raise exception 'could not generate unique code'; end if;
  end loop;
end $$;
