// Política de autenticación de PocketBase en UN SOLO sitio. Antes cada adaptador
// (remoteStore, realtime, assignments, reports) tenía su propia copia de "cómo
// hablar con PB", y solo UNO firmaba con el token del profe → las reglas por-autor
// no se podían activar sin romper live/tareas/reportes. Aquí vive la firma:
//
//   - Si hay sesión de profe (getAuthToken), añade `Authorization` → las escrituras
//     del PROFE quedan autenticadas (habilita reglas host-only en el servidor).
//   - Si el token está CADUCO y PB responde 401/403, reintenta SIN auth (fallback
//     anónimo) para no romper lo que hoy funciona con reglas públicas. Cuando el
//     usuario endurezca las reglas, ese reintento también fallará y el error se
//     propaga (el profe verá que debe volver a entrar) — que es lo correcto.
//   - El ALUMNO es anónimo (sin token) → getAuthToken() = null → va sin firmar,
//     exactamente como hoy. NO-OP para alumnos.
//
// Devuelve la Response CRUDA: cada adaptador conserva su parseo/reintento/timeout.
import { getAuthToken } from './auth.js';
import { PB_URL } from '../pocketbase.config.js';
import { clock } from './clock.js';
import { noteServerDate } from './serverNow.js';

export async function signedFetch(url, opts = {}) {
  const { headers: extra, ...rest } = opts;
  const base = {};
  // Content-Type solo con cuerpo JSON (POST/PATCH); en GET/DELETE, PocketBase da 400.
  if (rest.body != null && typeof rest.body === 'string') base['Content-Type'] = 'application/json';
  if (extra) Object.assign(base, extra);
  const run = (withAuth) => {
    const headers = { ...base };
    const token = withAuth ? getAuthToken() : null;
    if (token) headers['Authorization'] = token;
    return fetch(url, { method: rest.method || 'GET', ...rest, headers });
  };
  const enviadoMs = clock.now();
  let r = await run(true);
  if ((r.status === 401 || r.status === 403) && getAuthToken()) r = await run(false);
  // §22-5 · LA HORA COMÚN: cada respuesta de PocketBase trae su cabecera `Date`.
  // Es hora de SERVIDOR gratis, y esta es la puerta por la que pasa todo el
  // tráfico PB, así que el desfase de este aparato se re-mide solo, sin que
  // ningún llamador tenga que acordarse (core/serverNow.js).
  try { noteServerDate(r.headers?.get?.('Date'), { enviadoMs, recibidoMs: clock.now() }); }
  catch { /* best-effort: sin cabecera legible el desfase se queda como estaba (0 = como antes) */ }
  return r;
}

// ── EL wrapper JSON de PocketBase, UNA vez (ley de datos §21) ────────────────
// Había SIETE copias de "signedFetch/fetch + parsear JSON + dar forma al error"
// (likes, reports, teachers y los 3 adaptadores; auth.js es la séptima y se
// queda: es el DUEÑO del token y pbHttp importa de él — usarlo aquí sería un
// ciclo). Todas las demás llaman a esto.
//
// Forma del error, ÚNICA para todos los llamadores:
//   { status, pb }  — pb = cuerpo JSON del servidor (message, data por campo).
// Un cuerpo no-JSON (proxy, portal cautivo, política de red) también sale como
// error PocketBase con `pb.raw`, nunca como SyntaxError opaco de r.json().
// `opts` pasa entero a signedFetch → `signal` (timeout del caller) funciona.
export async function pbJson(path, opts = {}) {
  const r = await signedFetch(`${PB_URL}${path}`, opts);
  if (r.status === 204) return null;
  const text = await r.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); }
    catch {
      throw Object.assign(
        new Error(`PocketBase error ${r.status}: respuesta no-JSON`),
        { status: r.status, pb: { raw: text.slice(0, 200) } }
      );
    }
  }
  if (!r.ok) throw Object.assign(
    new Error(body?.message || `PocketBase error ${r.status}`),
    { status: r.status, pb: body }
  );
  return body;
}
