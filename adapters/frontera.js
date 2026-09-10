// LA FRONTERA DE LOS ADAPTADORES — lo que entra de FUERA no tiene forma.
//
// Todo lo que cruza esta capa (una fila de PocketBase, el JSON del almacén
// local, el error de un `fetch`) llega como dato sin tipo: es `unknown` y hay
// que ESTRECHARLO antes de leerlo. Estos son los estrechadores, en un solo
// sitio, porque la alternativa —creerle la forma a cada llamador— es
// exactamente cómo `listOwnAnswers` se pasó versiones devolviendo un `ms` que
// no existía en el objeto que leía.
//
// No valida NADA de dominio (eso es del motor y de los scorers): solo responde
// «¿esto es un objeto?», «¿esto es un texto?», «¿qué status trae el error?».

/**
 * EL CLIENTE HTTP de PocketBase tal y como lo reciben las secciones del
 * adaptador (`core/pbHttp.js` envuelto en reintentos por el ensamblador). Lo
 * que devuelve es JSON de FUERA: `unknown` hasta que se estrecha.
 * @typedef {(path: string, opts?: RequestInit) => Promise<unknown>} PbFetch
 */

/** ¿Es un objeto plano (una fila, un blob) y no un array ni null? */
/** @param {unknown} x @returns {x is Record<string, unknown>} */
export const esFila = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

/** La fila que hay dentro de `x`, o una vacía: para encadenar lecturas. */
/** @param {unknown} x @returns {Record<string, unknown>} */
export const fila = (x) => (esFila(x) ? x : {});

/** Las filas de una respuesta `{ items: [...] }` de PocketBase. */
/** @param {unknown} res @returns {Record<string, unknown>[]} */
export function filas(res) {
  const items = fila(res).items;
  return Array.isArray(items) ? items.filter(esFila) : [];
}

/** @param {unknown} x @param {string} [def] @returns {string} */
export const texto = (x, def = '') => (typeof x === 'string' ? x : def);

/** @param {unknown} x @param {number} [def] @returns {number} */
export const numero = (x, def = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : def);

/** Igual que `texto`, pero para los campos que VIAJAN vacíos como `null` (una
 *  fila de PocketBase, el campo `ql` de la sala): ausente y vacío son lo mismo. */
/** @param {unknown} x @returns {string|null} */
export const textoOnulo = (x) => (typeof x === 'string' ? x : null);

/** @param {unknown} x @returns {number|null} */
export const numeroOnulo = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/** Un mapa `clave → número` de FUERA (los puntos de «pedir la palabra»). Las
 *  claves no se validan una a una: quien lo lee ya trata un hueco como cero. */
/** @param {unknown} x @returns {Record<string, number>} */
export const mapaNumeros = (x) => (esFila(x) ? /** @type {Record<string, number>} */ (x) : {});

/** @param {unknown} x @returns {Record<string, string>} */
export const mapaTextos = (x) => (esFila(x) ? /** @type {Record<string, string>} */ (x) : {});

/** EL STATUS DE UN ERROR de PocketBase (`core/pbHttp.js` los sella como
 *  `{ status, pb }` sobre un `Error`). 0 = sin status (red caída, abort). */
/** @param {unknown} e @returns {number} */
export const estadoPb = (e) => numero(fila(e).status, 0);

/** El texto de un `catch (e)`, sea Error o cualquier otra cosa. */
/** @param {unknown} e @returns {string} */
export const mensajeDe = (e) => (e instanceof Error ? e.message : String(e));

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
export const estadoDeSala = (x) => (esFila(x) ? /** @type {Partial<BlobSala>} */ (x) : {});

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
