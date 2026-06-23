// Backend selection. core/storage.js calls getRemoteStore(); which concrete
// adapter it gets is decided here, lazily (the Supabase SDK only loads if chosen).
//
// Resolution order:
//   1. URL query param  ?backend=pocketbase  (persiste en localStorage)
//   2. localStorage 'ww.backend' override ('local' | 'supabase' | 'pocketbase')
//   3. localhost / 127.0.0.1 / file → 'local'   (offline-first development)
//   4. otherwise → 'pocketbase'                  (Pi5 self-hosted en pb.lanube.uno)

import { VERSION } from '../core/constants.js';

const VALID = ['local', 'supabase', 'pocketbase'];

// Cache-buster por versión para los imports dinámicos de los drivers. Los
// módulos ES se cachean por archivo; sin esto, tras un deploy el navegador puede
// servir un driver viejo (p.ej. remoteStore.js) aunque constants.js ya esté
// fresco. Añadir ?v=VERSION fuerza descarga fresca de cada driver al subir versión.
const v = `?v=${VERSION}`;

export function backendName() {
  try {
    const qp = new URLSearchParams(globalThis.location?.search).get('backend');
    if (qp && VALID.includes(qp)) {
      globalThis.localStorage?.setItem('ww.backend', qp);
      return qp;
    }
  } catch { /* no location / URLSearchParams */ }
  try {
    const o = globalThis.localStorage?.getItem('ww.backend');
    if (o && VALID.includes(o)) return o;
  } catch { /* no localStorage */ }
  let host = '';
  try { host = globalThis.location?.hostname ?? ''; } catch { /* no location */ }
  if (host === 'localhost' || host === '127.0.0.1' || host === '') return 'local';
  return 'pocketbase';
}

// Probe a PocketBase collection. Returns true if the collection exists and is
// reachable, false if PocketBase returns "Missing collection context" (not yet
// created). Other errors (network, auth) are re-thrown so they surface normally.
import { PB_URL } from '../pocketbase.config.js';
async function pbCollectionExists(name) {
  try {
    const r = await fetch(`${PB_URL}/api/collections/${name}/records?perPage=1`);
    if (r.status === 200) return true;
    const body = await r.json().catch(() => ({}));
    if (body?.message?.includes('Missing collection')) return false;
    return r.ok;
  } catch { return false; /* network unreachable */ }
}

let _store = null;
let _realtime = null;

/** @returns {Promise<any>} the selected RemoteStore (activity/result persistence). */
export function getRemoteStore() {
  if (_store) return _store;
  const name = backendName();
  _store = (async () => {
    if (name === 'local')      return (await import('./local/remoteStore.js' + v)).createLocalRemoteStore();
    if (name === 'pocketbase') return (await import('./pocketbase/remoteStore.js' + v)).createPocketbaseRemoteStore();
    return (await import('./supabase/remoteStore.js' + v)).createSupabaseRemoteStore();
  })();
  return _store;
}

/** @returns {Promise<any>} the selected RealtimePort (LIVE sessions). */
export function getRealtime() {
  if (_realtime) return _realtime;
  const name = backendName();
  _realtime = (async () => {
    if (name === 'local') return (await import('./local/realtime.js' + v)).createLocalRealtime();
    if (name === 'pocketbase') {
      // Live SIEMPRE usa el backend público (PocketBase). Nunca cae a local: cada
      // alumno está en su propio móvil y en otra red, así que un modo "local"
      // (mismo navegador) no serviría. Si falta la colección live_sessions,
      // createRoom dará un error claro y el profesor la crea desde
      // Admin → "Crear colecciones".
      return (await import('./pocketbase/realtime.js' + v)).createPocketbaseRealtime();
    }
    return (await import('./supabase/realtime.js' + v)).createSupabaseRealtime();
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
      try { userId = (await import('../core/state.js' + v)).getAnonId(); } catch { userId = 'local-anon'; }
      return (await import('./local/assignments.js' + v)).createLocalAssignments({ userId });
    }
    if (name === 'pocketbase') {
      let userId;
      try { userId = (await import('../core/state.js' + v)).getAnonId(); } catch { userId = 'local-anon'; }
      if (await pbCollectionExists('assignments')) {
        return (await import('./pocketbase/assignments.js' + v)).createPocketbaseAssignments({ userId });
      }
      console.warn('[assignments] Colección assignments no existe en PocketBase → modo local');
      return (await import('./local/assignments.js' + v)).createLocalAssignments({ userId });
    }
    return (await import('./supabase/assignments.js' + v)).createSupabaseAssignments();
  })();
  return _assignments;
}

// Allow flipping backend at runtime in dev: ww.setBackend('local').
try {
  globalThis.ww = globalThis.ww || {};
  globalThis.ww.setBackend = (name) => {
    if (!VALID.includes(name)) throw new Error(`backend must be one of ${VALID.join(', ')}`);
    globalThis.localStorage?.setItem('ww.backend', name);
    _store = null; _realtime = null; _assignments = null;
    console.info(`[adapters] backend → ${name} (reload to fully apply)`);
  };
} catch { /* non-browser */ }
