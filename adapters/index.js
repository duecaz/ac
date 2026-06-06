// Backend selection. core/storage.js calls getRemoteStore(); which concrete
// adapter it gets is decided here, lazily (the Supabase SDK only loads if chosen).
//
// Resolution order:
//   1. localStorage 'ww.backend' override ('local' | 'supabase' | 'pocketbase')
//   2. localhost / 127.0.0.1 / file → 'local'   (offline-first development)
//   3. otherwise → 'supabase'                    (the deployed site is unchanged)

const VALID = ['local', 'supabase', 'pocketbase'];

export function backendName() {
  try {
    const o = globalThis.localStorage?.getItem('ww.backend');
    if (o && VALID.includes(o)) return o;
  } catch { /* no localStorage */ }
  let host = '';
  try { host = globalThis.location?.hostname ?? ''; } catch { /* no location */ }
  if (host === 'localhost' || host === '127.0.0.1' || host === '') return 'local';
  return 'supabase';
}

let _store = null; // cached promise
let _realtime = null;

/** @returns {Promise<any>} the selected RemoteStore (activity/result persistence). */
export function getRemoteStore() {
  if (_store) return _store;
  const name = backendName();
  _store = (async () => {
    if (name === 'local')      return (await import('./local/remoteStore.js')).createLocalRemoteStore();
    if (name === 'pocketbase') return (await import('./pocketbase/remoteStore.js')).createPocketbaseRemoteStore();
    return (await import('./supabase/remoteStore.js')).createSupabaseRemoteStore();
  })();
  return _store;
}

/** @returns {Promise<any>} the selected RealtimePort (LIVE sessions). */
export function getRealtime() {
  if (_realtime) return _realtime;
  const name = backendName();
  _realtime = (async () => {
    if (name === 'local') return (await import('./local/realtime.js')).createLocalRealtime();
    if (name === 'pocketbase') throw new Error('PocketBase realtime aún no implementado — usa backend local o supabase.');
    return (await import('./supabase/realtime.js')).createSupabaseRealtime();
  })();
  return _realtime;
}

let _assignments = null;

/** @returns {Promise<any>} the selected assignments (tareas) driver. */
export function getAssignments() {
  if (_assignments) return _assignments;
  const name = backendName();
  _assignments = (async () => {
    if (name === 'local') {
      let userId;
      try { userId = (await import('../core/state.js')).getAnonId(); } catch { userId = 'local-anon'; }
      return (await import('./local/assignments.js')).createLocalAssignments({ userId });
    }
    if (name === 'pocketbase') throw new Error('PocketBase assignments aún no implementado — usa backend local o supabase.');
    return (await import('./supabase/assignments.js')).createSupabaseAssignments();
  })();
  return _assignments;
}

// Allow flipping backend at runtime in dev: ww.setBackend('local').
try {
  globalThis.ww = globalThis.ww || {};
  globalThis.ww.setBackend = (name) => {
    if (!VALID.includes(name)) throw new Error(`backend must be one of ${VALID.join(', ')}`);
    globalThis.localStorage?.setItem('ww.backend', name);
    _store = null; // force re-resolution on next call
    console.info(`[adapters] backend → ${name} (reload to fully apply)`);
  };
} catch { /* non-browser */ }
