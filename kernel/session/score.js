// PUNTUACIÓN Y CARGA DE RONDA compartidas por las tres máquinas multi-actor
// (live · teams · vs) — dueño único para que el contrato del scorer y el
// fallback de `getRoundPayload` no diverjan entre formatos.
//
// v1.51.630: extraído de kernel/session/engine.js al partir el motor POR
// MÁQUINA (docs/leyes.md §0, deuda condicionada de CLAUDE.md). Sin dependencias
// externas: ambas funciones reciben todo lo que necesitan por parámetro (T,
// activity…), así que las tres máquinas las importan sin arrastrar nada más.

// Shared scorer call — identical contract across formats so the brain is one.
//
// `correct: null` NO es "incorrecto": es NO PUNTUABLE — el ítem no tiene clave de
// respuesta y los puntos los da el docente a mano (Pregunta en Vivo, Ruleta).
// Antes esto hacía `!!r.correct`, así que un ítem sin clave marcaba a TODA la
// clase como incorrecta en la tabla y en la analítica. Se preserva el null y cada
// consumidor decide cómo pintarlo (la tabla ya tenía su estado "—").
export function autoScore(T, { value, item, msTaken, activity, mode }) {
  const r = T.scoreSubmission({ value, item, msTaken, activity, mode });
  // El DETALLE por marcas (aciertos · de más · total) se conserva cuando el
  // scorer lo declara: es lo que permite explicar al final del duelo POR QUÉ
  // ganó uno (`core/duelSummary.js`). Los scorers de todo-o-nada no lo dan y
  // aquí no se inventa: `detail` queda ausente y quien lo lea se cae a aciertos.
  // `over` ("marcas de MÁS") solo existe en los scorers de marcas: es lo que
  // hace que "márcalo todo" no gane. Se conserva la DISTINCIÓN, no solo el
  // número: sin ella, un Quiz fallado se resumiría como "1 sin marcar", que no
  // significa nada en una pregunta de opción múltiple.
  const detail = Number.isFinite(r.total)
    ? { hits: r.hits || 0, total: r.total, ...(Number.isFinite(r.over) ? { over: r.over } : {}) }
    : null;
  return {
    correct: r.correct == null ? null : !!r.correct,
    points: r.points || 0,
    ...(detail ? { detail } : {}),
  };
}

// Payload de una ronda para el ítem `itemIndex`: lo que la plantilla expone al
// jugador (getRoundPayload, SIN las claves de respuesta), o `fallback` si no lo
// define. ÚNICA copia del `T.getRoundPayload ? … : fallback` que estaba repetido
// en vistas y kernel (una versión con try/catch, otras sin → asimetría: una
// plantilla con getRoundPayload que lanzara caía con gracia en el proyector del
// host pero crasheaba al alumno). El try/catch degrada igual en todos.
export function roundPayloadOf(T, activity, itemIndex, fallback = null, ctx = {}) {
  // Snapshot de sala SANEADO (§22-2): el alumno no tiene `content`, tiene los
  // payloads ya calculados por el host. Se sirven de ahí en vez de recalcular
  // sobre una clave que ya no está (core/liveSnapshot.js).
  const pre = activity?.payloads;
  if (Array.isArray(pre)) return pre[itemIndex] ?? fallback;
  try { return T?.getRoundPayload ? T.getRoundPayload(activity, { itemIndex, ...ctx }) : fallback; }
  catch { return fallback; }
}
