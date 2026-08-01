// CARRERA: gana quien TERMINA PRIMERO CON TODAS BIEN.
//
// Definición del usuario: «la idea de la carrera es quien termina primero con
// todas bien, no que haya más puntos por velocidad». Medido antes del arreglo
// (tres navegadores contra PocketBase real): RAPIDO, con 2 aciertos de 5 en los
// primeros segundos, hacía 2997 puntos y GANABA a LENTO, que acertó las 5 (2500).
// El bonus de velocidad de Kahoot convertía la carrera en "quien madruga".
//
// Dos reglas, dos sitios:
//   · puntos PLANOS en carrera  → kernel/session/engine.js (mode 'race')
//   · empate ⇒ quien llegó ANTES → core/liveRank.js (hora de meta)
// Y la CONTRA-PRUEBA: en rondas el bonus de velocidad sigue intacto.
//
// Run: node tests/raceRank.test.mjs
import assert from 'node:assert';
import { rankPlayers, tallyRows } from '../core/liveRank.js';
import { awardPoints } from '../core/scoring/index.js';
import { createLiveRoom } from '../kernel/live/engine.js';
import { registerTemplate } from '../core/registry.js';
import { scoreQuizSubmission } from '../templates/quiz/scorer.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const activity = {
  id: 'r', template: 'quiz-rank', title: 'Carrera',
  live: { pointsModel: 'kahoot', speedBonusMax: 1000, questionTimer: 20 },
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

console.log(`\n  ${passed} race-rank checks passed`);
