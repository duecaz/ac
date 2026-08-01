// CLASIFICACIÓN DE UNA SALA EN VIVO — un solo criterio, un solo sitio.
//
// Regla (decisión del usuario, ficha 2b de docs/estudio-bucles-live.md):
//   «la idea de la carrera es quien termina primero con todas bien».
// Traducido a ranking: MÁS PUNTOS gana; y a IGUALDAD de puntos, gana quien
// llegó ANTES a esos puntos. Sin el desempate, dos alumnos con las 5 bien
// quedaban ordenados por el orden de llegada de las filas — daba igual quién
// terminó primero, que es justo lo que la carrera premia.
//
// El "cuándo terminó" es el `ms` de su ÚLTIMA respuesta que ACERTÓ. En carrera
// ese `ms` lo pone el SERVIDOR contra el sello único de apertura de la carrera
// (core/serverMs.js), así que es tiempo desde la salida: el máximo = el instante
// en que cruzó la meta. En rondas cada `ms` va contra su pregunta, así que el
// máximo solo actúa como desempate estable.
//
// Puro y sin E/S. Lo comparten los TRES sitios que ordenan alumnos: el marcador
// derivado de PocketBase, el motor (camino local/blob) y la tabla/podio del
// profe (views/sessionTable.js) — antes cada uno traía su propia definición de
// "meta" y su propio comparador, y podían discrepar en la misma partida.
// Vigilado por tests/raceRank.test.mjs.

/** ¿Esta respuesta cuenta para la meta? La que ACERTÓ. Se acepta también
 *  "sumó puntos" para el camino que no guarda el veredicto (marcador derivado)
 *  — una fallada no debe empujar tu meta hacia el final de la partida. */
const isHit = (r) => r?.correct === true || (r?.points || 0) > 0;

/** El `ms` de una respuesta, en las dos formas que circulan por el repo: la fila
 *  de `live_answers` (`ms`) y la respuesta del motor (`msTaken`). */
const msOf = (r) => r?.ms ?? r?.msTaken ?? 0;

/** HORA DE META de un conjunto de respuestas: el instante de la última que
 *  acertó. `-1` = no acertó ninguna (o no hay reloj) → va al final. */
export function finishMsOf(entries) {
  let mx = -1;
  for (const r of entries || []) if (r && isHit(r)) mx = Math.max(mx, msOf(r));
  return mx;
}

/** Comparador de DESEMPATE por meta: antes = mejor, sin meta = al final. Se
 *  encadena tras el criterio principal (puntos o aciertos) con `||`. */
export function byFinish(a, b) {
  const x = a?.finishMs ?? -1, y = b?.finishMs ?? -1;
  if (x < 0 && y < 0) return 0;
  return x < 0 ? 1 : y < 0 ? -1 : x - y;
}

/** Puntos y hora de meta por jugador. `rows`: filas de respuesta (`player`/
 *  `playerId`, `points`, `ms`/`msTaken`, `correct`) — se aceptan tal cual salen
 *  de PocketBase y del motor, sin normalizar antes (evita un recorrido de más
 *  sobre las 500 filas de una sala). */
export function tallyRows(rows) {
  const tally = new Map();
  for (const r of rows || []) {
    const id = r.player ?? r.playerId;
    if (id == null) continue;
    const t = tally.get(id) || { score: 0, finishMs: -1 };
    t.score += r.points || 0;
    if (isHit(r)) t.finishMs = Math.max(t.finishMs, msOf(r));
    tally.set(id, t);
  }
  return tally;
}

/**
 * Ranking final. `players`: `{ id, name }`. El PUNTAJE sale SIEMPRE de las filas
 * de respuesta (misma fuente que el podio, deuda A): así el marcador entre
 * preguntas y el podio no pueden divergir. Devuelve `{ rank, id, name, score }`
 * — la meta ordena pero NO sale: el marcador es un contrato que ya leen tres
 * vistas (y `tests/liveEngine.test.mjs` lo compara entero).
 */
export function rankPlayers(players, rows, limit = 50) {
  const tally = tallyRows(rows);
  return (players || [])
    .map(p => ({ id: p.id, name: p.name, ...(tally.get(p.id) || { score: 0, finishMs: -1 }) }))
    .sort((a, b) => (b.score - a.score) || byFinish(a, b)
      || String(a.name ?? '').localeCompare(String(b.name ?? '')))
    .slice(0, limit)
    .map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, score: p.score }));
}
