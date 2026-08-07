// Safe localStorage wrappers. Bare localStorage calls throw in private
// browsing (Firefox/Safari) and strict storage sandboxes. All reads return
// the fallback on error; writes return false on quota exceeded and dispatch
// a 'ww:storage-full' event so the UI layer can warn the user.
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
