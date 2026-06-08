// Supabase RealtimePort driver. Composes the Supabase live/room operations
// (now colocated here under adapters/supabase/) into the Port surface, so the
// views — which talk to the facade in core/liveTransport.js — never import
// Supabase directly. A PocketBase driver can implement the same surface later.
import * as live from './live.js';
import { createRoom, findRoomByCode, fetchSession } from './room.js';

export function createSupabaseRealtime() {
  return {
    createRoom,
    findRoomByCode,
    fetchSession,
    fetchSessionKey: live.fetchSessionKey,
    joinSession: live.joinSession,
    setSessionState: live.setSessionState,
    startSession: live.startSession,
    endSession: live.endSession,
    settleItem: live.settleItem,
    submitAnswer: live.submitAnswer,
    getOwnAnswer: live.getOwnAnswer,
    listPlayers: live.listPlayers,
    listAnswers: live.listAnswers,
    leaderboard: live.leaderboard,
    kickPlayer: live.kickPlayer,
    pingPresence: live.pingPresence,
    pingHost: live.pingHost,
    subscribeRoom: live.subscribeRoom,
  };
}

export default createSupabaseRealtime;
