// CARRERA: gana quien TERMINA PRIMERO CON TODAS BIEN.
//
// Definición del usuario: «la idea de la carrera es quien termina primero con
// todas bien, no que haya más puntos por velocidad». Medido antes del arreglo
// (tres navegadores contra PocketBase real): RAPIDO, con 2 aciertos de 5 en los
// primeros segundos, hacía 2997 puntos y GANABA a LENTO, que acertó las 5 (2500).
// El bonus de velocidad convertía la carrera en "quien madruga".
//
// Dos reglas, dos sitios:
//   · puntos PLANOS en carrera  → kernel/session/engine.js (mode 'race')
//   · empate ⇒ quien llegó ANTES → core/liveRank.js (hora de meta)
// Y la CONTRA-PRUEBA: en rondas el bonus de velocidad sigue intacto.
//
// Run: node tests/raceRank.test.mjs
import assert from 'node:assert';
import { rankPlayers, tallyRows } from '../core/liveRank.js';
import { pointsModeFor } from '../core/liveLoops.js';
import { awardPoints } from '../core/scoring/index.js';
import { createLiveRoom } from '../kernel/live/engine.js';
import { registerTemplate } from '../core/registry.js';
import { scoreQuizSubmission } from '../templates/quiz/scorer.js';
import { buildSessionTable } from '../core/sessionModel.js';   // dominio, no vista (§0)
import { podiumHtml } from '../core/podium.js';
import { mmss } from '../core/timings.js';
import { rowsFromLiveAnswers } from '../core/answerRows.js';
import { readFileSync } from 'node:fs';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const activity = {
  id: 'r', template: 'quiz-rank', title: 'Carrera',
  live: { pointsModel: 'velocidad', speedBonusMax: 1000, questionTimer: 20 },
  scoring: { pointsPerCorrect: 1 },
  content: { items: Array.from({ length: 5 }, (_, i) => ({
    id: 'q' + i, question: `${i}+1`, answer: String(i + 1), options: [String(i + 1), 'x'],
  })) },
};
registerTemplate({
  meta: { name: 'quiz-rank', contentModel: 'qa', modes: { live: true },
          defaultRules: () => ({}), defaultScoring: () => ({}), defaultLive: () => ({}) },
  renderPlayer() {}, renderEditor() {},
  scoreSubmission: scoreQuizSubmission,
  getRoundPayload(a, ctx) {
    const it = a.content.items[ctx.itemIndex];
    return it ? { question: it.question, options: it.options } : null;
  },
});

// ── 1. En CARRERA los puntos son planos; en rondas, con bonus ───────────────
{
  const item = activity.content.items[0];
  const race = awardPoints({ correct: true, item, msTaken: 0, activity, mode: 'race' });
  const rounds = awardPoints({ correct: true, item, msTaken: 0, activity, mode: 'live' });
  assert.strictEqual(race, 1, 'carrera: un acierto vale su punto, responda cuando responda');
  assert.strictEqual(awardPoints({ correct: true, item, msTaken: 19000, activity, mode: 'race' }), 1,
    'carrera: tardar no resta puntos (solo desempata)');
  assert.ok(rounds > 500, 'CONTRA-PRUEBA: en rondas el bonus de velocidad sigue vivo');
  ok('puntos planos en carrera, bonus de velocidad intacto en rondas');
}

// ── 2. El escenario que fallaba: 5/5 tarde gana a 2/5 rapidísimo ────────────
{
  const room = createLiveRoom(activity, { code: 'RANK1' });
  const rapido = room.join('u-r', 'RAPIDO');
  const lento = room.join('u-l', 'LENTO');
  room.dispatch('start');
  room.state.phase = 'race';
  // RAPIDO acierta 2 en el primer segundo.
  room.submit(rapido.id, 0, '1', 300);
  room.submit(rapido.id, 1, '2', 800);
  // LENTO acierta las 5, empezando pasados 25 s.
  for (let i = 0; i < 5; i++) room.submit(lento.id, i, String(i + 1), 25000 + i * 500);
  room.settleAll({ keepPhase: true });

  const lb = room.leaderboard(10);
  assert.strictEqual(lb[0].name, 'LENTO', 'gana quien terminó con TODAS bien, aunque fuera lento');
  assert.strictEqual(lb[0].score, 5, 'su puntaje ES el número de aciertos');
  assert.strictEqual(lb[1].score, 2, 'el rápido se queda con lo que acertó: 2');
  ok('5/5 tarde gana a 2/5 rapidísimo (el bug medido en producción)');
}

