// EL PARCHE DE LA SALA, APLICADO — dueño único del vocabulario `RoomPatch`.
//
// El host manda un parche en snake_case (el vocabulario de la FILA) y los DOS
// drivers en vivo lo volcaban sobre su estado con el MISMO bloque de veinte
// `if ('x' in patch)`, tecleado dos veces (adapters/pocketbase/realtimeRooms.js
// y adapters/local/realtime.js). Una copia se olvidaba de un campo y el alumno
// se quedaba sin dato: así se coló `started_at` (el cronómetro de la carrera
// arrancaba en 0 para quien entraba por PIN).
//
// La ÚNICA divergencia declarada entre los dos drivers es A QUÉ OBJETO se
// escribe el RITMO de la partida (deadline, apertura de respuestas, política de
// fin, hora de salida): PocketBase lo guarda dentro del blob `state`, el driver
// local en la propia sala. Por eso entra como parámetro (`ritmo`) en vez de
// desaparecer: cada driver lee lo que él mismo escribió.
import { openedKey } from '../../core/serverMs.js';

/**
 * @typedef {import('../contracts/session.js').RoomPatch} RoomPatch
 * @typedef {import('../contracts/session.js').RoomState} RoomState
 */

/**
 * EL RITMO DE LA PARTIDA: lo que se escribe como INSTANTE (nunca como un
 * temporizador del cliente, §26 ficha 1b) más la política de fin.
 * @typedef {Object} RitmoSala
 * @property {string|null} [deadline]
 * @property {string|null} [answersOpenAt]
 * @property {number|null} [readSecs]
 * @property {'all'|'firstN'|'time'|null} [endPolicy]
 * @property {number|null} [endN]
 * @property {string|null} [startedAt]
 */

/**
 * EL ÍTEM AL QUE SE REFIERE UN PARCHE: el que trae, o el que ya estaba abierto.
 * @param {RoomPatch} patch
 * @param {{currentItem?: number}} state
 * @returns {number}
 */
export const itemDelParche = (patch, state) =>
  ('current_item' in patch) ? Number(patch.current_item) : Number(state.currentItem);

/**
 * §22-1 · SELLA EL INSTANTE DE APERTURA de un ítem a respuestas, para que el
 * tiempo de cada respuesta se mida después contra ÉL y no contra el reloj del
 * móvil. En CARRERA todos los ítems se abren a la vez → un solo sello 'race'.
 *
 * `pisar` es la divergencia declarada de los dos drivers: PocketBase re-sella
 * cuando el servidor devuelve otro `updated` (el sello ES ese autodate), y el
 * local conserva el primero (allí el instante lo pone el propio cliente, así
 * que re-sellar solo movería el origen de la medida).
 *
 * @param {RoomState} state   El blob de la sala (host-only).
 * @param {string|undefined} phase
 * @param {number} idx
 * @param {string|null|undefined} iso
 * @param {{pisar?: boolean}} [opts]
 * @returns {boolean} true si el sello es NUEVO (y por tanto hay que persistirlo).
 */
export function sellarApertura(state, phase, idx, iso, { pisar = false } = {}) {
  if (!iso || (phase !== 'question' && phase !== 'race')) return false;
  const map = state.itemOpenedAt || (state.itemOpenedAt = {});
  const key = openedKey(phase, idx);
  if (map[key] === iso || (map[key] && !pisar)) return false;
  map[key] = iso;
  return true;
}

/**
 * VUELCA EL PARCHE DEL HOST sobre el estado de la sala.
 *
 * `destino` es el blob (fase, cursor, bucle, puntos de «pedir la palabra»);
 * `ritmo` es dónde vive el compás de la partida — el MISMO blob en PocketBase,
 * la fila de la sala en el driver local.
 *
 * Lo que NO hace, a propósito: el campo `ql` (lo construye `parcheDePalabra`,
 * porque cada driver lo guarda en un sitio distinto) ni la FILA de respuesta del
 * premio del docente (eso es `live_answers`, y su dueño es el adaptador).
 *
 * @param {RoomState} destino
 * @param {RoomPatch} patch
 * @param {RitmoSala} [ritmo]
 */
