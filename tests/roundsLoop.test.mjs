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
import { standingOf } from '../core/liveRank.js';
import { citaDeFuente } from './helpers/fuente.mjs';
import { readFileSync } from 'node:fs';
import { readSeconds, readWindowMs, questionWindowMs, READ_SECONDS_DEFAULT, READ_SECONDS_MAX,
         itemSeconds, itemWindowMs, ITEM_SECONDS_MIN, ITEM_SECONDS_MAX } from '../core/timings.js';
import { awardPoints } from '../core/scoring/index.js';
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

// ── 2b. R-3 · TIEMPO POR PREGUNTA: el ítem manda, la actividad es el defecto ─
{
  const act = { live: { questionTimer: 20 } };
  assert.strictEqual(itemSeconds(act, {}), 20, 'un ítem sin tiempo propio hereda el de la actividad');
  assert.strictEqual(itemSeconds(act, { seconds: 60 }), 60, 'y si lo declara, manda el suyo');
  assert.strictEqual(itemSeconds(act, { seconds: 9999 }), ITEM_SECONDS_MAX, 'con tope');
  assert.strictEqual(itemSeconds(act, { seconds: 1 }), ITEM_SECONDS_MIN, 'y con suelo (1 s no es jugable)');
  assert.strictEqual(itemSeconds(act, { seconds: 0 }), 20, '0 = heredar, no "sin tiempo"');
  assert.strictEqual(itemSeconds(act, { seconds: 'x' }), 20, 'basura → hereda');
  assert.strictEqual(itemWindowMs(act, { seconds: 45 }), 45000);
  // Contra-prueba de compatibilidad: contenido ANTIGUO (sin el campo) se comporta igual.
  assert.strictEqual(itemWindowMs(act, { question: 'vieja' }), questionWindowMs(act),
    'una actividad anterior a R-3 mantiene EXACTAMENTE su ventana (por eso no hace falta migrar)');
  ok('R-3: el ítem declara su tiempo, con suelo/tope, y sin declararlo hereda');
}

// ── 2c. El BONUS de velocidad usa la ventana DEL ÍTEM ─────────────────────
// El fallo silencioso que esto evita: con tiempo por pregunta, dividir por la
// ventana de la ACTIVIDAD da bonus de más en las largas y de menos en las
// cortas — nadie lo vería, solo saldrían puntos raros.
{
  // En vivo el bonus lo activa `live.pointsModel` (no `scoring.mode`) — ver useKahoot.
  const act = { scoring: { pointsPerCorrect: 1 }, live: { pointsModel: 'kahoot', questionTimer: 20, speedBonusMax: 1000 } };
  const half = (secs) => awardPoints({ correct: true, item: { seconds: secs }, msTaken: secs * 1000 / 2, activity: act, mode: 'live' });
  // Responder a MITAD de ventana debe dar el mismo bonus, dure 20 s o 60 s.
  assert.strictEqual(half(20), half(60),
    'a mitad de su ventana, el bonus es el mismo en una pregunta corta y en una larga');
  const early = awardPoints({ correct: true, item: { seconds: 60 }, msTaken: 1000, activity: act, mode: 'live' });
  const late = awardPoints({ correct: true, item: { seconds: 60 }, msTaken: 59000, activity: act, mode: 'live' });
  assert.ok(early > late, 'responder pronto sigue dando más que responder tarde');
  // Sin tiempo propio, el bonus es exactamente el de antes.
  assert.strictEqual(awardPoints({ correct: true, item: {}, msTaken: 10000, activity: act, mode: 'live' }),
                     awardPoints({ correct: true, item: { seconds: 20 }, msTaken: 10000, activity: act, mode: 'live' }),
                     'un ítem sin tiempo propio puntúa igual que uno que declare el de la actividad');
  ok('el bonus de velocidad se calcula con la ventana del ítem, no con la de la actividad');
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
  // §22-5: el respaldo ya no es el reloj del móvil sino la HORA COMÚN — un
  // aparato desfasado afirmaba un `ms` torcido (el servidor lo re-deriva, pero
  // el respaldo no puede mentir por sistema).
  assert.match(student, /lastQuestionShownAt = openAtMs \|\| serverNow\(\)/,
    'el ms se mide desde la apertura REAL, no desde que este móvil pintó (si no, el bonus premia al de mejor red)');
  assert.match(host, /itemWindowMs\(activity, items\[idx\]\)/,
    'el host cierra con la ventana DEL ÍTEM (R-3)');
  assert.match(student, /deadlineMs - openAtMs/,
    'y el alumno DERIVA la ventana de los dos instantes: así la barra cuadra con el reloj '
    + 'y los segundos no tienen que viajar en el snapshot (§22-2)');
  ok('el ritmo lo escribe el host como instante y el alumno solo lo lee');
}

// ── 5. R-2: el alumno ve su puesto y su distancia, del marcador del servidor ─
// Esto se comprobaba CITANDO LÍNEAS de `studentLive` («que aparezca
// standing.rank»). Ahora el cálculo vive en el dueño del ranking
// (`core/liveRank.js standingOf`, §21) y se ejecuta de verdad: se comprueban
// NÚMEROS, que es lo que le importa al alumno.
{
  const lb = [
    { id: 'a', name: 'Ana',  score: 900 },
    { id: 'b', name: 'Beto', score: 700 },
    { id: 'c', name: 'Caro', score: 700 },
    { id: 'd', name: 'Dani', score: 100 },
  ];
  const beto = standingOf(lb, 'b');
  assert.strictEqual(beto.rank, 2, 'el puesto es la posición en el marcador del servidor');
  assert.strictEqual(beto.total, 4);
  assert.strictEqual(beto.gap, 200, 'la distancia al de ARRIBA es lo que engancha entre preguntas');
  assert.strictEqual(beto.aboveName, 'Ana', 'y se dice de quién');

  const ana = standingOf(lb, 'a');
  assert.strictEqual(ana.rank, 1);
  assert.strictEqual(ana.aboveName, null, 'el primero no tiene a nadie arriba (la vista pinta «¡vas primero!»)');
  assert.strictEqual(ana.gap, 0);

  const caro = standingOf(lb, 'c');
  assert.strictEqual(caro.gap, 0, 'empatado: distancia 0');
  assert.strictEqual(caro.aboveName, 'Beto', 'y con quién empata');

  assert.strictEqual(standingOf(lb, 'zz'), null, 'quien no está en el marcador no rompe la pantalla');
  assert.strictEqual(standingOf(null, 'a'), null, 'ni un marcador que no llegó');

  // Lo único que SIGUE siendo cita de fuente: que la vista use al dueño en vez
  // de recalcularlo por su cuenta. Eso no se puede ejecutar, solo leer.
  citaDeFuente(read('views/studentLive.js'), /standingOf\(await leaderboard\(/,
    'el móvil pide el puesto al dueño del ranking, no lo cuenta él', 'views/studentLive.js');
  ok('R-2: puesto, distancia y empate SE CALCULAN bien (números, no líneas de código)');
}

console.log(`\nroundsLoop.test: ${passed} checks passed`);