// ── 3. A IGUALDAD de aciertos, gana quien cruzó la meta antes ──────────────
{
  const room = createLiveRoom(activity, { code: 'RANK2' });
  const veloz = room.join('u-v', 'VELOZ');
  const tardon = room.join('u-t', 'TARDON');
  room.dispatch('start');
  room.state.phase = 'race';
  for (let i = 0; i < 5; i++) room.submit(veloz.id, i, String(i + 1), 1000 + i * 1000);   // meta: 5 s
  for (let i = 0; i < 5; i++) room.submit(tardon.id, i, String(i + 1), 2000 + i * 4000);  // meta: 18 s
  room.settleAll({ keepPhase: true });

  const lb = room.leaderboard(10);
  assert.strictEqual(lb[0].score, lb[1].score, 'ambos terminaron con todas bien');
  assert.strictEqual(lb[0].name, 'VELOZ', 'el empate lo rompe quien llegó ANTES a la meta');
  ok('empate a aciertos ⇒ gana quien terminó primero');
}

// ── 4. La hora de meta la marca la última respuesta que SUMÓ ────────────────
{
  const t = tallyRows([
    { player: 'a', points: 1, ms: 1000 },
    { player: 'a', points: 1, ms: 4000 },
    { player: 'a', points: 0, ms: 9000 },   // un fallo no retrasa tu meta
  ]);
  assert.strictEqual(t.get('a').score, 2);
  assert.strictEqual(t.get('a').finishMs, 4000, 'la meta es la última respuesta que sumó');
  const lb = rankPlayers([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], [{ player: 'b', points: 1, ms: 10 }]);
  assert.strictEqual(lb[0].name, 'B', 'quien no puntuó queda por detrás de quien sí');
  assert.strictEqual(lb[1].score, 0, 'y aparece igual en el podio, con 0');
  ok('la meta ignora los fallos y quien no puntúa va al final');
}

// ── 5. El podio del profe ORDENA y MUESTRA la hora de meta ─────────────────
// Es el caso REAL de la carrera: un fallo vuelve a la cola, así que TODO el que
// termina lo hace con las 5 bien. Nadie gana por aciertos — gana por tiempo. Si
// la tabla no desempatara, el podio saldría en el orden en que llegaron las
// filas, y las tres barras a la misma altura.
{
  const rowsOf = (player, name, msPerItem) => msPerItem.map((ms, i) => ({
    player, name, itemIndex: i, value: String(i + 1), correct: true,
    valueFinal: String(i + 1), correctFinal: true, points: 1, ms,
  }));
  const rows = [
    ...rowsOf('p2', 'TARDON', [4000, 9000, 14000, 19000, 24000]),   // meta 0:24
    ...rowsOf('p1', 'VELOZ', [1000, 2000, 3000, 4000, 5000]),       // meta 0:05
    ...rowsOf('p3', 'MEDIO', [3000, 6000, 9000, 12000, 15000]),     // meta 0:15
  ];
  const { players } = buildSessionTable(rows, 5, {});
  assert.deepStrictEqual(players.map(p => p.name), ['VELOZ', 'MEDIO', 'TARDON'],
    'con 5/5 los tres, el orden lo pone la hora de meta');
  assert.strictEqual(players[0].finishMs, 5000, 'la meta es la última respuesta acertada');

  const html = podiumHtml(players.map(p => ({ name: p.name, score: p.marks, sub: mmss(p.finishMs), tie: p.finishMs })));
  assert.match(html, /VELOZ[\s\S]*?0:05/, 'el podio dice a qué hora llegó cada uno');
  // Colocación: VELOZ 1.º, MEDIO 2.º, TARDON 3.º (antes: los tres 1.º, empatados a 5).
  const places = [...html.matchAll(/<div class="display-6">(\d)<\/div>/g)].map(m => m[1]);
  assert.deepStrictEqual(places, ['2', '1', '3'], 'tres puestos distintos (el orden visual es 2.º · 1.º · 3.º)');
  ok('podio de carrera: ordena por hora de meta y la muestra');
}

