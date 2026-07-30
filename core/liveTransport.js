// LIVE transport facade. Views import these instead of core/transport/* directly,
// so the active backend (local | supabase) is chosen by getRealtime() and the
// call sites stay identical. Each call resolves the driver once (cached) and
// forwards. This is the seam that lets LIVE run fully local (no Supabase).
import { getRealtime } from '../adapters/index.js';

const call = (method) => async (...args) => {
  const rt = await getRealtime();
  if (typeof rt[method] !== 'function') throw new Error(`realtime backend no soporta "${method}"`);
  return rt[method](...args);
};

// Rooms
export const createRoom = call('createRoom');
export const findRoomByCode = call('findRoomByCode');
export const fetchSession = call('fetchSession');
export const fetchSessionKey = call('fetchSessionKey');
// Blob `state` entero (respaldo del informe post-partida del HOST). Las vistas
// jamás tocan la colección live_sessions directamente — ley de datos.
export const fetchSessionBlob = call('fetchSessionBlob');

// Host flow
export const startSession = call('startSession');
export const setSessionState = call('setSessionState');
export const endSession = call('endSession');
export const settleItem = call('settleItem');
export const listPlayers = call('listPlayers');
export const listAnswers = call('listAnswers');
export const submitRaceAttempt = call('submitRaceAttempt');
export const leaderboard = call('leaderboard');
export const kickPlayer = call('kickPlayer');
export const pingHost = call('pingHost');

// Student flow
export const joinSession = call('joinSession');
export const submitAnswer = call('submitAnswer');
export const getOwnAnswer = call('getOwnAnswer');
export const pingPresence = call('pingPresence');
// Continuous progress broadcast for live "board" templates (e.g. Ball Sort):
// unlike submitAnswer this UPSERTS the player's OWN row, so the host sees the
// board move-by-move. One row per player → no clobber.
export const submitProgress = call('submitProgress');
// Pregunta en Vivo: el alumno pide la palabra. Escribe SOLO el campo `ql` de la
// sala — nunca el blob de control (ley de confianza §22). Antes esto iba por
// `setSessionState`, lo que obligaba a dejar el blob escribible por cualquiera.
export const claimQuestion = call('claimQuestion');

// Realtime subscription. Returns (a promise resolving to) an unsubscribe fn.
export const subscribeRoom = call('subscribeRoom');

// Which concrete driver is active ('local' | 'pocketbase' | 'supabase'). The
// host view uses this to warn when Live has silently fallen back to the local
// (same-device only) driver — e.g. the PocketBase live_sessions collection is
// missing — so the teacher knows why remote students can't join.
export async function realtimeKind() {
  const rt = await getRealtime();
  return rt?.kind || 'unknown';
}
