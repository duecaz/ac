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

// ── Rondas de PRUEBA del equipo (QA, test.html) ─────────────────────────────
// Mismo dueño y misma colección que los reportes de contenido (§21: no se abre
// una colección nueva para una herramienta interna): la fila se distingue por
// el prefijo `qa:` en `activity` y lleva el informe COMPLETO en texto plano en
// `reason` — el mismo texto que genera el botón «Generar informe», para que el
// admin lo lea (o lo pegue) tal cual. Crear exige sesión (regla AUTH de
// `reports`); test.html lo dice ANTES de dejar pulsar Enviar.
export const QA_PREFIX = 'qa:';
export const esRondaQa = (r) => String(r?.activity || '').startsWith(QA_PREFIX);

export async function submitQaRound(rondaId, texto) {
  const by = getAuthUserId();
  if (!by) throw new Error('Inicia sesión para enviar.');
  await pb(`/api/collections/${COLL}/records`, {
    method: 'POST',
    // 16000: un informe de ~20 pruebas con notas ronda los 3-4 KB; el tope es
    // holgura, no meta — si alguna vez se corta, se corta el final del contexto.
    body: JSON.stringify({ activity: `${QA_PREFIX}${rondaId || 'ronda'}`, by, reason: String(texto || '').slice(0, 16000) }),
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
