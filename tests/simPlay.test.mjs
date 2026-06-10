// Simulación end-to-end con ALUMNOS VIRTUALES jugando VS y En vivo, sobre el
// motor puro (sin DOM, sin Supabase). Verifica el ciclo completo de juego, no
// solo piezas sueltas. Run: node tests/simPlay.test.mjs
import assert from 'node:assert';
import { createSession, FORMATS, sessionItems } from '../kernel/session/engine.js';
import { createLiveRoom } from '../kernel/live/engine.js';
import { registerTemplate } from '../core/registry.js';
import { scoreQuizSubmission } from '../templates/quiz/scorer.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Plantilla quiz-like real (scorer puro + ronda/payload) para ambos modos.
registerTemplate({
  meta: { name: 'sim_quiz', contentModel: 'qa', modes: { live: true },
          defaultRules: () => ({}), defaultScoring: () => ({}), defaultLive: () => ({}) },
  renderPlayer() {}, renderEditor() {}, renderRound() {},
  scoreSubmission: scoreQuizSubmission,
  getRoundPayload(activity, ctx) { const it = activity.content.items[ctx.itemIndex]; return it ? { question: it.question, options: it.options } : null; },
});

const activity = {
  id: 'sim_a', template: 'sim_quiz',
  scoring: { mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0 },
  live: { maxPlayers: 10, allowLateJoin: true, pointsModel: 'flat' },
  content: { items: [
    { id: 'q1', question: '2+2', answer: '4', options: ['3', '4', '5'], points: 1 },
    { id: 'q2', question: '3×3', answer: '9', options: ['6', '9', '12'], points: 2 },
    { id: 'q3', question: '10-4', answer: '6', options: ['5', '6', '7'], points: 1 },
  ] },
};
const items = sessionItems(activity);
const wrongFor = (it) => it.options.find(o => o !== it.answer);

// ───────────────────────── VS: dos alumnos en carrera ─────────────────────────
{
  const s = createSession(activity, { format: FORMATS.VS, left: 'Ana', right: 'Beto' });
  s.start();
  // Alumnos virtuales: Ana acierta siempre; Beto falla siempre. Responden
  // intercalados (como en una pantalla compartida) hasta que alguien termina.
  let guard = 0;
  while (!s.standings().finished && guard++ < 50) {
    const st = s.standings();
    if (s.status === 'running' && st.left.cursor < items.length) s.answer('left', items[st.left.cursor].answer);
    if (s.status === 'running' && st.right.cursor < items.length) s.answer('right', wrongFor(items[st.right.cursor]));
  }
  const fin = s.standings();
  assert.strictEqual(s.status, 'ended', 'el duelo termina');
  assert.strictEqual(fin.finished, true);
  assert.strictEqual(fin.leader, 'left', 'Ana (acierta todo) gana');
  assert.strictEqual(fin.left.cursor, items.length, 'Ana terminó todas');
  assert.ok(fin.right.cursor < items.length, 'la carrera acabó al ganar Ana: Beto NO siguió jugando');
  assert.strictEqual(fin.right.score, 0, 'Beto falló todo → 0');
  ok(`VS: 2 alumnos virtuales, gana ${fin.left.name} ${fin.left.score}–${fin.right.score} y el otro no juega de más`);
}

// ───────────────────── En vivo: varios alumnos virtuales ──────────────────────
{
  const room = createLiveRoom(activity, { code: 'SIM123' });
  // Tres alumnos con distinta "habilidad": A acierta todo, B solo la 1ª, C nada.
  const students = [
    { p: room.join('u-a', 'Alumno A'), skill: () => true },
    { p: room.join('u-b', 'Alumno B'), skill: (i) => i === 0 },
    { p: room.join('u-c', 'Alumno C'), skill: () => false },
  ];
  assert.strictEqual(room.state.players.length, 3, 'tres alumnos en el lobby');

  room.dispatch('start');
  for (let i = 0; i < items.length; i++) {
    assert.strictEqual(room.currentItem, i, `ronda ${i}`);
    const it = items[i];
    students.forEach((s, k) => room.submit(s.p.id, i, s.skill(i) ? it.answer : wrongFor(it), 300 + k * 50));
    room.dispatch('reveal'); // settle (puntuación anti-trampa en el servidor)
    if (i < items.length - 1) { room.dispatch('leaderboard'); room.dispatch('next'); }
    else room.dispatch('next'); // última → fin
  }
  assert.strictEqual(room.phase, 'ended', 'la partida en vivo termina');

  // A: 1+2+1=4 · B: solo q1 = 1 · C: 0
  const final = room.leaderboard();
  assert.deepStrictEqual(final.map(r => [r.name, r.score]),
    [['Alumno A', 4], ['Alumno B', 1], ['Alumno C', 0]], 'ranking final por puntos');
  ok('En vivo: 3 alumnos virtuales juegan 3 rondas; ranking final correcto (A 4 · B 1 · C 0)');
}

console.log(`\nsimPlay.test: ${passed} checks passed`);
