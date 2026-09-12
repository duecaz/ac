// M2 — Normaliza las TRES fuentes de respuestas por-ítem a una forma común, para
// que la analítica (core/itemStats.js) no conozca los detalles de almacenamiento:
//   forma → { player, name, itemIndex, value, correct, points }
// Fuentes: live_answers (PB, una fila por alumno×ítem), el blob legado
// state.answers, y el detalle de un intento de tarea (F3). Ver docs/historico/handoff-analitica-items.md.

// Fila cruda de live_answers / listAnswers (por ítem). itemIndex puede venir en la
// propia fila (item/itemIndex) o pasarse aparte (listAnswers es por ítem).
// Para el ANÁLISIS interesa el PRIMER intento (captura los errores). En carrera
// eso vive en v0/c0; en el resto (un concurso con candado de primera respuesta) el
// propio value/correct YA es el primer intento. Se prefiere v0/c0 si están.
import { deriveAnswerMs, openedAtFor, origenServidor } from './serverMs.js';

/**
 * UNA FILA CRUDA de respuestas, venga de donde venga: `live_answers` de
 * PocketBase, el blob legado o el driver local. Todos los campos son opcionales
 * porque cada fuente nombra los suyos (`player`/`playerId`/`user_id`…) y este
 * módulo existe justo para reducirlas a una forma.
 * @typedef {Object} FilaCruda
 * @property {string} [player]
 * @property {string} [playerId]
 * @property {string} [player_id]
 * @property {string} [user_id]
 * @property {string} [name]
 * @property {string} [player_name]
 * @property {number} [item]
 * @property {number} [itemIndex]
 * @property {unknown} [value]
 * @property {boolean|null} [correct]
 * @property {unknown} [v0]
 * @property {boolean|null} [c0]
 * @property {boolean} [scored]
 * @property {boolean} [unscorable]
 * @property {number} [points]
 * @property {number} [ms]
 * @property {number} [msTaken]
 * @property {string} [created]
 * @property {string} [updated]
 */

/**
 * LA FORMA COMÚN que consume la analítica (`core/itemStats.js`): primer intento
 * (`value`/`correct`) y el final (`valueFinal`/`correctFinal`).
 * @typedef {Object} AnswerRow
 * @property {string} player
 * @property {string} name
 * @property {number} itemIndex
 * @property {unknown} value
 * @property {boolean|null} correct
 * @property {unknown} valueFinal
 * @property {boolean|null} correctFinal
 * @property {number} points
 * @property {number|null} [ms]
 */

/**
 * Lo que el llamante sabe de la sala y esta normalización no puede adivinar.
 * @typedef {Object} OpcionesFila
 * @property {Record<string, string>} [itemOpenedAt]
 * @property {string} [phase]
 * @property {string|null} [origen]
 */

/** @param {FilaCruda} r @returns {unknown} */
function firstVal(r) { return (r.v0 !== undefined && r.v0 !== null) ? r.v0 : r.value; }
/** @param {FilaCruda} r @returns {boolean|null} */
function firstCorrect(r) { return (r.c0 !== undefined && r.c0 !== null) ? r.c0 : (r.correct ?? null); }

/**
 * @param {FilaCruda} r
 * @param {number|null} fallbackItem
 * @param {OpcionesFila|null} [opts]
 * @returns {AnswerRow}
 */
function normLive(r, fallbackItem, opts) {
  const itemIndex = Number(r.itemIndex ?? r.item ?? fallbackItem ?? 0);
  // §22-1 — el tiempo que se MUESTRA es el mismo que PUNTUÓ: derivado de los
  // autodate del servidor contra el sello de apertura del ítem. Sin sello (blob
  // legado, driver local) cae al `ms` afirmado, igual que el scorer.
  // Una fila YA LIQUIDADA lleva el `ms` que puso el SERVIDOR al settle (el
  // adaptador lo reescribe ahí). Hay que preferirlo, porque ese mismo PATCH pisa
  // el `updated` de la fila: derivar otra vez daría la hora del settle —
  // IDÉNTICA para toda la clase— y en carrera eso borra la hora de meta, que es
  // justo lo que ordena. Solo se deriva mientras la respuesta sigue sin puntuar.
  // Sin sello (el PATCH aparte pudo no entrar, §22-1): el origen de RESPALDO
  // también aquí, no solo en el settle — si no, la TABLA del profe volvía a
  // ordenar por el ms que afirma el móvil justo en la sala donde el settle no
  // pudo persistir (revisión de v1.51.444). Viene en opts (`origen`): por
  // defecto, el `created` más temprano de las filas del MISMO ítem.
  const opened = openedAtFor(opts?.itemOpenedAt, itemIndex, opts?.phase) || opts?.origen || null;
  const settledMs = r.scored === true ? Number(r.ms ?? r.msTaken) : NaN;
  const ms = Number.isFinite(settledMs) ? settledMs
    : opened
      ? deriveAnswerMs({ createdAt: r.created ?? '', updatedAt: r.updated ?? '', openedAt: opened, claimedMs: r.ms ?? 0, phase: opts?.phase ?? '' }).ms
      : (r.ms ?? r.msTaken ?? null);
  return {
    player: r.player ?? r.playerId ?? r.player_id ?? r.user_id ?? '?',
    name: r.name ?? r.player_name ?? '',
    itemIndex,
    // PRIMER intento (para el heatmap de errores: qué falló al inicio).
    value: firstVal(r),
    // `unscorable` (deuda C): el settle la liquidó pero el ítem no tiene clave →
    // NO PUNTUABLE, no "incorrecta". PocketBase no guarda booleanos nulos, así que
    // el veredicto viaja en su propio campo y aquí se restaura el null.
    correct: r.unscorable ? null : firstCorrect(r),
    // Intento FINAL (para la TABLA/ranking: lo que el alumno acabó respondiendo).
    // En carrera un alumno puede empezar mal (v0) y corregir; la tabla debe contar
    // su resultado final, no el borrador. Sin v0 (concursos/tarea) final = primero.
    valueFinal: r.value ?? firstVal(r),
    correctFinal: r.unscorable ? null : (r.correct ?? firstCorrect(r)),
    points: r.points ?? 0,
    ms,
  };
}

