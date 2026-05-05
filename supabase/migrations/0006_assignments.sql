-- Applied via MCP. Async assignments.

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  activity_id text references public.activities(id),
  activity_snap jsonb not null,
  author_id uuid,
  title text,
  due_at timestamptz,
  max_attempts int not null default 1,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);
create index if not exists assignments_author_idx on public.assignments(author_id);
create index if not exists assignments_activity_idx on public.assignments(activity_id);

alter table public.assignments enable row level security;
create policy "open_all" on public.assignments for all using (true) with check (true);

alter table public.results add column if not exists assignment_id uuid references public.assignments(id);
create index if not exists results_assignment_idx on public.results(assignment_id);

create or replace function public.generate_assignment_code()
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
    perform 1 from public.assignments a where a.code = new_code;
    if not found then return new_code; end if;
    attempts := attempts + 1;
    if attempts > 50 then raise exception 'could not generate unique code'; end if;
  end loop;
end $$;
grant execute on function public.generate_assignment_code() to anon, authenticated;
