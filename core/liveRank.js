// CLASIFICACIÓN DE UNA SALA EN VIVO — un solo criterio, un solo sitio.
//
// Regla (decisión del usuario, ficha 2b de docs/estudio-bucles-live.md):
//   «la idea de la carrera es quien termina primero con todas bien».
// Traducido a ranking: MÁS PUNTOS gana; y a IGUALDAD de puntos, gana quien
// llegó ANTES a esos puntos. Sin el desempate, dos alumnos con las 5 bien
// quedaban ordenados por el orden de llegada de las filas — daba igual quién
// terminó primero, que es justo lo que la carrera premia.
//
// El "cuándo terminó" es el `ms` de su ÚLTIMA respuesta que puntuó. En carrera
// el `ms` lo deriva el servidor contra el sello ÚNICO de apertura de la carrera
// (core/serverMs.js `openedKey` → 'race'), así que es tiempo transcurrido desde
// la salida: el máximo = el instante en que cruzó la meta. En rondas cada `ms`
// va contra su pregunta, así que el máximo solo actúa como desempate estable.
//
// Puro y sin E/S: lo comparten el adaptador PocketBase (marcador derivado de
// live_answers) y el motor (camino local/blob). Vigilado por tests/raceRank.test.mjs.

/** Puntos y "hora de meta" por jugador. `rows`: `{ player, points, ms }`. */
export function tallyRows(rows) {
  const tally = new Map();
  for (const r of rows || []) {
    const id = r.player ?? r.playerId;
    if (id == null) continue;
    const t = tally.get(id) || { score: 0, finishMs: -1 };
    t.score += r.points || 0;
    // Solo cuentan para la meta las respuestas que SUMARON: una fallada (0 pts)
    // no debe empujar tu hora de meta hacia el final de la partida.
    if ((r.points || 0) > 0) t.finishMs = Math.max(t.finishMs, r.ms ?? 0);
    tally.set(id, t);
  }
  return tally;
}

/**
 * Ranking final. `players`: `{ id, name }`. El PUNTAJE sale SIEMPRE de las filas
 * de respuesta (misma fuente que el podio, deuda A): así el marcador entre
 * preguntas y el podio no pueden divergir. Devuelve `{ rank, id, name, score }`.
 */
export function rankPlayers(players, rows, limit = 50) {
  const tally = tallyRows(rows);
  return (players || [])
    .map(p => {
      const t = tally.get(p.id) || { score: 0, finishMs: -1 };
      return { id: p.id, name: p.name, score: t.score, finishMs: t.finishMs };
    })
    .sort((a, b) => (b.score - a.score)
      // Sin meta (nadie puntuó) va al final; a igualdad, antes = mejor.
      || (a.finishMs < 0 ? 1 : b.finishMs < 0 ? -1 : a.finishMs - b.finishMs)
      || String(a.name ?? '').localeCompare(String(b.name ?? '')))
    .slice(0, limit)
    .map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, score: p.score }));
}
