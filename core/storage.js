// Storage layer: localStorage is the source of truth for read; Supabase syncs
// in background. list/get are sync. save/delete are fire-and-forget remote.
import { getClient } from './supabase.js';
import { migrate, normalize } from './migrate.js';

const LS_KEY = 'ww.activities';

function readLS() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}
function writeLS(map) { localStorage.setItem(LS_KEY, JSON.stringify(map)); }

export function list() {
  const map = readLS();
  return Object.values(map).map(migrate).sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''));
}

export function get(id) {
  const map = readLS();
  return map[id] ? migrate(map[id]) : null;
}

export function save(activity) {
  const a = normalize({ ...activity, updatedAt: new Date().toISOString() });
  const map = readLS();
  map[a.id] = a;
  writeLS(map);
  // Fire-and-forget remote sync.
  remoteSave(a).catch(err => console.warn('[storage] remote save failed:', err.message));
  return a;
}

export function remove(id) {
  const map = readLS();
  delete map[id];
  writeLS(map);
  remoteDelete(id).catch(err => console.warn('[storage] remote delete failed:', err.message));
}

async function remoteSave(a) {
  const sb = await getClient();
  const { error } = await sb.from('activities').upsert({
    id: a.id, data: a, visibility: a.visibility, author_id: a.author?.id || null
  });
  if (error) throw error;
}

async function remoteDelete(id) {
  const sb = await getClient();
  const { error } = await sb.from('activities').delete().eq('id', id);
  if (error) throw error;
}

// Pull all activities from Supabase, merging into localStorage.
// Last-write-wins by updatedAt.
export async function sync() {
  const sb = await getClient();
  const { data, error } = await sb.from('activities').select('id, data, updated_at').order('updated_at', { ascending: false });
  if (error) throw error;
  const map = readLS();
  for (const row of data || []) {
    const remote = migrate(row.data || {});
    const local = map[row.id];
    if (!local || (remote.updatedAt || '') >= (local.updatedAt || '')) {
      map[row.id] = remote;
    }
  }
  writeLS(map);
  return list();
}
