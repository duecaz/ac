// RealtimePort — the interface for LIVE (hosted room) play, independent of any
// concrete realtime backend. The Supabase adapter implements it today by moving
// core/transport/live.js + room.js behind this surface; a PocketBase adapter can
// implement the same contract later.
//
// Mirrors the public functions of core/transport/live.js so the F1/F3 refactor
// is mechanical: views talk to a facade over this Port, never to Supabase.

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
