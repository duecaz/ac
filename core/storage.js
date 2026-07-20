import { getRemoteStore } from '../adapters/index.js';
import { migrate, normalize } from './migrate.js';
import { mergeRemote } from './storageMerge.js';
import { lsGet, lsSet } from './ls.js';

const LEGACY_KEY = 'ww.activities';
let _userId = 'guest';

export function setStorageUser(userId) { _userId = userId || 'guest'; }

function currentKey() { return LEGACY_KEY; }

function readLS() {
  try { return JSON.parse(localStorage.getItem(currentKey()) || '{}'); }
  catch { return {}; }
}
// Devuelve false si la escritura falló (cuota llena / almacenamiento bloqueado).
// lsSet ya emite `ww:storage-full` para el aviso global; el booleano deja que el
// caller NO finja éxito (P1-2).
function writeLS(map) { return lsSet(currentKey(), JSON.stringify(map)); }

export function list() {
  const map = readLS();
  return Object.values(map).filter(Boolean).map(migrate).sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''));
}

export function get(id) {
  const map = readLS();
  return map[id] ? migrate(map[id]) : null;
}

export async function getRemote(id) {
  const rs = await getRemoteStore();
  const data = await rs.getActivity(id);
  return data ? migrate(data) : null;
}

// Saves locally immediately and to remote in the background. The home preview
// is rendered live from the activity content (see core/activityThumb.js), so
// no image generation/upload happens here.
export function save(activity) {
  const a = normalize({ ...activity, updatedAt: new Date().toISOString() });
  // _unsynced OPTIMISTA (P1-3): marca pendiente ANTES del remoto. Si la pestaña
  // se cierra con el PATCH en vuelo, el registro queda flagueado y retryUnsynced
  // lo recupera; antes se borraba el flag por adelantado y la edición divergía
  // en silencio sin reintento. Se limpia solo tras confirmar el remoto.
  a._unsynced = true;
  const map = readLS();
  map[a.id] = a;
  const persisted = writeLS(map);   // P1-2: no fingir éxito si la cuota está llena
  const remote = remoteSave(a);
  remote.then(() => {
    const m = readLS();
    if (m[a.id]?._unsynced) { delete m[a.id]._unsynced; writeLS(m); }
  }).catch(err => {
    console.warn('[storage] remote save failed:', err.message);
    // El flag _unsynced ya está puesto; retryUnsynced / el evento 'online' lo tomarán.
  });
  return { activity: a, remote, persisted };
}

async function remoteSave(a) {
  const rs = await getRemoteStore();
  await rs.saveActivity(a);
}

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

async function remoteDelete(id) {
  const rs = await getRemoteStore();
  await rs.deleteActivity(id);
}

export async function sync() {
  const rs = await getRemoteStore();
  const rows = await rs.listActivities();
  writeLS(mergeRemote(readLS(), rows, migrate));
  return list();
}
