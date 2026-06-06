// LIVE room — now a thin alias over the unified SESSION engine (format 'live').
// The Kahoot-style flow, the anti-cheat scoring at settle() and the exact state
// shape all live in kernel/session/engine.js, the single brain shared by
// live / teams / vs / solo and mirrored by the Supabase Edge Functions. Kept as
// a named export so the local driver and existing tests stay unchanged.
import { createSession, FORMATS } from '../session/engine.js';

export function createLiveRoom(activity, opts = {}) {
  return createSession(activity, { ...opts, format: FORMATS.LIVE });
}
