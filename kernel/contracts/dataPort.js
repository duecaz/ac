// DataPort — the interface the app uses to persist activities, independent of
// any concrete backend. Adapters (local / supabase / pocketbase) implement it.
//
// Mirrors the current public surface of core/storage.js so the F1 refactor is a
// drop-in: storage.js will consume a DataPort instead of importing Supabase
// directly. Reads stay sync (localStorage-backed); writes return promises and
// fail soft (offline-first), surfacing _unsynced on the local copy.

/**
 * @typedef {Object} SaveResult
 * @property {Object} activity        The normalised, locally-saved activity.
 * @property {Promise<void>} remote   Resolves when the backend confirms; rejects on failure.
 */

/**
 * @typedef {Object} DataPort
 * @property {() => Object[]} list                         All activities for the current user (sync).
 * @property {(id: string) => (Object|null)} get           One activity from local cache (sync).
 * @property {(id: string) => Promise<Object|null>} getRemote  Fetch one straight from backend.
 * @property {(activity: Object) => SaveResult} save       Save locally now, backend in background.
 * @property {(id: string) => Promise<void>} remove        Delete locally + backend.
 * @property {() => Promise<Object[]>} sync                 Pull from backend, merge (last-write-wins).
 * @property {() => Promise<{tried:number, ok:number}>} [retryUnsynced]
 * @property {(userId: string) => void} [setUser]          Switch the per-user storage scope.
 */

export {};
