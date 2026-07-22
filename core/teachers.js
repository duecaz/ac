// Gestión de profesores (panel admin, U5). Listar usuarios, dar/quitar admin,
// y contar actividades por dueño. Todo exige token de admin: la listRule de
// `users` es admin-only, así que sin sesión admin estas llamadas devuelven vacío
// o 403 (degradan sin romper el panel). Ver docs/handoff-acceso-docente.md U5.
import { PB_URL } from '../pocketbase.config.js';
import { getAuthToken } from './auth.js';

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

// Lista los usuarios (solo admin). Devuelve [] si no hay permiso (degrada).
export async function listTeachers() {
  try {
    const data = await pb('/api/collections/users/records?perPage=200&fields=id,name,email,role,created');
    return (data?.items || []).map(u => ({
      id: u.id, name: u.name || '', email: u.email || '', role: u.role || u.Role || '', created: u.created || '',
    }));
  } catch { return []; }
}

// Cambia el rol de un usuario. role='admin' concede moderación global; '' lo quita.
export async function setTeacherRole(id, role) {
  await pb(`/api/collections/users/records/${id}`, {
    method: 'PATCH', body: JSON.stringify({ role: role || '' }),
  });
  return { ok: true };
}

// Cuenta actividades por dueño (owner) — como admin, la listRule permite ver
// todas. Devuelve { [ownerId]: n }. {} si no hay permiso.
export async function countActivitiesByOwner() {
  try {
    const data = await pb('/api/collections/activities/records?perPage=500&fields=owner');
    const out = {};
    for (const row of (data?.items || [])) {
      const o = row.owner || '';
      if (o) out[o] = (out[o] || 0) + 1;
    }
    return out;
  } catch { return {}; }
}
