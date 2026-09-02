// Safe localStorage/sessionStorage wrappers — ÚNICO punto de contacto con el
// almacén del navegador (§21 aplicada al almacén: cada clave `ww.*` tiene un
// dueño en LS_OWNERS, core/normsCheck.js, y se accede SOLO por aquí; la regla
// `almacen-crudo` rompe CI si algún otro fichero nombra `localStorage.` o
// `sessionStorage.` directamente). Bare calls throw in private browsing
// (Firefox/Safari) and strict storage sandboxes. All reads return the
// fallback on error; writes return false on quota exceeded and dispatch a
// 'ww:storage-full' event so the UI layer can warn the user.
//
// CUÁL DE LOS DOS: localStorage (ls*) sobrevive a cerrar la pestaña — es lo
// que hay que RECORDAR (la biblioteca de actividades, la sesión de profe, el
// mute). sessionStorage (ss*) NO sobrevive a cerrar la pestaña — es lo que
// vale solo mientras dura ESTA visita: el token OAuth/Google/Classroom en
// vuelo, la fila de jugador de ESTA sala en vivo, la racha de ESTA partida, el
// flag de "ya recargué una vez" de esta sala. Cerrar la pestaña y volver a
// abrir la sala es, con razón, entrar de cero.
export function lsGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch { return fallback; }
}
export function lsSet(key, val) {
  try {
    localStorage.setItem(key, val);
    return true;
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      console.warn('[ls] localStorage quota exceeded — data not saved for key:', key);
      try { window.dispatchEvent(new CustomEvent('ww:storage-full', { detail: { key } })); } catch {}
    } else {
      console.warn('[ls] localStorage write failed:', e.message);
    }
    return false;
  }
}
export function lsDel(key) {
  try { localStorage.removeItem(key); } catch { }
}
export function ssGet(key, fallback = null) {
  try {
    const v = sessionStorage.getItem(key);
    return v === null ? fallback : v;
  } catch { return fallback; }
}
export function ssSet(key, val) {
  try {
    sessionStorage.setItem(key, val);
    return true;
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      console.warn('[ls] sessionStorage quota exceeded — data not saved for key:', key);
      try { window.dispatchEvent(new CustomEvent('ww:storage-full', { detail: { key } })); } catch {}
    } else {
      console.warn('[ls] sessionStorage write failed:', e.message);
    }
    return false;
  }
}
export function ssDel(key) {
  try { sessionStorage.removeItem(key); } catch { }
}
/** Lee una LISTA JSON con guard completo (parse roto o no-array ⇒ []). Era el
 *  mismo bloque try/parse/Array.isArray copiado en las TRES colas offline
 *  (respuestas en vivo · resultados · intentos de tarea) — el load-guard vive
 *  aquí una vez, junto a sus hermanos lsGet/lsSet. */
export function lsGetJsonArray(key) {
  try {
    const v = JSON.parse(lsGet(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
