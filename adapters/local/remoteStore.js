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

// FRONTERA (JSON del almacén): lo que sale de `JSON.parse` es `unknown` y se
// estrecha con los estrechadores de `adapters/frontera.js`, no a ojo.
import { esFila } from '../frontera.js';
import { crearKV } from './kv.js';

const KEY = 'ww.remote.activities';
const KEY_RESULTS = 'ww.remote.results';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').ActivityRow} ActivityRow
 * @typedef {import('../../kernel/contracts/dataPort.js').RemoteStore} RemoteStore
 * @typedef {import('../../kernel/contracts/session.js').ResultRecord} ResultRecord
 */

/** El almacén inyectable: lo mínimo de `Storage` que este driver usa.
 *  @typedef {import('./kv.js').KV} KV */

// La actividad de un resultado del log. El respaldo `activity_id` es para las
// filas legadas que se guardaron con la clave en snake_case.
/** @param {ResultRecord} r @returns {string|undefined} */
function actividadDe(r) {
  if (r.activityId) return r.activityId;
  const legado = /** @type {Record<string, unknown>} */ (r).activity_id;
  return typeof legado === 'string' ? legado : undefined;
}

/**
 * @param {KV|null} [kv] Injectable key-value store (`undefined` = localStorage, `null` = memoria).
 * @returns {RemoteStore}
 */
export function createLocalRemoteStore(kv) {
  // Almacén compartido con los otros dos drivers locales (`adapters/local/kv.js`):
  // localStorage si lo hay, un Map si no (Node sin shim).
  const { read, write } = crearKV('', kv);

  /** @returns {Record<string, Activity>} */
  const readMap = () => {
    const m = read(KEY);
    return esFila(m) ? /** @type {Record<string, Activity>} */ (m) : {};
  };
  /** @returns {ResultRecord[]} */
  const readLog = () => {
    const l = read(KEY_RESULTS);
    return Array.isArray(l) ? /** @type {ResultRecord[]} */ (l) : [];
  };

  return {
    async saveActivity(a) { const m = readMap(); m[a.id] = a; write(KEY, m); },
    async deleteActivity(id) { const m = readMap(); delete m[id]; write(KEY, m); },
    async getActivity(id) { return readMap()[id] || null; },
    // OJO (divergencia declarada en el contrato): aquí `ownerId` NO filtra. El
    // espejo local no tiene el campo de fila `owner` que sí sella PocketBase al
    // guardar, así que filtrar por él dejaría el dev sin actividades.
    async listActivities() { return Object.entries(readMap()).map(([id, data]) => ({ id, data })); },
    // Gemelo local del listado público (mismo filtro que PocketBase: solo lo
    // PUBLICADO). Sin esto, en dev la biblioteca —y la pantalla de moderación
    // que la limpia— salían vacías y no se podían probar sin servidor.
    // `language`/`owner` filtran como en PocketBase: sin ellos, el perfil de
    // autor en dev mostraba la biblioteca entera como si fuera de ese profe.
    async listPublicActivities({ language = '', owner = '', limit = 120 } = {}) {
      return Object.entries(readMap())
        .filter(([, data]) => data?.visibility === 'public')
        .filter(([, data]) => !language || (data.language || 'es') === language)
        .filter(([, data]) => !owner || (data.owner || '') === owner)
        .map(([id, data]) => ({ id: data.id || id, data, language: data.language || 'es',
                                tags: data.tags || [], owner: data.owner || '',
                                updated_at: data.updatedAt || '' }))
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
        .slice(0, Number(limit) || 120);
    },

    // Results: append-only log so reports work offline / on any backend.
    // Espejo del índice único remoto: un reintento con el mismo _qid no duplica.
    async saveResult(r) {
      const log = readLog();
      if (r._qid && log.some(x => x._qid === r._qid)) return;
      log.push(r); write(KEY_RESULTS, log);
    },
    // FILTRA por actividad igual que el de PocketBase. Antes declaraba cero
    // argumentos y devolvía el log entero: quien pasara un id se llevaba TODO
    // sin enterarse — la divergencia que destapó `tests/storePort.test.mjs`.
    // La FORMA sí diverge y está declarada en el contrato: aquí sale el objeto
    // camelCase que guardó el cliente; en PocketBase, la fila snake_case.
    async listResults(activityId) {
      const log = readLog();
      return activityId ? log.filter(r => actividadDe(r) === activityId) : log;
    },
  };
}

export default createLocalRemoteStore;
