import { getRemoteStore } from '../adapters/index.js';
import { migrate, normalize } from './migrate.js';
import { mergeRemote } from './storageMerge.js';
import { lsGet, lsSet } from './ls.js';
import { getAuthUserId, getAuthName } from './auth.js';
import { getProfile } from './profile.js';

const LEGACY_KEY = 'ww.activities';
const TOMBSTONE_KEY = 'ww.tombstones';   // { [id]: ISOString } — borrados pendientes de confirmar en remoto
const CLAIM_FLAG = 'ww.activities.claimed'; // marca global: el primer profe del navegador ya adoptó las anónimas
let _userId = 'guest';

// Almacén POR USUARIO (S1.2): "guest" (sin login) usa la clave legacy — así un
// usuario que aún NO configuró Google sigue viendo sus actividades intactas. Un
// profe logueado usa `ww.activities.<googleId>`, aislado de otros profes que
// compartan el navegador. Los tombstones van igual (por usuario).
function currentKey() { return _userId === 'guest' ? LEGACY_KEY : `${LEGACY_KEY}.${_userId}`; }
function tombKey()    { return _userId === 'guest' ? TOMBSTONE_KEY : `${TOMBSTONE_KEY}.${_userId}`; }

// ── Tombstones (P1-1): evitan que una actividad borrada resucite vía sync ─────
function readTombstones() {
  try { return JSON.parse(localStorage.getItem(tombKey()) || '{}'); }
  catch { return {}; }
}
function writeTombstones(t) { return lsSet(tombKey(), JSON.stringify(t)); }
function addTombstone(id) { const t = readTombstones(); t[id] = new Date().toISOString(); writeTombstones(t); }
function clearTombstone(id) { const t = readTombstones(); if (t[id]) { delete t[id]; writeTombstones(t); } }
export function tombstoneSet() { return new Set(Object.keys(readTombstones())); }

export function setStorageUser(userId) { _userId = userId || 'guest'; }
export function currentStorageUser() { return _userId; }

export function hasClaimed() { try { return !!localStorage.getItem(CLAIM_FLAG); } catch { return false; } }

// Claim al primer login (S1.3): adopta las actividades anónimas que ya viven en el
// navegador (clave legacy) para el profe que entra — les asigna dueño al re-subir
// (marca _unsynced → retryUnsynced las sube y remoteStore firma owner=googleId).
// Es GLOBAL y una sola vez: el PRIMER profe del navegador se queda las anónimas;
// después la clave legacy queda vacía. Requiere que _userId ya sea el del profe.
export function claimGuestActivities(userId) {
  if (!userId || userId === 'guest' || hasClaimed()) return { claimed: 0 };
  let legacy = {};
  try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}'); } catch {}
  const ids = Object.keys(legacy).filter(id => legacy[id]);
  if (!ids.length) { try { localStorage.setItem(CLAIM_FLAG, new Date().toISOString()); } catch {} return { claimed: 0 }; }
  const prev = _userId;
  setStorageUser(userId);
  const userMap = readLS();
  for (const id of ids) {
    // No pisar una versión más nueva ya presente en la clave del usuario.
    if (userMap[id] && (userMap[id].updatedAt || '') >= (legacy[id].updatedAt || '')) continue;
    userMap[id] = { ...legacy[id], _unsynced: true };
  }
  const okWrite = writeLS(userMap);
  setStorageUser(prev);
  if (!okWrite) return { claimed: 0, error: 'quota' }; // sin escribir → NO marcar reclamado (reintentará)
  try { localStorage.setItem(LEGACY_KEY, '{}'); localStorage.setItem(CLAIM_FLAG, new Date().toISOString()); } catch {}
  return { claimed: ids.length };
}

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
// keepUpdatedAt: conserva el updatedAt de la actividad (import 'preserve', P1-5)
// en vez de re-sellarlo con ahora; así un backup VIEJO no gana el LWW.
export function save(activity, { keepUpdatedAt = false } = {}) {
  const stamp = keepUpdatedAt && activity.updatedAt ? activity.updatedAt : new Date().toISOString();
  const a = normalize({ ...activity, updatedAt: stamp });
  // Sella el AUTOR (denormalizado en el JSON) la primera vez que un profe logueado
  // guarda: sirve para mostrar "por X" en las tarjetas públicas y enlazar a su
  // perfil (#/autor/:id). Solo se sella si aún no tiene autor (los forks lo
  // resetean → toman al que duplica). El `owner` de PB (permisos) lo pone remoteStore.
  const uid = getAuthUserId();
  if (uid && (!a.author?.id || a.author.id === uid)) {
    // Denormaliza el perfil público del profe (nombre + colegio + frase + avatar de
    // Google) dentro de author, para que la página del autor lo muestre sin leer la
    // colección users (privada). Al primera firma se fija signedAt; si el autor ya
    // soy yo, se REFRESCA (nombre/colegio/frase/avatar) por si cambié algo.
    const prof = getProfile(uid);
    const pick = (v, prev) => (v !== undefined ? v : (prev || '')); // permite vaciar
    a.author = {
      ...(a.author || {}),
      id: uid,
      name: getAuthName() || a.author?.name || 'Profe',
      school: pick(prof.school, a.author?.school),
      bio: pick(prof.bio, a.author?.bio),
      avatar: pick(prof.avatar, a.author?.avatar),
      signedAt: a.author?.signedAt || stamp,
    };
  }
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
  window.addEventListener('online', () => {
    retryUnsynced().catch(() => {});
    retryTombstones().catch(() => {}); // P1-1: reintenta borrados pendientes al volver la red
  });
}

