// Tracks consecutive-correct counters per (sessionId, userId). The data is
// scoped per session and cleared when the session ends. Exposed as a tiny
// imperative helper that any renderer can call.
//
// Display only. The server-side bonus (when live.streakBonus = true) is
// computed independently in the Edge Function from the answers history,
// so this client state is purely for UX.

const KEY = 'ww.streaks';

function load() { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { return {}; } }
function save(map) { sessionStorage.setItem(KEY, JSON.stringify(map)); }

function k(sessionId, userId) { return `${sessionId || 'solo'}::${userId || 'self'}`; }

export function get(sessionId, userId) {
  return load()[k(sessionId, userId)] || 0;
}

export function bump(sessionId, userId, correct) {
  const map = load();
  const key = k(sessionId, userId);
  map[key] = correct ? (map[key] || 0) + 1 : 0;
  save(map);
  return map[key];
}

export function reset(sessionId, userId) {
  const map = load();
  delete map[k(sessionId, userId)];
  save(map);
}

export function clearAll() { sessionStorage.removeItem(KEY); }
