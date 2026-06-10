// Self-tests EJECUTABLES EN EL NAVEGADOR para la página Admin. Los tests de
// Node (tests/*.mjs) usan node:assert y no corren aquí; esto reimplementa una
// batería representativa sobre los MÓDULOS PUROS REALES (registro, motor de
// sesión, motor live, scorer), incluyendo simulaciones con alumnos virtuales.
// Es un humo en vivo; la suite completa sigue siendo `node tests/run.mjs` (CI).
import { listTemplates, getTemplate } from './registry.js';
import { modesForTemplate } from './modes.js';
import { templateCapabilities } from './modeMatrix.js';
import { createSession, FORMATS, sessionItems, isVsCompatible } from '../kernel/session/engine.js';
import { createLiveRoom } from '../kernel/live/engine.js';
import { scoreQuizSubmission } from '../templates/quiz/scorer.js';

// Actividad quiz sintética (no toca storage) para las simulaciones.
function quizActivity() {
  return {
    id: 'selftest', template: 'quiz',
    scoring: { mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0 },
    live: { maxPlayers: 10, allowLateJoin: true, pointsModel: 'flat' },
    content: { items: [
      { id: 'q1', question: '2+2', answer: '4', options: ['3', '4', '5'], points: 1 },
      { id: 'q2', question: '3×3', answer: '9', options: ['6', '9', '12'], points: 2 },
      { id: 'q3', question: '10-4', answer: '6', options: ['5', '6', '7'], points: 1 },
    ] },
  };
}
const wrongFor = (it) => it.options.find(o => o !== it.answer);

const TESTS = [
  { group: 'Registro', name: 'hay plantillas registradas', fn: () => {
    if (listTemplates().length === 0) throw new Error('registro vacío');
  } },
  { group: 'Registro', name: 'quiz ofrece individual·vs·equipos·en vivo·tarea', fn: () => {
    const T = getTemplate('quiz');
    if (!T) throw new Error('falta la plantilla quiz');
    const ids = modesForTemplate(T).map(m => m.id);
    for (const need of ['solo', 'vs', 'teams', 'live', 'task'])
      if (!ids.includes(need)) throw new Error(`quiz no ofrece ${need} (¿le falta un método?)`);
  } },
  { group: 'Panel', name: 'la matriz de capacidad es coherente', fn: () => {
    const caps = templateCapabilities();
    if (!caps.length) throw new Error('matriz vacía');
    const q = caps.find(c => c.name === 'quiz');
    if (!q || !q.modes.find(m => m.id === 'vs').supported) throw new Error('quiz debería soportar VS en la matriz');
  } },
  { group: 'Scorer', name: 'quiz puntúa acierto/fallo', fn: () => {
    const it = { answer: '4', options: ['3', '4'], points: 1 };
    const okR = scoreQuizSubmission({ value: '4', item: it, activity: { scoring: {} } });
    const noR = scoreQuizSubmission({ value: '3', item: it, activity: { scoring: {} } });
    if (!(okR.correct === true && okR.points >= 1)) throw new Error('acierto mal puntuado');
    if (noR.correct !== false) throw new Error('fallo mal puntuado');
  } },
  { group: 'VS', name: 'duelo: gana quien acierta y el otro NO sigue', fn: () => {
    const a = quizActivity();
    if (!isVsCompatible(a)) throw new Error('quiz debería ser VS-compatible');
    const items = sessionItems(a);
    const s = createSession(a, { format: FORMATS.VS, left: 'Ana', right: 'Beto' });
    s.start();
    let guard = 0;
    while (!s.standings().finished && guard++ < 50) {
      const st = s.standings();
      if (s.status === 'running' && st.left.cursor < items.length) s.answer('left', items[st.left.cursor].answer);
      if (s.status === 'running' && st.right.cursor < items.length) s.answer('right', wrongFor(items[st.right.cursor]));
    }
    const fin = s.standings();
    if (s.status !== 'ended') throw new Error('el duelo no terminó');
    if (fin.leader !== 'left') throw new Error('debería ganar Ana');
    if (fin.right.cursor >= items.length) throw new Error('Beto siguió jugando tras la victoria (debería parar)');
  } },
  { group: 'En vivo', name: 'sala: 3 alumnos virtuales, ranking final correcto', fn: () => {
    const a = quizActivity();
    const items = sessionItems(a);
    const room = createLiveRoom(a, { code: 'SELFT1' });
    const studs = [
      { p: room.join('u-a', 'A'), skill: () => true },
      { p: room.join('u-b', 'B'), skill: (i) => i === 0 },
      { p: room.join('u-c', 'C'), skill: () => false },
    ];
    room.dispatch('start');
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      studs.forEach((s, k) => room.submit(s.p.id, i, s.skill(i) ? it.answer : wrongFor(it), 300 + k * 50));
      room.dispatch('reveal');
      if (i < items.length - 1) { room.dispatch('leaderboard'); room.dispatch('next'); }
      else room.dispatch('next');
    }
    if (room.phase !== 'ended') throw new Error('la partida no terminó');
    const order = room.leaderboard().map(r => `${r.name}:${r.score}`).join(',');
    if (order !== 'A:4,B:1,C:0') throw new Error('ranking final inesperado: ' + order);
  } },
];

/** Ejecuta todos y devuelve [{ group, name, pass, error }]. */
export async function runSelfTests() {
  const out = [];
  for (const t of TESTS) {
    try { await t.fn(); out.push({ group: t.group, name: t.name, pass: true }); }
    catch (e) { out.push({ group: t.group, name: t.name, pass: false, error: e.message }); }
  }
  return out;
}
