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

/** @returns {Promise<any>} the selected RemoteStore. */
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
