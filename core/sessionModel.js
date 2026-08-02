// MODELO de la matriz alumno×ítem — DOMINIO PURO, sin DOM.
//
// Vivía en `views/sessionTable.js`, es decir: la capa PLATAFORMA decidía QUIÉN
// GANA una carrera (§0 lo prohíbe: la plataforma no decide reglas de juego). Se
// notó porque los tests de dominio tenían que importarlo desde `views/`. Ahora
// el modelo vive aquí y la vista solo lo pinta.
//
// Lo comparten el informe de live (A1) y el de tareas (B1). Recibe filas
// normalizadas de core/answerRows.js ({ player, name, itemIndex, value, correct,
// points, ms }) + (opcional) los `items` y la `template` para puntuar POR PARTE
// (M1): en Tildes/Comas cada tilde/coma bien puesta cuenta como 1 acierto → la
// celda muestra "4/5" y el ranking va por número de aciertos, no por "frase
// perfecta". Sin M1 → binario ✓/✗.
import { dedupeRows } from './answerRows.js';
import { finishMsOf, byFinish } from './liveRank.js';

// Mérito de una respuesta a un ítem: { hits, over, total, binary }. Fuente única:
// el scorer de la plantilla (contrato {correct, points, hits, total} — fase P4 de
// docs/handoff-puntuacion.md); aquí ya no se reimplementa el conteo por partes.
// Para ítems BINARIOS manda el veredicto GUARDADO (`row.correct`, del settle
// autoritativo), no un re-scoring: solo el mérito multi-parte (tildes "3/8") se
// recalcula del value, porque no viaja en la fila.
function cellScore(template, item, row, activity) {
  try {
    const r = template?.scoreSubmission?.({ value: row.value, item, activity, mode: 'report' });
    if (r && Number.isFinite(r.total) && r.total > 1) {
      return { hits: r.hits || 0, over: r.over || 0, total: r.total, binary: false };
    }
  } catch { /* scorer exigente con la forma del value → binario */ }
  // NO PUNTUABLE (`correct == null`): el ítem no tiene clave y los puntos los da
  // el docente. No suma acierto NI cuenta en el denominador — antes caía en el
  // `else` y contaba como fallo, así que un ítem sin clave hundía a toda la clase.
  if (row.correct == null) return { hits: 0, over: 0, total: 0, binary: true };
  return { hits: row.correct === true ? 1 : 0, over: 0, total: 1, binary: true };
}

// Modelo puro (sin DOM) → testeable.
export function buildSessionTable(rows, nItems, { labels = [], items = [], template = null, activity = null } = {}) {
  const deduped = dedupeRows(rows || []);
  const byPlayer = new Map();
  for (const r of deduped) {
    if (!byPlayer.has(r.player)) byPlayer.set(r.player, { name: r.name || r.player, cells: Array(nItems).fill(null) });
    const p = byPlayer.get(r.player);
    if (r.name && (!p.name || p.name === r.player)) p.name = r.name;
    if (r.itemIndex >= 0 && r.itemIndex < nItems) {
      // La tabla cuenta el intento FINAL (lo que el alumno acabó respondiendo), no
      // el borrador inicial — el heatmap de errores sí usa el primero (v0).
      const vf = r.valueFinal ?? r.value;
      const cf = r.correctFinal ?? r.correct;
      const sc = cellScore(template, items[r.itemIndex], { value: vf, correct: cf }, activity);
      p.cells[r.itemIndex] = { correct: cf, points: r.points || 0, value: vf, hits: sc.hits, over: sc.over || 0, total: sc.total, binary: sc.binary, ms: r.ms ?? null };
    }
  }
  const players = [...byPlayer.values()].map(p => {
    // UN recorrido para los cinco acumuladores (antes, cinco `reduce` sobre las
    // mismas celdas: con 50 alumnos × 20 ítems son 5000 pasadas por informe).
    let total = 0, marks = 0, maxMarks = 0, overs = 0, nCorrect = 0;
    for (const c of p.cells) {
      if (!c) continue;
      total += c.points || 0;
      marks += c.hits || 0;            // ACIERTOS (palabras/respuestas)
      maxMarks += c.total || 0;
      overs += c.over || 0;            // marcas de MÁS (errores)
      if (c.correct === true) nCorrect++;
    }
    // HORA DE META: el instante (ms del SERVIDOR desde la salida, §22-1) de la
    // última respuesta que ACERTÓ. En carrera es literalmente cuándo terminó —
    // y es el criterio que decide, porque un fallo vuelve a la cola: todo el que
    // acaba lo hace con TODAS bien, así que nadie gana por aciertos, sino por
    // tiempo. La definición es la COMPARTIDA (core/liveRank.js): antes esta
    // tabla tenía la suya ("última con correct===true") y el marcador otra
    // ("última que sumó puntos"), y podían discrepar en la misma partida.
    return { name: p.name, cells: p.cells, total, marks, maxMarks, overs, nCorrect,
             finishMs: finishMsOf(p.cells) };
    // manda nº de aciertos; a igualdad, menos errores (de más); luego puntos; y
    // por último quien LLEGÓ ANTES (empate total = la carrera).
  }).sort((a, b) => b.marks - a.marks || a.overs - b.overs || b.total - a.total || byFinish(a, b));

  const perItem = Array.from({ length: nItems }, (_, i) => {
    let hits = 0, tot = 0, n = 0;
    for (const p of players) { const c = p.cells[i]; if (c) { n++; hits += c.hits; tot += c.total; } }
    return { label: labels[i] || `P${i + 1}`, n, pct: tot ? Math.round(100 * hits / tot) : null };
  });
  return { players, perItem };
}

