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
const KEY_RESULTS = 'ww.remote.results';

function defaultKV() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

/**
 * @param {{getItem:Function, setItem:Function}} [kv] Injectable key-value store.
 * @returns {import('../../kernel/contracts/dataPort.js').DataPort | any}
 */
export function createLocalRemoteStore(kv = defaultKV()) {
  const mem = new Map(); // fallback when no KV (e.g. Node without a shim)

  const read = (key) => {
    if (kv) { try { return JSON.parse(kv.getItem(key) || 'null'); } catch { return null; } }
    return mem.has(key) ? mem.get(key) : null;
  };
  const write = (key, val) => {
    if (kv) kv.setItem(key, JSON.stringify(val));
    else mem.set(key, val);
  };
  const readMap = () => read(KEY) || {};

  return {
    async saveActivity(a) { const m = readMap(); m[a.id] = a; write(KEY, m); },
    async deleteActivity(id) { const m = readMap(); delete m[id]; write(KEY, m); },
    async getActivity(id) { return readMap()[id] || null; },
    async listActivities() { return Object.entries(readMap()).map(([id, data]) => ({ id, data })); },
    // Gemelo local del listado público (mismo filtro que PocketBase: solo lo
    // PUBLICADO). Sin esto, en dev la biblioteca —y la pantalla de moderación
    // que la limpia— salían vacías y no se podían probar sin servidor.
    async listPublicActivities({ limit = 120 } = {}) {
      return Object.entries(readMap())
        .filter(([, data]) => data?.visibility === 'public')
        .map(([id, data]) => ({ id: data.id || id, data, language: data.language || 'es',
                                tags: data.tags || [], owner: data.owner || '',
                                updated_at: data.updatedAt || '' }))
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
        .slice(0, Number(limit) || 120);
    },

    // Results: append-only log so reports work offline / on any backend.
    // Espejo del índice único remoto: un reintento con el mismo _qid no duplica.
    async saveResult(r) {
      const log = read(KEY_RESULTS) || [];
      if (r._qid && log.some(x => x._qid === r._qid)) return;
      log.push(r); write(KEY_RESULTS, log);
    },
    async listResults() { return read(KEY_RESULTS) || []; },
  };
}

export default createLocalRemoteStore;
