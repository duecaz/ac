// M4 — Detalle de respuestas de un intento en el formato común `{i, v, c, p}`
// (item, value, correct, points), para guardarlo en assignment_attempts.answers
// (F3) y results.answers (F4). Normaliza las DOS formas de state.answers:
//   · shell secuencial: { i, itemId, value, correct, points, msTaken }
//   · runner de texto:  { i, v, c, p }
// Con TOPE de tamaño: si el JSON excede maxBytes, suelta primero `v` de los ítems
// CORRECTOS (para el heatmap importan los fallos), luego el resto de `v`.
// Ver docs/historico/handoff-analitica-items.md.

/** UNA respuesta en el formato común del detalle.
 *  @typedef {{i: number, v: unknown, c: boolean|null, p: number}} RespuestaDetalle */

/** @param {Record<string, unknown>} a @param {number} idx @returns {RespuestaDetalle} */
function normOne(a, idx) {
  return {
    i: Number(a.i ?? a.itemIndex ?? idx),
    v: a.v ?? a.value ?? null,
    c: /** @type {boolean|null} */ ((a.c ?? a.correct) ?? null),
    p: Number(a.p ?? a.points ?? 0),
  };
}

/**
 * @param {Record<string, unknown>[]|null|undefined} list
 * @param {{maxBytes?: number}} [o]
 * @returns {RespuestaDetalle[]}
 */
export function packAnswers(list, { maxBytes = 100_000 } = {}) {
  let out = (list || []).map(normOne);
  /** @param {unknown} x @returns {number} */
  const size = (x) => JSON.stringify(x).length;
  if (size(out) <= maxBytes) return out;
  // 1) fuera `v` de los correctos (el heatmap necesita sobre todo los fallos)
  out = out.map(a => (a.c === true ? { ...a, v: null } : a));
  if (size(out) <= maxBytes) return out;
  // 2) fuera todos los `v` (quedan i/c/p → %acierto por ítem sigue vivo)
  out = out.map(a => ({ ...a, v: null }));
  if (size(out) <= maxBytes) return out;
  // 3) último recurso: truncar la lista
  while (out.length && size(out) > maxBytes) out.pop();
  return out;
}