// ── 6. La meta la mide el SERVIDOR (y sobrevive al settle) ─────────────────
// Dos bugs encadenados, los dos reproducidos:
//   (a) `listAnswers` no dejaba pasar `created`/`updated`, así que todo caía al
//       `ms` del móvil — que en carrera es el tiempo EN ESA PREGUNTA.
//   (b) el PATCH del settle PISA `updated`: derivar después de liquidar da la
//       hora del settle, IDÉNTICA para toda la clase → la meta desaparece.
//       (Medido contra PocketBase real: los dos alumnos con finishMs 15142.)
// Por eso el settle GUARDA su ms y las filas ya puntuadas lo prefieren.
{
  const T0 = '2026-08-01T10:00:00.000Z';
  const at = (s2) => new Date(Date.parse(T0) + s2 * 1000).toISOString();
  const opts = { itemOpenedAt: { race: T0 }, phase: 'race' };

  // (a) SIN puntuar (la carrera en marcha): se deriva, y en carrera cuenta el
  // instante del ACIERTO (`updated`), no el del primer intento (`created`).
  const enJuego = rowsFromLiveAnswers([{
    player: 'p1', value: 'c', correct: null, scored: false, points: 0,
    ms: 900, created: at(4), updated: at(40),
  }], 2, opts)[0];
  assert.strictEqual(enJuego.ms, 40000, 'en carrera la meta es el acierto (updated), no el 1er intento');

  // (b) YA puntuada: manda el ms que guardó el settle, aunque `updated` sea
  // ahora la hora del settle (aquí, el segundo 90 para todos).
  const settleIso = at(90);
  // OJO con la forma: `listAnswers` entrega el tiempo como `msTaken` (el campo
  // `ms` de la fila). Mirar solo `r.ms` hacía que el atajo no se activara nunca
  // y todo volviera a derivarse — pasaba en el test y fallaba contra PocketBase.
  const liquidada = rowsFromLiveAnswers([{
    playerId: 'p1', value: 'c', correct: true, scored: true, points: 1,
    msTaken: 40000, created: at(4), updated: settleIso,
  }], 2, opts)[0];
  assert.strictEqual(liquidada.ms, 40000, 'una fila liquidada usa el ms del SERVIDOR, no el `updated` pisado');
  ok('la meta la mide el servidor: se deriva en juego y se conserva tras el settle');
}

// ── 7. El podio ordena bien el caso "falló el último y lo corrigió tarde" ───
{
  const T0 = '2026-08-01T10:00:00.000Z';
  const at = (s2) => new Date(Date.parse(T0) + s2 * 1000).toISOString();
  const opts = { itemOpenedAt: { race: T0 }, phase: 'race' };
  // Filas tal como quedan TRAS el settle: `ms` del servidor, `updated` pisado.
  const raw = [
    ['p1', 'FALLON', 0, 2000], ['p1', 'FALLON', 1, 3000], ['p1', 'FALLON', 2, 40000],
    ['p2', 'CUMPLIDOR', 0, 6000], ['p2', 'CUMPLIDOR', 1, 13000], ['p2', 'CUMPLIDOR', 2, 20000],
  ].map(([player, name, item, ms]) => ({ playerId: player, name, item, value: 'x', correct: true, scored: true, points: 1, msTaken: ms, created: at(2), updated: at(90) }));
  const rows = raw.map(r => rowsFromLiveAnswers([r], r.item, opts)[0]);
  const { players } = buildSessionTable(rows, 3, {});
  assert.deepStrictEqual(players.map(p => p.name), ['CUMPLIDOR', 'FALLON'],
    'gana quien acabó antes DE VERDAD, no quien empezó antes su último ítem');
  assert.strictEqual(mmss(players[1].finishMs), '0:40', 'la meta del que corrigió tarde es su acierto');
  ok('podio: falló el último y lo corrigió tarde ⇒ pierde');
}

