// LA FRONTERA — lo que entra de FUERA no tiene forma.
//
// Todo lo que cruza hacia dentro (el JSON de un `fetch`, una fila de
// PocketBase, el texto del almacén local, el `e` de un `catch`) llega como dato
// sin tipo: es `unknown` y hay que ESTRECHARLO antes de leerlo. Estos son los
// estrechadores GENÉRICOS, en un solo sitio.
//
// Vivían tecleados en cada módulo que miraba hacia fuera: `saco` en tres
// (`aiContent`, `imageSearch`, `aiContentModal`), `esObjeto` en cuatro, el
// status de un error en tres formas distintas y `e instanceof Error ? ... `
// CUARENTA Y SIETE veces. `adapters/frontera.js` ya era el dueño… pero solo
// para los adaptadores: `core/` no puede importar de `adapters/` (las capas van
// hacia abajo), así que lo re-tecleaba. Ahora el dueño es ESTE módulo y
// `adapters/frontera.js` re-exporta desde aquí, quedándose con lo suyo: lo de
// PocketBase y el blob de la sala.
//
// No valida NADA de dominio (eso es del motor y de los scorers): solo responde
// «¿esto es un objeto?», «¿esto es un texto?», «¿qué status trae el error?».

/** ¿Es un objeto plano (una fila, un blob) y no un array ni null? */
/** @param {unknown} x @returns {x is Record<string, unknown>} */
export const esObjeto = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

/** El objeto que hay dentro de `x`, o uno vacío: para encadenar lecturas. */
/** @param {unknown} x @returns {Record<string, unknown>} */
export const saco = (x) => (esObjeto(x) ? x : {});

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

/** EL STATUS HTTP que trae un error, o `null` si no trae ninguno (red caída,
 *  abort, un `throw` que no viene de la red). Las colas de entrega distinguen
 *  «el servidor dijo que no» (403 → no se reintenta) de «no hubo servidor». */
/** @param {unknown} e @returns {number|null} */
export const estadoDe = (e) => numeroOnulo(Number(saco(e).status));

/** El texto de un `catch (e)`, sea Error o cualquier otra cosa. */
/** @param {unknown} e @returns {string} */
export const mensajeDe = (e) => (e instanceof Error ? e.message : String(e));
