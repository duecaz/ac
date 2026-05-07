-- Applied via MCP. Rollback to inline-content architecture: drop the
-- vestigial pack table + FK column added in 0011 (which was reverted in
-- the codebase).
alter table public.activities drop column if exists content_pack_id;
drop table if exists public.content_packs cascade;
