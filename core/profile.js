// Perfil público del profe (nombre, colegio, frase, avatar) — colección PB
// `profiles`, SEPARADA de `users` (que es privada por el email). Lectura pública
// (la página del autor la muestra a cualquiera); escritura solo del dueño. Una
// fila por profe: su id de fila = su id de usuario (upsert trivial). El avatar se
// captura del login con Google. Ver docs/handoff-acceso-docente.md (perfil).
import { PB_URL } from '../pocketbase.config.js';
import { getAuthToken } from './auth.js';
import { lsSet } from './ls.js';

const COLL = 'profiles';
const LKEY = (uid) => `ww.profile.${uid}`;
const EMPTY = { name: '', school: '', bio: '', avatar: '' };

// Cache local (pintado instantáneo + respaldo offline). No es la fuente de verdad.
export function getLocalProfile(uid) {
  if (!uid) return { ...EMPTY };
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(LKEY(uid)) || '{}') }; } catch { return { ...EMPTY }; }
}
export function setLocalProfile(uid, prof) {
  if (!uid) return { ...EMPTY };
  const next = { ...getLocalProfile(uid), ...prof };
  lsSet(LKEY(uid), JSON.stringify(next));
  return next;
}

// Lee el perfil público de un profe (cualquiera). {} si no tiene o la colección no
// existe todavía (degrada sin romper). La fila tiene id = ownerId.
export async function fetchProfile(ownerId) {
  if (!ownerId) return { ...EMPTY };
  try {
    const r = await fetch(`${PB_URL}/api/collections/${COLL}/records/${ownerId}`);
    if (!r.ok) return { ...EMPTY };
    const d = await r.json().catch(() => ({}));
    return { name: d.name || '', school: d.school || '', bio: d.bio || '', avatar: d.avatar || '' };
  } catch { return { ...EMPTY }; }
}

// Crea/actualiza mi perfil. Hace MERGE con lo que ya haya en el servidor para no
// pisar campos que este `patch` no trae (p.ej. el login solo aporta nombre+avatar
// y no debe borrar el colegio/frase). Firma con el token del profe.
export async function saveProfile(uid, patch) {
  if (!uid) return { ...EMPTY };
  const clean = Object.fromEntries(Object.entries(patch || {}).filter(([, v]) => v !== undefined));
  const remote = await fetchProfile(uid);
  const merged = { ...EMPTY, ...remote, ...clean };
  setLocalProfile(uid, merged);
  const token = getAuthToken();
  if (!token) return merged; // sin sesión no se sincroniza (queda en local)
  const headers = { 'Content-Type': 'application/json', Authorization: token };
  const bodyObj = { owner: uid, ...merged };
  let r = await fetch(`${PB_URL}/api/collections/${COLL}/records/${uid}`, {
    method: 'PATCH', headers, body: JSON.stringify(bodyObj),
  });
  if (r.status === 404) {
    r = await fetch(`${PB_URL}/api/collections/${COLL}/records`, {
      method: 'POST', headers, body: JSON.stringify({ id: uid, ...bodyObj }),
    });
  }
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d?.message || `Error ${r.status}`); }
  return merged;
}
