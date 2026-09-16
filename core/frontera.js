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

/** ¿NO HUBO SERVIDOR? — distinto de «el servidor dijo que no».
 *
 *  Un `fetch` que no llega a ninguna parte lanza un `TypeError` sin `status`
 *  («Failed to fetch»), y PocketBase envuelve ese mismo caso con `status: 0`.
 *  Las dos formas significan lo mismo: la petición no obtuvo respuesta.
 *
 *  Se mira el STATUS y no el texto a propósito: el mensaje del navegador
 *  cambia con el idioma y con el motor («Failed to fetch» en Chrome, «Load
 *  failed» en Safari, «NetworkError…» en Firefox), así que una regla escrita
 *  sobre el texto falla justo en el aparato que no tienes delante. */
/** @param {unknown} e @returns {boolean} */
export const esFalloDeRed = (e) => { const s = estadoDe(e); return s === null || s === 0; };

/** LO QUE SE LE DICE A UNA PERSONA cuando no hubo servidor.
 *
 *  Está aquí, con un solo dueño, porque el 2026-09-16 una caída de diez horas
 *  llegó a la pantalla como «Failed to fetch» — en inglés, sin causa y sin nada
 *  que hacer a continuación. Tres vistas lo contaban de tres maneras.
 *
 *  Y DICE «MANTENIMIENTO», A PROPÓSITO (decisión del dueño, 2026-09-16): al
 *  profe que tiene la clase delante no se le cuenta de quién es la culpa —ni
 *  red del colegio, ni certificados, ni incidencias— porque no puede hacer nada
 *  con esa información y solo le sirve para asustarse. El detalle técnico es
 *  para el reporte de diagnóstico, no para la pantalla. */
export const MENSAJE_SIN_SERVIDOR =
  'Estamos en mantenimiento. Vuelve a intentarlo en unos minutos.';

/** El texto para enseñar: la causa de verdad si no hubo servidor, y si no, el
 *  mensaje que venga del propio error. */
/** @param {unknown} e @returns {string} */
export const mensajeParaLaPantalla = (e) => (esFalloDeRed(e) ? MENSAJE_SIN_SERVIDOR : mensajeDe(e));
