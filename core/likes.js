// ❤ Likes de la biblioteca pública (S2). Una fila por (actividad, profe) en la
// colección PB `activity_likes`. Dar like exige sesión (profes); ver el conteo es
// público. La colección la crea el setup de #/admin (ver adminView.js).
import { PB_URL } from '../pocketbase.config.js';
import { pbEscape, pbFilterParam } from './pbFilter.js';
import { getAuthToken, getAuthUserId } from './auth.js';
import { tallyLikes } from './ranking.js';

const COLL = 'activity_likes';

async function pb(path, opts = {}) {
  const headers = {};
  if (opts.body) headers['Content-Type'] = 'application/json';
  const token = getAuthToken();
  if (token) headers['Authorization'] = token;
  const r = await fetch(`${PB_URL}${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  if (r.status === 204) return null;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data?.message || `Error ${r.status}`), { status: r.status });
  return data;
}

// Conteo de likes por actividad (para el ranking). Devuelve {} si la colección no
// existe todavía (setup no corrido) → degrada sin romper la portada.
export async function fetchLikeCounts() {
  try {
    const data = await pb(`/api/collections/${COLL}/records?perPage=500&fields=activity`);
    return tallyLikes(data?.items || []);
  } catch { return {}; }
}

// Ids de actividades que el profe actual ya marcó (para pintar el corazón lleno).
export async function fetchMyLikes() {
  const uid = getAuthUserId();
  if (!uid) return new Set();
  try {
    const data = await pb(`/api/collections/${COLL}/records?perPage=500&filter=${pbFilterParam(`user='${pbEscape(uid)}'`)}`);
    return new Set((data?.items || []).map(r => r.activity));
  } catch { return new Set(); }
}

// Alterna el like del profe actual sobre una actividad. Devuelve {liked} nuevo.
// Lanza si no hay sesión (el caller debe invitar a entrar).
export async function toggleLike(activityId) {
  const uid = getAuthUserId();
  if (!uid) throw new Error('Inicia sesión para votar.');
  // ¿Ya existe mi like?
  const existing = await pb(`/api/collections/${COLL}/records?perPage=1&filter=${pbFilterParam(`activity='${pbEscape(activityId)}' && user='${pbEscape(uid)}'`)}`);
  const row = existing?.items?.[0];
  if (row) {
    await pb(`/api/collections/${COLL}/records/${row.id}`, { method: 'DELETE' });
    return { liked: false };
  }
  await pb(`/api/collections/${COLL}/records`, { method: 'POST', body: JSON.stringify({ activity: activityId, user: uid }) });
  return { liked: true };
}
