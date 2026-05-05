// Storage layer: localStorage is the source of truth for read; Supabase syncs
// in background. list/get are sync. save returns a promise; remote errors
// are surfaced.
//
// LocalStorage is scoped per user via the cached _userId (read once at boot
// after ensureAuth). When the user signs out/in, the active key switches.
// Old unscoped key 'ww.activities' is migrated on first scoped access.
import { getClient } from './supabase.js';
import { migrate, normalize } from './migrate.js';

const LEGACY_KEY = 'ww.activities';
let _userId = 'guest';
let _migratedLegacy = false;

export function setStorageUser(userId) {
  _userId = userId || 'guest';
  // One-time legacy migration: if a user-scoped bucket doesn't exist yet,
  // fold the unscoped legacy bucket into it (so existing pre-1.3 work survives).
  if (!_migratedLegacy && !localStorage.getItem(currentKey()) && localStorage.getItem(LEGACY_KEY)) {
    localStorage.setItem(currentKey(), localStorage.getItem(LEGACY_KEY));
  }
  _migratedLegacy = true;
}

function currentKey() { return `ww.activities.${_userId}`; }

function readLS() {
  try { return JSON.parse(localStorage.getItem(currentKey()) || '{}'); }
  catch { return {}; }
}
function writeLS(map) { localStorage.setItem(currentKey(), JSON.stringify(map)); }

export function list() {
  const map = readLS();
  return Object.values(map).map(migrate).sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''));
}

export function get(id) {
  const map = readLS();
  return map[id] ? migrate(map[id]) : null;
}

// Saves locally immediately and to remote in the background.
// Returns { activity, remote } where `remote` is a Promise that resolves
// when the remote upsert completes, or rejects with the error (so callers
// can surface it). Callers can ignore `remote` for fire-and-forget.
export function save(activity) {
  const a = normalize({ ...activity, updatedAt: new Date().toISOString() });
  const map = readLS();
  map[a.id] = a;
  writeLS(map);
  const remote = remoteSave(a);
  // Always attach a default rejection handler so we don't get unhandled
  // rejection warnings if a caller drops the promise.
  remote.catch(err => console.warn('[storage] remote save failed:', err.message));
  return { activity: a, remote };
}

export function remove(id) {
  const map = readLS();
  delete map[id];
  writeLS(map);
  const remote = remoteDelete(id);
  remote.catch(err => console.warn('[storage] remote delete failed:', err.message));
  return remote;
}

async function remoteSave(a) {
  const sb = await getClient();
  const { data: { user } } = await sb.auth.getUser();
  const authorId = a.author?.id || user?.id || null;
  // Stamp author info in the JSONB too so it round-trips.
  if (authorId && !a.author?.id) a.author = { ...(a.author || {}), id: authorId, signedAt: new Date().toISOString() };
  const { error } = await sb.from('activities').upsert({
    id: a.id, data: a,
    visibility: a.visibility,
    author_id: authorId,
    tags: a.tags || [],
    language: a.language || 'es'
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
  const { data: { user } } = await sb.auth.getUser();
  // Pull rows the user owns. Public/explore is fetched separately by /explore.
  let q = sb.from('activities').select('id, data, updated_at').order('updated_at', { ascending: false });
  if (user) q = q.or(`author_id.eq.${user.id},author_id.is.null`);
  const { data, error } = await q;
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
