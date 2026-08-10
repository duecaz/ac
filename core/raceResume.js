// REANUDAR LA CARRERA — siembra de la cola desde las respuestas del servidor.
//
// El bug real (v1.51.334, primera partida en producción): la cola de la carrera
// (`raceQueue` en views/studentLive.js) era estado 100% en memoria. Cualquier
// recarga a mitad de carrera —F5, el móvil descartando la página al bloquear la
// pantalla, o la propia auto-actualización de versión— la reconstruía con TODOS
// los ítems: el alumno repetía lo que ya había acertado. "Solo la que falló
// debía volver a la cola."
//
// El arreglo: al iniciar la carrera, la cola se SIEMBRA desde las filas propias
// de `live_answers` (que ya existen: cada acierto se envía con `correct=true`
// como hint de avance, §22-C6). Un ítem con `correct === true` no vuelve a la
// cola; los fallados y los nunca vistos sí, en su orden original.
//
// Módulo PURO (sin fetch): entra el nº de ítems + las filas propias, sale el
// estado de la carrera. La vista pide las filas por `listOwnAnswers` y el
// adaptador decide qué significa "correct" en su almacén (hint incluido).
export function raceResumeState(itemCount, rows) {
  const done = new Set();   // ítems ya acertados → NO vuelven a la cola
  const sent = new Set();   // ítems con PRIMER intento ya enviado (analítica v0/c0)
  let finishMs = null;      // hora de meta (ms de servidor del ÚLTIMO acierto)
  for (const r of rows || []) {
    const i = Number(r?.itemIndex);
    if (!Number.isInteger(i) || i < 0 || i >= itemCount) continue;
    sent.add(i);
    if (r.correct === true) {
      done.add(i);
      if (Number.isFinite(r.ms) && (finishMs == null || r.ms > finishMs)) finishMs = r.ms;
    }
  }
  const queue = [];
  for (let i = 0; i < itemCount; i++) if (!done.has(i)) queue.push(i);
  // `finishMs` solo vale como hora de meta si de verdad TERMINÓ (cola vacía):
  // sin esto, una recarga tras la meta mostraba como "tu tiempo" la hora de la
  // RECARGA (se recalculaba con el reloj), contradiciendo el orden del podio.
  return { queue, correctCount: done.size, firstSent: sent,
           finishMs: queue.length === 0 ? finishMs : null };
}
