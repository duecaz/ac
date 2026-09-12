// Tracks consecutive-correct counters per (sessionId, userId). The data is
// scoped per session and cleared when the session ends. Exposed as a tiny
// imperative helper that any renderer can call.
//
// Display only (el 🔥 que ve el alumno): este contador NO puntúa. El bonus por
// racha (`live.streakBonus`) lo calculaba una Edge Function de Supabase, y
// Supabase se retiró — hoy es deuda abierta en CLAUDE.md («Bonus por racha»):
// falta decidir dónde se calcula. Si vuelve, el veredicto será del host (§22),
// nunca de este estado de cliente.

import { ssGet, ssSet, objetoDe } from './ls.js';

const KEY = 'ww.streaks';

/** @returns {Record<string, number>} */
function load() { return /** @type {Record<string, number>} */ (objetoDe(ssGet(KEY))); }
/** @param {Record<string, number>} map @returns {void} */
function save(map) { ssSet(KEY, JSON.stringify(map)); }

/** @param {string|null|undefined} sessionId @param {string|null|undefined} userId @returns {string} */
function k(sessionId, userId) { return `${sessionId || 'solo'}::${userId || 'self'}`; }

/** @param {string|null|undefined} sessionId @param {string|null|undefined} userId @returns {number} */
export function get(sessionId, userId) {
  return load()[k(sessionId, userId)] || 0;
}

/**
 * @param {string|null|undefined} sessionId
 * @param {string|null|undefined} userId
 * @param {boolean} correct
 * @returns {number}
 */
export function bump(sessionId, userId, correct) {
  const map = load();
  const key = k(sessionId, userId);
  map[key] = correct ? (map[key] || 0) + 1 : 0;
  save(map);
  return map[key];
}

/** @param {string|null|undefined} sessionId @param {string|null|undefined} userId @returns {void} */
export function reset(sessionId, userId) {
  const map = load();
  delete map[k(sessionId, userId)];
  save(map);
}

