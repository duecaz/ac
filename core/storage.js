import { getRemoteStore } from '../adapters/index.js';
import { migrate, normalize } from './migrate.js';
import { mergeRemote } from './storageMerge.js';

const LEGACY_KEY = 'ww.activities';
let _userId = 'guest';

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

export async function getRemote(id) {
  const rs = await getRemoteStore();
  const data = await rs.getActivity(id);
  return data ? migrate(data) : null;
}

// Saves locally immediately; generates preview then saves to remote in one call.
// preview_url is a compact data URL stored inside the activity data itself —
// no separate file upload needed, no CORS/auth issues, syncs to PB automatically.
export function save(activity) {
  const a = normalize({ ...activity, updatedAt: new Date().toISOString() });
  delete a._unsynced;
  const map = readLS();
  map[a.id] = a;
  writeLS(map);
  const remote = remoteSaveWithPreview(a);
  remote.then(() => {
    const m = readLS();
    if (m[a.id]?._unsynced) { delete m[a.id]._unsynced; writeLS(m); }
  }).catch(err => {
    console.warn('[storage] remote save failed:', err.message);
    const m = readLS();
    if (m[a.id]) { m[a.id]._unsynced = true; writeLS(m); }
  });
  return { activity: a, remote };
}

async function remoteSaveWithPreview(a) {
  let toSave = a;
  if (typeof document !== 'undefined') {
    try {
      const { generatePreview } = await import('./preview.js');
      const blob = await generatePreview(a);
      if (blob) {
        const url = await new Promise(res => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = () => res(null);
          r.readAsDataURL(blob);
        });
        if (url) {
          const m = readLS();
          if (m[a.id]) { m[a.id].preview_url = url; writeLS(m); }
          toSave = { ...a, preview_url: url };
        }
      }
    } catch { /* preview failed — save without it */ }
  }
  const rs = await getRemoteStore();
  await rs.saveActivity(toSave);
}

export async function retryUnsynced() {
  const map = readLS();
  const pending = Object.values(map).filter(a => a._unsynced);
  let ok = 0;
  for (const a of pending) {
    try { await remoteSaveWithPreview(a); delete a._unsynced; ok++; }
    catch { /* keep flag */ }
  }
  writeLS(map);
  return { tried: pending.length, ok };
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { retryUnsynced().catch(() => {}); });
}

export function setPreviewUrl(id, url) {
  const m = readLS();
  if (m[id]) { m[id].preview_url = url; writeLS(m); }
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
