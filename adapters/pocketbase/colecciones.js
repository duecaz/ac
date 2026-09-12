// ¿EXISTE ESTA COLECCIÓN EN POCKETBASE? — sonda memoizada, una sola.
//
// La respuesta decide si una ruta usa su colección o cae al camino heredado
// (`live_answers`, `live_players`) y si las tareas van a PocketBase o al driver
// local. Estaba escrita dos veces —`adapters/index.js` y
// `adapters/pocketbase/realtime.js`— con el mismo reconocimiento del mensaje
// «Missing collection» y cachés separadas, así que la misma pregunta se pagaba
// dos veces por carga.
//
// No usa `pbFetch`: es una sonda ANÓNIMA a propósito (basta con que la colección
// responda) y tiene que poder contestar antes de que haya sesión.
import { PB_URL } from '../../pocketbase.config.js';

/** @type {Map<string, Promise<boolean>>} */
const memo = new Map();

/** @param {string} name @returns {Promise<boolean>} */
async function sondear(name) {
  try {
    const r = await fetch(`${PB_URL}/api/collections/${name}/records?perPage=1`);
    if (r.status === 200) return true;
    const body = await r.json().catch(() => null);
    const msg = (body && typeof body === 'object' && 'message' in body) ? String(body.message) : '';
    if (msg.includes('Missing collection')) return false;
    return r.ok;
  } catch { return false; /* red inalcanzable */ }
}

/**
 * ¿Existe (y responde) la colección? Memoizado por nombre, incluida la promesa
 * en vuelo: dos rutas que preguntan a la vez comparten la única consulta.
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export function coleccionExiste(name) {
  let p = memo.get(name);
  if (!p) {
    // Se cachea también el «no»: como las dos sondas que unifica. Si falta la
    // colección, la ruta cae al camino heredado y no se paga una consulta por
    // respuesta (esto lo pregunta cada envío de la clase entera).
    p = sondear(name);
    memo.set(name, p);
  }
  return p;
}

/** La misma sonda, atada a una colección: `answersReady()`, `playersReady()`…
 *  @param {string} name @returns {() => Promise<boolean>} */
export const sondaDeColeccion = (name) => () => coleccionExiste(name);
