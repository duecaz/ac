// RemoteStore — the swappable "remote backend" half of the DataPort. core/storage
// keeps localStorage as the offline-first cache and delegates remote persistence
// to whichever RemoteStore the config selects (local / supabase / pocketbase).
//
// Contract (all async, operate on the activity JSONB shape):
//   saveActivity(activity)    -> Promise<void>
//   deleteActivity(id)        -> Promise<void>
//   getActivity(id)           -> Promise<Object|null>   raw activity data, or null
//   listActivities()          -> Promise<{id:string, data:Object}[]>
//
// --- Local adapter ---
// Simulates a backend with a single key-value blob. In the browser that's
// localStorage (a "remote mirror" key, separate from the per-user cache, so
// getActivity/embed still work offline). The KV is injectable so this is
// unit-testable in Node without a DOM.

const KEY = 'ww.remote.activities';

function defaultKV() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

/**
 * @param {{getItem:Function, setItem:Function}} [kv] Injectable key-value store.
 * @returns {import('../../kernel/contracts/dataPort.js').DataPort | any}
 */
export function createLocalRemoteStore(kv = defaultKV()) {
  const mem = new Map(); // fallback when no KV (e.g. Node without a shim)

  const read = () => {
    if (kv) { try { return JSON.parse(kv.getItem(KEY) || '{}'); } catch { return {}; } }
    return Object.fromEntries(mem);
  };
  const write = (map) => {
    if (kv) kv.setItem(KEY, JSON.stringify(map));
    else { mem.clear(); for (const [k, v] of Object.entries(map)) mem.set(k, v); }
  };

  return {
    async saveActivity(a) { const m = read(); m[a.id] = a; write(m); },
    async deleteActivity(id) { const m = read(); delete m[id]; write(m); },
    async getActivity(id) { return read()[id] || null; },
    async listActivities() { return Object.entries(read()).map(([id, data]) => ({ id, data })); },
  };
}

export default createLocalRemoteStore;
