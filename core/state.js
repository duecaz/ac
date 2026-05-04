// Per-session ephemeral state (e.g. "current activity being edited").
const _state = {};
export const setState = (k, v) => { _state[k] = v; };
export const getState = (k) => _state[k];
export const clearState = (k) => { delete _state[k]; };

// Stable anonymous user id, persisted in localStorage. Used for player rejoin.
const ANON_KEY = 'ww.anonId';
export function getAnonId() {
  let v = localStorage.getItem(ANON_KEY);
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem(ANON_KEY, v);
  }
  return v;
}