// ── 8. NORMAS del adaptador (si es norma, es test) ─────────────────────────
{
  // v1.51.627: el adaptador se partió POR COLECCIÓN — la cita apunta al fichero que recibió el código.
  const src = readFileSync(new URL('../adapters/pocketbase/realtimeAnswers.js', import.meta.url), 'utf8');
  const cut = (from, n) => src.slice(src.indexOf(from), src.indexOf(from) + n);
  const listAnswers = cut('async listAnswers(', 1000);
  assert.match(listAnswers, /created: r\.created/, 'listAnswers debe pasar `created`');
  assert.match(listAnswers, /updated: r\.updated/, 'listAnswers debe pasar `updated`');
  assert.match(listAnswers, /scored: r\.scored/, 'listAnswers debe pasar `scored` (marca "el servidor ya puso su ms")');
  // Los DOS caminos de liquidación guardan el ms del servidor: si uno se olvida,
  // ese ítem pierde su hora de meta en cuanto el PATCH pisa `updated`.
  // Ventana generosa a propósito: es una CITA DE FUENTE (tests/helpers/fuente.mjs)
  // y un corte justo da trabajo cada vez que se añade una línea correcta arriba
  // — pasó al añadir el origen de respaldo del sello (v1.51.436).
  assert.match(cut('async settleItem(', 2200), /ms: scored\.msTaken/, 'settleItem debe persistir el ms del servidor');
  assert.match(cut('async function settlePendingInto(', 2200), /ms: s\.msTaken/, 'settlePending debe persistir el ms del servidor');
  ok('el adaptador conserva y persiste el tiempo del servidor');
}

// ── 9. El modelo de puntos lo decide el BUCLE, no la fase ──────────────────
// La fase es AMBIGUA (`race` y `board` comparten la fase 'race') y transitoria
// (el barrido de cierre liquida con la sala ya en 'ended'). Antes el settle
// miraba la fase: una carrera liquidada al cerrar habría cobrado bonus por velocidad.
{
  assert.strictEqual(pointsModeFor('rounds'), 'live');
  assert.strictEqual(pointsModeFor('claim'), 'live');
  assert.strictEqual(pointsModeFor('race'), 'race');
  assert.strictEqual(pointsModeFor('board'), 'race', 'el tablero también va sin bonus de velocidad');

  // Sala declarada `rounds` liquidada con la fase en 'race': manda el BUCLE.
  const room = createLiveRoom(activity, { code: 'RANK3' });
  const ana = room.join('u-a', 'ANA');
  room.dispatch('start');
  room.state.loop = 'rounds';
  room.state.phase = 'race';
  room.submit(ana.id, 0, '1', 0);
  room.settleAll({ keepPhase: true });
  assert.ok(room.leaderboard(1)[0].score > 500, 'con bucle `rounds` el bonus de velocidad sigue vivo aunque la fase diga race');

  // Y al revés: bucle `race` liquidado con la sala ya cerrada ⇒ plano.
  const r2 = createLiveRoom(activity, { code: 'RANK4' });
  const beto = r2.join('u-b', 'BETO');
  r2.dispatch('start');
  r2.state.loop = 'race';
  r2.state.phase = 'race';
  r2.submit(beto.id, 0, '1', 0);
  r2.state.phase = 'ended';              // el barrido de cierre
  r2.settleAll({ keepPhase: true });
  assert.strictEqual(r2.leaderboard(1)[0].score, 1, 'con bucle `race` los puntos son planos aunque la sala ya esté cerrada');
  ok('el modelo de puntos sale del bucle declarado, no de la fase');
}

console.log(`\n  ${passed} race-rank checks passed`);