// Filas de live_answers ya con itemIndex (o para un ítem dado). `opts`:
// `{ itemOpenedAt, phase }` del blob de la sala (host-only) → el `ms` sale del
// reloj del SERVIDOR, como en el scorer.
/**
 * @param {FilaCruda[]|null|undefined} rows
 * @param {number|null} [itemIndex]
 * @param {OpcionesFila|null} [opts]
 * @returns {AnswerRow[]}
 */
export function rowsFromLiveAnswers(rows, itemIndex = null, opts = null) {
  // Origen de respaldo POR ÍTEM (cada pregunta abre a su hora): salvo que el
  // caller pase uno mejor — en carrera todos los ítems abren a la vez y el
  // origen bueno es el de TODA la sala (lo pasa gatherSessionRows).
  const origen = opts?.origen ?? origenServidor(rows || []);
  return (rows || []).map(r => normLive(r, itemIndex, { ...(opts || {}), origen }));
}

// Blob legado `state.answers`: { "idx:playerId" → {playerId, value, correct, points} }.
// Resuelve el nombre desde state.players ([{id, name}]).
/**
 * @param {import('../kernel/contracts/session.js').RoomState|null|undefined} state
 * @returns {AnswerRow[]}
 */
export function rowsFromLiveState(state) {
  /** @type {Record<string, FilaCruda>} */
  const answers = state?.answers || {};
  const names = new Map((state?.players || []).map(p => [p.id, p.name]));
  /** @type {AnswerRow[]} */
  const out = [];
  for (const [key, a] of Object.entries(answers)) {
    const sep = key.indexOf(':');
    const itemIndex = Number(key.slice(0, sep));
    const player = a.playerId ?? key.slice(sep + 1);
    out.push({ player, name: names.get(player) || '', itemIndex, value: firstVal(a), correct: firstCorrect(a), valueFinal: a.value ?? firstVal(a), correctFinal: a.correct ?? firstCorrect(a), points: a.points ?? 0, ms: a.msTaken ?? a.ms ?? null });
  }
  return out;
}

// Detalle de un intento de tarea (F3): attempt.answers = [{ i, v, c, p }].
/**
 * @typedef {Object} DetalleIntento
 * @property {number} i
 * @property {unknown} v
 * @property {boolean|null} [c]
 * @property {number} [p]
 */

/**
 * `answers` viaja como `unknown[]` en la fila (§22: detalle que afirmó el
 * cliente), así que cada entrada se lee por su forma.
 * @typedef {{answers?: unknown[], player_name?: string, user_id?: string}} IntentoConDetalle
 */

/**
 * @param {IntentoConDetalle|null|undefined} attempt
 * @returns {AnswerRow[]}
 */
export function rowsFromAttempt(attempt) {
  const list = Array.isArray(attempt?.answers) ? attempt.answers : [];
  const player = attempt?.player_name || attempt?.user_id || '?';
  return list.map(raw => {
    const a = /** @type {Partial<DetalleIntento>} */ (raw && typeof raw === 'object' ? raw : {});
    return { player, name: attempt?.player_name || '', itemIndex: Number(a.i), value: a.v, correct: a.c ?? null, valueFinal: a.v, correctFinal: a.c ?? null, points: a.p ?? 0 };
  });
}

// Junta varios intentos de tarea (un informe agrega toda la clase).
/**
 * @param {IntentoConDetalle[]|null|undefined} attempts
 * @returns {AnswerRow[]}
 */
export function rowsFromAttempts(attempts) {
  return (attempts || []).flatMap(rowsFromAttempt);
}

// Dedupe: por (player, itemIndex) se queda la ÚLTIMA (más reciente). Los arrays de
// entrada ya vienen en orden de inserción; la última gana. (Ver deuda F: en live
// las filas pueden duplicarse con ms≈0 — desempatamos por "última", no por ms.)
/** @param {AnswerRow[]} rows @returns {AnswerRow[]} */
export function dedupeRows(rows) {
  /** @type {Map<string, AnswerRow>} */
  const seen = new Map();
  for (const r of rows) seen.set(`${r.player} ${r.itemIndex}`, r);
  return [...seen.values()];
}
