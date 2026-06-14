// Storage layer: localStorage is the source of truth for read; Supabase syncs
// in background. list/get are sync. save returns a promise; remote errors
// are surfaced.
//
// Banco COMPARTIDO: la caché local ya NO se scopea por identidad — todas las
// sesiones ven el mismo banco (clave única 'ww.activities'). sync() lo repuebla
// desde la nube, así que limpiar la caché no pierde actividades.
import { getRemoteStore } from '../adapters/index.js';
import { migrate, normalize } from './migrate.js';
import { mergeRemote } from './storageMerge.js';

const LEGACY_KEY = 'ww.activities';
let _userId = 'guest';

// Firma conservada por compatibilidad con el boot; ya no afecta a la clave.
export function setStorageUser(userId) { _userId = userId || 'guest'; }

function currentKey() { return LEGACY_KEY; }

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

// Pull a single activity straight from Supabase by id. Used by the embed
// page where the visitor doesn't have the activity in localStorage. Returns
// null if not found or visibility is private (RLS hides it).
export async function getRemote(id) {
  const rs = await getRemoteStore();
  const data = await rs.getActivity(id);
  return data ? migrate(data) : null;
}

// Saves locally immediately and to remote in the background.
// On remote failure, marks the local copy with _unsynced=true so the UI
// can show a sync status. Returns { activity, remote }.
export function save(activity) {
  const a = normalize({ ...activity, updatedAt: new Date().toISOString() });
  // Optimistically clear stale flag.
  delete a._unsynced;
  const map = readLS();
  map[a.id] = a;
  writeLS(map);
  const remote = remoteSave(a);
  remote.then(() => {
    // Confirmed synced — make sure the flag is off (in case it was on before).
    const m = readLS();
    if (m[a.id]?._unsynced) { delete m[a.id]._unsynced; writeLS(m); }
  }).catch(err => {
    console.warn('[storage] remote save failed:', err.message);
    const m = readLS();
    if (m[a.id]) { m[a.id]._unsynced = true; writeLS(m); }
  });
  return { activity: a, remote };
}

// Retry pending unsynced rows. Call on online, on boot, on demand.
export async function retryUnsynced() {
  const map = readLS();
  const pending = Object.values(map).filter(a => a._unsynced);
  let ok = 0;
  for (const a of pending) {
    try { await remoteSave(a); delete a._unsynced; ok++; }
    catch { /* keep flag */ }
  }
  writeLS(map);
  return { tried: pending.length, ok };
}
// Auto-retry when network returns. Guarded so importing storage outside a
// browser (tests, non-DOM contexts) doesn't crash.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { retryUnsynced().catch(() => {}); });
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
  const rs = await getRemoteStore();
  await rs.saveActivity(a);
}

async function remoteDelete(id) {
  const rs = await getRemoteStore();
  await rs.deleteActivity(id);
}

// Pull all activities from the backend, merging into localStorage.
// Last-write-wins by updatedAt.
export async function sync() {
  const rs = await getRemoteStore();
  const rows = await rs.listActivities();
  writeLS(mergeRemote(readLS(), rows, migrate));
  return list();
}