export function aplicarParcheDeSala(destino, patch, ritmo = destino) {
  if (patch.status !== undefined) destino.status = patch.status;
  if (patch.phase !== undefined) destino.phase = patch.phase;
  if (patch.current_item !== undefined) destino.currentItem = patch.current_item;
  // EL BUCLE que corrió la sala (§26). Vive en el blob porque es un HECHO de la
  // partida, no un detalle de una vista: lo leen el settle (modelo de puntos),
  // el podio y la tabla. Antes cada uno lo re-adivinaba de la fase o del sello
  // de apertura, y el lobby lo perdía al recargar.
  if ('loop' in patch) destino.loop = patch.loop ?? null;
  if ('ql_points' in patch) destino.qlPoints = patch.ql_points ?? {};
  // CL-1 · quién se llevó cada caja. Se guardaba CUÁNTO valió, no QUIÉN
  // respondió, así que el docente no tenía forma de ver a quién le faltaba
  // participar (y los rápidos acaparaban sin que se notara).
  if ('ql_taken' in patch) destino.qlTaken = patch.ql_taken ?? {};
  if (patch.ql_award) {
    const { playerId, points } = patch.ql_award;
    const p = (destino.players || []).find(pl => pl.id === playerId);
    if (p) p.score = (p.score || 0) + points;
  }
  // R-1 · instante en que se pueden TOCAR las respuestas (§26 ficha 1b): el
  // ritmo del juego se escribe como INSTANTE en la sala, nunca como un
  // temporizador local — así todos los móviles leen lo mismo y quien entra
  // tarde o recarga ve el tiempo que queda de verdad.
  if ('deadline' in patch) ritmo.deadline = patch.deadline ?? null;
  if ('answers_open_at' in patch) ritmo.answersOpenAt = patch.answers_open_at ?? null;
  if ('read_secs' in patch) ritmo.readSecs = patch.read_secs ?? null;
  // POLÍTICA DE FIN de carrera/tablero (core/liveEnd.js): vive en la sala porque
  // el ALUMNO también la necesita — es lo que le dice si espera un reloj o a sus
  // compañeros, en vez de un «esperando…» mudo.
  if ('end_policy' in patch) ritmo.endPolicy = patch.end_policy ?? null;
  if ('end_n' in patch) ritmo.endN = patch.end_n ?? null;
  if ('started_at' in patch) ritmo.startedAt = patch.started_at ?? null;
}

/**
 * LAS CLAVES `ql_*` DE UN PARCHE → la forma del campo `ql` (el «pedir la
 * palabra» vive FUERA del blob, §22: es lo ÚNICO que escribe un alumno).
 * Devuelve `null` si el parche no toca nada de Pregunta en Vivo, para no
 * escribir el campo en vano.
 * @param {RoomPatch} patch
 * @returns {{open?: number|null, question?: string|null, image?: string|null, by?: string|null, byName?: string|null}|null}
 */
export function parcheDePalabra(patch) {
  /** @type {{open?: number|null, question?: string|null, image?: string|null, by?: string|null, byName?: string|null}} */
  const out = {};
  let touched = false;
  if ('ql_open' in patch) { out.open = patch.ql_open ?? null; touched = true; }
  if ('ql_question' in patch) { out.question = patch.ql_question ?? null; touched = true; }
  if ('ql_image' in patch) { out.image = patch.ql_image ?? null; touched = true; }
  if ('ql_by' in patch) { out.by = patch.ql_by ?? null; touched = true; }
  if ('ql_by_name' in patch) { out.byName = patch.ql_by_name ?? null; touched = true; }
  return touched ? out : null;
}
