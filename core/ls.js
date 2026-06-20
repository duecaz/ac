// Safe localStorage wrappers. Bare localStorage calls throw in private
// browsing (Firefox/Safari) and strict storage sandboxes. All reads return
// the fallback on error; writes silently no-op.
export function lsGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch { return fallback; }
}
export function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch { }
}
export function lsDel(key) {
  try { localStorage.removeItem(key); } catch { }
}
