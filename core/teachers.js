// Gestión de profesores (panel admin, U5). Listar usuarios, dar/quitar admin,
// y contar actividades por dueño. Todo exige token de admin: la listRule de
// `users` es admin-only, así que sin sesión admin estas llamadas devuelven vacío
// o 403 (degradan sin romper el panel). Ver docs/handoff-acceso-docente.md U5.
import { pbJson } from './pbHttp.js';

// El wrapper JSON vive UNA vez en core/pbHttp.js (pbJson): firma con el token
// si lo hay y da a los errores la forma común { status, pb }.
const pb = (path, opts) => pbJson(path, opts);

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

// Cuenta actividades por dueño (owner) para el panel de Profesores. Este módulo
// es dueño de `users`, NO de `activities` (ley de datos §21): le pide el recuento
// al dueño de esa colección en vez de consultarla. Devuelve { [ownerId]: n }, y
// {} si no hay permiso.
export async function countActivitiesByOwner() {
  try {
    const { countActivitiesByOwner: countFromOwner } = await import('./storage.js');
    return Object.fromEntries(await countFromOwner());
  } catch { return {}; }
}
