// Transport facade. Phase 2 only uses the room/live (Supabase) implementation.
// Phase 0/1 SOLO mode bypasses transport entirely.
export * as room from './room.js';
export * as live from './live.js';
