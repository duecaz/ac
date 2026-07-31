// R-1/R-2 · EL BUCLE DE RONDAS: LECTURA ANTES DE RESPONDER, Y EL RITMO COMO
// INSTANTE DE LA SALA (docs/estudio-bucles-live.md, ficha 1b).
//
// El problema que cierra: enunciado y opciones aparecían a la vez, con bonus por
// velocidad — así que ganaba quien hacía clic antes de leer, y el alumno que leía
// la pregunta entera ya había perdido los puntos. Kahoot separa "leer" de
// "responder" desde su primera versión.
//
// Y la regla que se deriva y hay que proteger: **el ritmo se escribe como
// INSTANTE en la fila de la sala, nunca como un temporizador local**. Un
// setTimeout por móvil se desincroniza (el de peor red juega con menos tiempo),
// no sobrevive a recargar ni a entrar tarde, y no es verificable en el servidor.
//
// Run: node tests/roundsLoop.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { readSeconds, readWindowMs, questionWindowMs, READ_SECONDS_DEFAULT, READ_SECONDS_MAX } from '../core/timings.js';
import { createLocalRealtime } from '../adapters/local/realtime.js';
import { registerTemplate } from '../core/registry.js';
import { scoreQuizSubmission } from '../templates/quiz/scorer.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const read = (p) => readFileSync(new URL(p, new URL('..', import.meta.url)), 'utf8');

// ── 1. La ventana de lectura: valor por defecto, tope y 0 explícito ────────
{
  assert.strictEqual(readSeconds({}), READ_SECONDS_DEFAULT, 'sin configurar hay lectura por defecto');
  assert.strictEqual(readSeconds({ live: { readSeconds: 0 } }), 0, '0 = responder al instante (retrocompatible)');
  assert.strictEqual(readSeconds({ live: { readSeconds: 7 } }), 7);
  assert.strictEqual(readSeconds({ live: { readSeconds: 999 } }), READ_SECONDS_MAX, 'hay tope: una lectura eterna congela la clase');
  assert.strictEqual(readSeconds({ live: { readSeconds: -3 } }), 0, 'negativo no resta tiempo de respuesta');
  assert.strictEqual(readSeconds({ live: { readSeconds: 'x' } }), 0, 'basura no rompe el arranque de la pregunta');
  assert.strictEqual(readWindowMs({ live: { readSeconds: 3 } }), 3000);
  ok('ventana de lectura: por defecto, 0 explícito, tope y entradas basura');
}

// ── 2. La lectura NO se descuenta del tiempo de respuesta ──────────────────
{
  const act = { live: { questionTimer: 20, readSeconds: 5 } };
  assert.strictEqual(questionWindowMs(act), 20000,
    'el cronómetro de respuesta sigue siendo el declarado: la lectura se SUMA, no se roba');
  ok('la lectura no recorta el tiempo de responder');
}

// ── 3. El ritmo viaja como INSTANTE en la sala (ida y vuelta real) ─────────
{
  registerTemplate({
    meta: { name: 'qrounds', contentModel: 'qa', modes: { live: true }, play: { live: ['rounds'] },
            defaultRules: () => ({}), defaultScoring: () => ({}), defaultLive: () => ({}) },
    renderPlayer() {}, renderEditor() {},
    scoreSubmission: scoreQuizSubmission,
    getRoundPayload: (a, ctx) => ({ question: a.content.items[ctx.itemIndex].question }),
  });
  const m = new Map();
  const kv = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), get length() { return m.size; }, key: (i) => [...m.keys()][i] };
  const rt = createLocalRealtime({ kv, makeChannel: () => ({ addEventListener() {}, removeEventListener() {}, postMessage() {}, close() {} }), userId: 'u1' });
  const activity = { id: 'a1', template: 'qrounds', scoring: {}, live: {}, content: { items: [
    { id: 'q1', question: '2+2', answer: '4', options: ['3', '4'], points: 1 },
    { id: 'q2', question: '3+3', answer: '6', options: ['6', '7'], points: 1 },
  ] } };
  const { code } = await rt.createRoom(activity);
  const openAt = '2026-08-01T10:00:03.000Z';
  const deadline = '2026-08-01T10:00:23.000Z';
  await rt.setSessionState(code, { status: 'running', phase: 'question', current_item: 0, answers_open_at: openAt, deadline });
  const sess = await rt.fetchSession(code);
  assert.strictEqual(sess.answers_open_at, openAt,
    'el instante de apertura de respuestas viaja en la SALA (todos los móviles leen el mismo)');
  assert.strictEqual(sess.deadline, deadline);
  // Y se puede limpiar (la carrera no tiene lectura).
  await rt.setSessionState(code, { phase: 'race', answers_open_at: null, deadline: null });
  assert.strictEqual((await rt.fetchSession(code)).answers_open_at, null, 'se puede quitar (la carrera no lee por rondas)');
  ok('el instante de apertura viaja por la sala en el driver local (ida y vuelta)');
}

