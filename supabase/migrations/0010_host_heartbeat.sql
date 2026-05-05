-- Applied via MCP. Host heartbeat for zombie session cleanup.

alter table public.sessions add column if not exists host_seen_at timestamptz default now();
create index if not exists sessions_host_seen_idx on public.sessions(host_seen_at) where status not in ('ended');

create or replace function public.ping_host_session(p_session_id uuid)
returns void language sql security invoker set search_path = public as $$
  update public.sessions set host_seen_at = now()
  where id = p_session_id and host_id = auth.uid();
$$;
grant execute on function public.ping_host_session(uuid) to authenticated, anon;

create or replace function public.cleanup_zombie_sessions()
returns int language plpgsql security definer set search_path = public as $$
declare
  c int;
begin
  update public.sessions
    set status = 'ended', phase = 'ended', ended_at = now()
    where status not in ('ended')
      and host_seen_at < now() - interval '5 minutes';
  get diagnostics c = row_count;
  return c;
end $$;
revoke execute on function public.cleanup_zombie_sessions() from public, anon, authenticated;
