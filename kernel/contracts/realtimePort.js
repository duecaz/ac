// RealtimePort — the interface for LIVE (hosted room) play, independent of any
// concrete realtime backend. The Supabase adapter implements it in
// adapters/supabase/ (realtime.js composing live.js + room.js); a PocketBase
// adapter can implement the same contract later.
//
// Views never import a backend: they talk to the facade in core/liveTransport.js,
// which resolves the active Port via adapters/index.js getRealtime().

/**
 * @typedef {Object} RoomChange
 * @property {'sessions'|'players'|'answers'} table
 * @property {string} eventType  e.g. 'INSERT' | 'UPDATE' | 'DELETE'
 * @property {Object} [new]
 * @property {Object} [old]
 */

/**
 * @typedef {Object} RealtimePort
 * @property {(activity: Object) => Promise<{id:string, code:string}>} createRoom
 * @property {(code: string, nickname: string) => Promise<Object>} joinRoom
 * @property {(sessionId: string, patch: Object) => Promise<void>} startSession
 * @property {(sessionId: string, itemIndex: number) => Promise<void>} settleItem
 * @property {(sessionId: string) => Promise<Object[]>} listPlayers
 * @property {(sessionId: string, itemIndex: number) => Promise<Object[]>} listAnswers
 * @property {(sessionId: string) => Promise<Object[]>} leaderboard
 * @property {(args: Object) => Promise<void>} submitAnswer
 * @property {(sessionId: string, onChange: (c: RoomChange) => void) => (() => void)} subscribeRoom
 *           Returns an unsubscribe function.
 */

export {};