// ── 3b. El adaptador de PocketBase lo mapea igual (mismo contrato) ─────────
{
  const pb = read('adapters/pocketbase/realtime.js');
  assert.match(pb, /'answers_open_at' in patch/, 'setSessionState de PB acepta answers_open_at');
  assert.match(pb, /answers_open_at: rec\.state\?\.answersOpenAt/, 'y lo devuelve al leer la sala');
  assert.strictEqual((pb.match(/answers_open_at: rec\.state\?\.answersOpenAt/g) || []).length, 2,
    'lo devuelven LAS DOS lecturas (findRoomByCode y fetchSession): si falta en una, el alumno que entra por PIN no ve la lectura');
  ok('el adaptador PocketBase mapea el instante igual que el local');
}

// ── 4. NADIE reintroduce un temporizador local para el ritmo ───────────────
// La regla en forma de test: el host escribe instantes; el móvil los LEE.
{
  const host = read('views/hostLive.js');
  assert.match(host, /function openQuestion\(/, 'abrir pregunta es UNA función (los dos instantes en un solo PATCH)');
  assert.match(host, /answers_open_at: new Date\(openAt\)/, 'y escribe el instante de apertura');
  // Ningún camino de "siguiente pregunta" puede saltarse openQuestion().
  // Solo cuentan los que ABREN un ítem (los `phase:'question'` de renderRoundHost
  // son el argumento de pintado, no un cambio de fase de la sala).
  const opens = (host.match(/phase: 'question', current_item/g) || []).length;
  assert.strictEqual(opens, 1,
    `hay ${opens} sitios que abren la fase 'question': debe ser SOLO openQuestion(), o un camino se quedará sin lectura`);
  const student = read('views/studentLive.js');
  assert.match(student, /session\.answers_open_at/, 'el alumno lee el instante de la sala');
  assert.match(student, /lastQuestionShownAt = openAtMs \|\| clock\.now\(\)/,
    'el ms se mide desde la apertura REAL, no desde que este móvil pintó (si no, el bonus premia al de mejor red)');
  ok('el ritmo lo escribe el host como instante y el alumno solo lo lee');
}

// ── 5. R-2: el alumno ve su puesto y su distancia, del marcador del servidor ─
{
  const student = read('views/studentLive.js');
  assert.match(student, /await leaderboard\(session\.id/, 'el puesto sale del marcador DERIVADO del servidor, no de una cuenta local');
  assert.match(student, /standing\.rank/, 'y se pinta el puesto');
  assert.match(student, /puntos' } de \$\{escapeHtml\(standing\.aboveName\)\}|de \$\{escapeHtml\(standing\.aboveName\)\}/,
    'con la distancia al de arriba (el motor de enganche de Kahoot)');
  assert.match(student, /vas primero/, 'y el caso de ir primero está contemplado');
  ok('R-2: puesto y distancia en el móvil, desde la misma fuente que el podio');
}

console.log(`\nroundsLoop.test: ${passed} checks passed`);
