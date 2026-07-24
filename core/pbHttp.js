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
  let r = await run(true);
  if ((r.status === 401 || r.status === 403) && getAuthToken()) r = await run(false);
  return r;
}
