// LA FRONTERA DE LOS ADAPTADORES — lo de PocketBase y el blob de la sala.
//
// Los estrechadores GENÉRICOS («¿esto es un objeto?», «¿esto es un texto?»,
// «¿qué dijo el error?») ya no viven aquí: su dueño es `core/frontera.js`,
// porque `core/` también mira hacia fuera y NO puede importar de `adapters/`
// (las capas van hacia abajo) — así que se los re-tecleaba. Este módulo los
// RE-EXPORTA con los nombres que usan los adaptadores (una fila es un objeto) y
// se queda con lo que de verdad es suyo: la respuesta `{items}` de PocketBase,
// el status de sus errores y el blob de estado de la sala en vivo.
import { esObjeto, saco, numero } from '../core/frontera.js';

export {
  esObjeto as esFila,
  saco as fila,
  texto,
  numero,
  textoOnulo,
  numeroOnulo,
  mensajeDe,
} from '../core/frontera.js';

/**
 * EL CLIENTE HTTP de PocketBase tal y como lo reciben las secciones del
 * adaptador (`core/pbHttp.js` envuelto en reintentos por el ensamblador). Lo
 * que devuelve es JSON de FUERA: `unknown` hasta que se estrecha.
 * @typedef {(path: string, opts?: RequestInit) => Promise<unknown>} PbFetch
 */

/** Las filas de una respuesta `{ items: [...] }` de PocketBase. */
/** @param {unknown} res @returns {Record<string, unknown>[]} */
export function filas(res) {
  const items = saco(res).items;
  return Array.isArray(items) ? items.filter(esObjeto) : [];
}

/** Un mapa `clave → número` de FUERA (los puntos de «pedir la palabra»). Las
 *  claves no se validan una a una: quien lo lee ya trata un hueco como cero. */
/** @param {unknown} x @returns {Record<string, number>} */
export const mapaNumeros = (x) => (esObjeto(x) ? /** @type {Record<string, number>} */ (x) : {});

/** @param {unknown} x @returns {Record<string, string>} */
export const mapaTextos = (x) => (esObjeto(x) ? /** @type {Record<string, string>} */ (x) : {});

/** EL STATUS DE UN ERROR de PocketBase (`core/pbHttp.js` los sella como
 *  `{ status, pb }` sobre un `Error`). 0 = sin status (red caída, abort). */
/** @param {unknown} e @returns {number} */
export const estadoPb = (e) => numero(saco(e).status, 0);

// ─── EL BLOB DE LA SALA EN VIVO ──────────────────────────────────────────────
// El estado de una sala hace DOS viajes y por eso vive aquí, en la frontera:
// sale del motor (`LiveState`, lo que la máquina garantiza) y vuelve de una
// fila —de PocketBase o de localStorage— como dato sin forma. Los dos
// adaptadores en vivo hacen exactamente los mismos dos movimientos.

/**
 * @typedef {import('../kernel/contracts/session.js').RoomState} RoomState
 * @typedef {import('../kernel/contracts/session.js').LiveEngine} LiveEngine
 */

/**
 * DE DENTRO HACIA FUERA: el estado del motor VISTO COMO EL BLOB QUE SE
 * PERSISTE. La máquina en vivo garantiza fase, estado, cursor, jugadores y
 * respuestas; el RITMO de la sala (deadline, apertura de respuestas, política
 * de fin, sellos §22-1, puntos de «pedir la palabra») lo escriben los
 * adaptadores encima, y su catálogo es `RoomState`.
 * @typedef {LiveEngine['state'] & RoomState} BlobSala
 */

/**
 * DE FUERA HACIA DENTRO: el blob `state` de una fila, para hidratar el motor.
 * No se valida campo a campo a propósito — `createLiveRoom` rellena lo que
 * falte y el propio motor es quien sabe qué es un estado válido.
 * @param {unknown} x @returns {Partial<BlobSala>}
 */
export const estadoDeSala = (x) => (esObjeto(x) ? /** @type {Partial<BlobSala>} */ (x) : {});

/**
 * EL MISMO BLOB, VISTO POR EL DESPACHADOR DE SESIONES. `createLiveRoom` declara
 * su `opts` con el tipo de las TRES máquinas a la vez (`SessionOpts` es una
 * intersección), así que un estado de sala EN VIVO no encaja aunque sea el
 * único que esa función va a usar. Mientras `kernel/live/engine.js` no declare
 * `LiveOpts` —que es lo suyo—, la conversión vive aquí, en un solo sitio y con
 * su motivo escrito.
 * @param {Partial<BlobSala>} s
 * @returns {import('../kernel/session/engine.js').SessionOpts['state']}
 */
export const paraHidratar = (s) =>
  /** @type {import('../kernel/session/engine.js').SessionOpts['state']} */ (s);

/**
 * @param {LiveEngine} engine @returns {BlobSala}
 */
export const blobDeSala = (engine) => /** @type {BlobSala} */ (engine.state);
