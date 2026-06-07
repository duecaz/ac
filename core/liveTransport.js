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

// Host flow
export const startSession = call('startSession');
export const setSessionState = call('setSessionState');
export const endSession = call('endSession');
export const settleItem = call('settleItem');
export const listPlayers = call('listPlayers');
export const listAnswers = call('listAnswers');
export const leaderboard = call('leaderboard');
export const kickPlayer = call('kickPlayer');
export const pingHost = call('pingHost');

// Student flow
export const joinSession = call('joinSession');
export const submitAnswer = call('submitAnswer');
export const getOwnAnswer = call('getOwnAnswer');
export const pingPresence = call('pingPresence');

// Realtime subscription. Returns (a promise resolving to) an unsubscribe fn.
export const subscribeRoom = call('subscribeRoom');
