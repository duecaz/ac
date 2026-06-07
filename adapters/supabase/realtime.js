// Supabase RealtimePort driver — wraps the existing transport modules behind the
// same surface as the local driver, so views can switch backends transparently.
// (Step toward moving transport fully under adapters/; for now it composes the
// current functions to keep behaviour identical.)
import * as live from '../../core/transport/live.js';
import { createRoom, findRoomByCode, fetchSession } from '../../core/transport/room.js';

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
