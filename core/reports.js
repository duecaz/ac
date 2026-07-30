// 🚩 Reportes de contenido de la biblioteca pública (S3). Un profe logueado puede
// reportar una actividad; solo el admin lista/borra. Colección PB `reports`
// {activity, by, reason} — la crea el setup de #/admin.
import { getAuthUserId } from './auth.js';
import { pbJson } from './pbHttp.js';

const COLL = 'reports';

// El wrapper JSON vive UNA vez en core/pbHttp.js (pbJson): firma con el token
// si lo hay y da a los errores la forma común { status, pb }.
const pb = (path, opts) => pbJson(path, opts);

// Crea un reporte (requiere sesión). `activity` = id de la actividad reportada.
export async function submitReport(activity, reason = '') {
  const by = getAuthUserId();
  if (!by) throw new Error('Inicia sesión para reportar.');
  await pb(`/api/collections/${COLL}/records`, {
    method: 'POST',
    body: JSON.stringify({ activity, by, reason: String(reason || '').slice(0, 500) }),
  });
  return { ok: true };
}

// Lista los reportes (solo admin — la regla PB lo respalda). Devuelve [] si falla.
export async function listReports() {
  try {
    // Sin sort=-created: la colección puede no tener el campo `created` (según cómo
    // se creó) y ese sort rompería la consulta. Orden por defecto de PB.
    const data = await pb(`/api/collections/${COLL}/records?perPage=200`);
    return data?.items || [];
  } catch { return []; }
}

export async function deleteReport(id) {
  await pb(`/api/collections/${COLL}/records/${id}`, { method: 'DELETE' });
  return { ok: true };
}