export function remove(id) {
  const map = readLS();
  delete map[id];
  writeLS(map);
  // Tumba el id ANTES del DELETE remoto: si este falla (offline/blip/cierre de
  // pestaña) la fila sigue viva en PB, pero el tombstone impide que el próximo
  // sync la resucite, y retryTombstones reintenta el borrado. Se limpia al
  // confirmar el DELETE (o si PB responde 404 = ya no existe).
  addTombstone(id);
  const remote = remoteDelete(id)
    .then(() => clearTombstone(id))
    .catch(err => {
      if (err?.status === 404) { clearTombstone(id); return; } // ya no existe en remoto
      console.warn('[storage] remote delete failed (se reintentará):', err.message);
    });
  return remote;
}

async function remoteDelete(id) {
  const rs = await getRemoteStore();
  await rs.deleteActivity(id);
}

// Reintenta los borrados pendientes (tombstones). Se llama al recuperar red y al
// sincronizar. Un 404 remoto = la fila ya no existe → limpia el tombstone.
export async function retryTombstones() {
  const ids = Object.keys(readTombstones());
  for (const id of ids) {
    try { await remoteDelete(id); clearTombstone(id); }
    catch (err) { if (err?.status === 404) clearTombstone(id); /* si no, se deja para el próximo intento */ }
  }
  return { pending: ids.length };
}

export async function sync() {
  // Guest (sin login): SOLO local, sin remoto (S1.4). En el modelo de biblioteca
  // pública, "Mis actividades" es del profe logueado; la portada/explore consultan
  // lo público aparte. Sin este guard, el sync traería la biblioteca ENTERA aquí.
  if (_userId === 'guest') return list();
  const rs = await getRemoteStore();
  // Antes de mergear, reintenta los borrados pendientes para que no vuelvan.
  await retryTombstones().catch(() => {});
  // Solo las del profe (filtra por owner) → "Mis actividades" no se llena con las
  // de todo el mundo cuando la biblioteca es pública.
  const rows = await rs.listActivities(_userId);
  writeLS(mergeRemote(readLS(), rows, migrate, tombstoneSet()));
  return list();
}
