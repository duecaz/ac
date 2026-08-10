// §22-1 — EL TIEMPO QUE PUNTÚA LO MIDE EL SERVIDOR.
//
// El bonus de velocidad se calculaba con el `ms` del móvil: enviar `ms:0` (o
// atrasar el reloj del teléfono) cobraba el bonus máximo en cada pregunta, sin
// DevTools. Aquí se fija que el host DERIVA el tiempo de los autodate de la fila
// contra el sello de apertura del ítem, y que la afirmación del alumno solo se
// usa cuando no hay marcas de servidor.
//
// Dos niveles, como en liveRules: la función pura, y el ADAPTADOR REAL con
// `fetch` inyectado (que es donde vive el sello y el cableado).
//
// Run: node tests/serverMs.test.mjs
import assert from 'node:assert';
import { deriveAnswerMs, openedKey, openedAtFor, origenServidor } from '../core/serverMs.js';
import { registerTemplate } from '../core/registry.js';
import { createPocketbaseRealtime } from '../adapters/pocketbase/realtime.js';
import { awardPoints } from '../core/scoring/award.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── 1. La función pura ──────────────────────────────────────────────────────
{
  // 12 s reales aunque el móvil jure que respondió al instante.
  const r = deriveAnswerMs({
    createdAt: '2026-07-30 10:00:12.000Z', openedAt: '2026-07-30 10:00:00.000Z',
    claimedMs: 0, phase: 'question',
  });
  assert.deepStrictEqual(r, { ms: 12000, source: 'server' }, 'gana el reloj del servidor, no el ms afirmado');

  // Formato con T (por si PB cambia el serializador) y milisegundos.
  assert.strictEqual(deriveAnswerMs({
    createdAt: '2026-07-30T10:00:03.500Z', openedAt: '2026-07-30T10:00:00.000Z', phase: 'question',
  }).ms, 3500, 'acepta el ISO con T');

  // Nunca negativo: un sello más nuevo que la fila regalaría bonus máximo.
  assert.strictEqual(deriveAnswerMs({
    createdAt: '2026-07-30 10:00:00.000Z', openedAt: '2026-07-30 10:00:05.000Z', phase: 'question',
  }).ms, 0, 'se acota a 0 en vez de dar un ms negativo');

  // CARRERA: la fila se reintenta, así que cuenta el instante del acierto
  // (`updated`), no el del primer intento (`created`).
  assert.strictEqual(deriveAnswerMs({
    createdAt: '2026-07-30 10:00:01.000Z', updatedAt: '2026-07-30 10:00:09.000Z',
    openedAt: '2026-07-30 10:00:00.000Z', phase: 'race',
  }).ms, 9000, 'en carrera manda el instante del acierto');
  assert.strictEqual(deriveAnswerMs({
    createdAt: '2026-07-30 10:00:01.000Z', updatedAt: '2026-07-30 10:00:09.000Z',
    openedAt: '2026-07-30 10:00:00.000Z', phase: 'question',
  }).ms, 1000, 'en fase pregunta manda el instante de creación');

  // FALLBACK honesto y VISIBLE: sin sello (driver local, sala vieja, host
  // recargado) se usa el ms afirmado, pero marcado como tal.
  assert.deepStrictEqual(deriveAnswerMs({ createdAt: '2026-07-30 10:00:12.000Z', claimedMs: 4200 }),
    { ms: 4200, source: 'claimed' }, 'sin sello de apertura → respaldo al ms del cliente');
  assert.deepStrictEqual(deriveAnswerMs({ openedAt: '2026-07-30 10:00:00.000Z', claimedMs: 4200 }),
    { ms: 4200, source: 'claimed' }, 'sin marca de fila → respaldo al ms del cliente');
  assert.deepStrictEqual(deriveAnswerMs({ claimedMs: -5 }), { ms: 0, source: 'claimed' },
    'un ms afirmado negativo no pasa');
  ok('deriveAnswerMs: reloj del servidor, carrera por `updated`, respaldo marcado');
}

// ── 1b. SIN SELLO, el orden sigue siendo del SERVIDOR ────────────────────────
// Visto en la Pi con el botón de carrera: el sello (PATCH aparte, fallo mudo)
// no entró y los dos alumnos salieron con el MISMO tiempo — el que afirmaban
// sus móviles —, así que el podio ordenaba por nombre. Con el origen de
// respaldo, el orden vuelve a salir de marcas del servidor.
{
  const filas = [
    { created: '2026-07-30 10:00:02.000Z', updated: '2026-07-30 10:00:05.000Z', ms: 300 },  // rápido
    { created: '2026-07-30 10:00:03.000Z', updated: '2026-07-30 10:00:17.000Z', ms: 300 },  // lento
  ];
  const origen = origenServidor(filas);
  assert.strictEqual(origen, '2026-07-30T10:00:02.000Z', 'origen = el `created` más temprano de la sala');
  const [a, b] = filas.map(f => deriveAnswerMs({
    createdAt: f.created, updatedAt: f.updated, openedAt: origen, claimedMs: f.ms, phase: 'race',
  }));
  assert.strictEqual(a.source, 'server', 'se mide con el servidor, no con el ms del móvil');
  assert.ok(b.ms > a.ms + 10000, `el lento queda detrás por sus segundos reales (${a.ms} vs ${b.ms})`);
  // CONTRA-PRUEBA: sin origen los dos empatan en el ms que afirmaron (el fallo).
  const empate = filas.map(f => deriveAnswerMs({
    createdAt: f.created, updatedAt: f.updated, claimedMs: f.ms, phase: 'race',
  }));
  assert.strictEqual(empate[0].ms, empate[1].ms, 'contra-prueba: sin origen, empate en el ms afirmado');
  assert.strictEqual(origenServidor([]), null, 'sin filas no hay origen que inventar');
  ok('origenServidor: sin sello, el ORDEN de la carrera lo sigue poniendo el servidor');
}

// ── 2. El sello por ítem ────────────────────────────────────────────────────
{
  assert.strictEqual(openedKey('question', 3), '3');
  assert.strictEqual(openedKey('race', 3), 'race', 'en carrera todos los ítems se abren a la vez');
  const map = { 0: 'A', 2: 'C', race: 'R' };
  assert.strictEqual(openedAtFor(map, 2, 'question'), 'C');
  assert.strictEqual(openedAtFor(map, 7, 'race'), 'R', 'carrera cae al sello único');
  assert.strictEqual(openedAtFor(map, 7, 'question'), 'R', 'sin sello del ítem, respaldo al de carrera');
  assert.strictEqual(openedAtFor(null, 1, 'question'), null, 'sin mapa, sin sello');
  ok('openedKey/openedAtFor: un sello por ítem y uno solo para la carrera');
}

// ── 3. El adaptador REAL: sella al abrir y puntúa con ESE reloj ─────────────
registerTemplate({
  meta: { name: 'sms_quiz', label: 'SMS', contentModel: 'qa', modes: { solo: true, live: true } },
  renderPlayer() {}, renderEditor() {}, renderRound() {}, getRoundPayload() { return {}; },
  scoreSubmission({ value, item, msTaken, activity, mode }) {
    const correct = value === item.a;
    return { correct, points: awardPoints({ correct, item, msTaken, activity, mode }) };
  },
});

const ACTIVITY = {
  id: 'a1', template: 'sms_quiz',
  // Kahoot: los puntos DEPENDEN del tiempo → es donde mentir con `ms` pagaba.
  live: { pointsModel: 'kahoot', questionTimer: 20, speedBonusMax: 1000 },
  content: { items: [{ q: '2+2', a: '4', points: 1 }] },
};

// Guion de PocketBase: la sala guarda su blob de verdad (lo que PATCHea el host),
// y la fila de respuesta trae los autodate que pone el servidor.
function makeFetch({ createdAt, claimedMs }) {
  const state = { status: 'running', phase: 'question', currentItem: 0, players: [{ id: 'p1', name: 'Ana', score: 0 }], answers: {} };
  const patches = [];
  let now = Date.parse('2026-07-30T10:00:00.000Z');
  const res = (status, obj) => ({ status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(obj ?? {}), json: async () => obj ?? {} });
  const sessionRec = () => ({ id: 'sess1', code: 'ABCDE', activity: ACTIVITY, state, ql: {} });
  const fetch = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    if (method === 'PATCH' && url.includes('/live_sessions/records/sess1')) {
      const body = JSON.parse(opts.body);
      if (body.state) Object.assign(state, body.state);
      patches.push(body);
      // El servidor pone `updated` con SU reloj: es el sello de apertura.
      return res(200, { ...sessionRec(), updated: new Date(now).toISOString().replace('T', ' ') });
    }
    if (method === 'PATCH' && url.includes('/live_answers/records/')) {
      patches.push({ answer: JSON.parse(opts.body) });
      return res(200, {});
    }
    if (url.includes('/live_answers/records')) {
      return res(200, { items: [{
        id: 'ans1', session: 'sess1', player: 'p1', item: 0, value: '4',
        ms: claimedMs, scored: false, correct: false, points: 0,
        created: createdAt, updated: createdAt,
      }], totalItems: 1 });
    }
    if (url.includes('/live_sessions/records/sess1')) return res(200, sessionRec());
    if (url.includes('/live_sessions/records')) return res(200, { items: [sessionRec()], totalItems: 1 });
    return res(200, {});
  };
  return { fetch, state, patches };
}

// Ana responde bien 12 s después de abrirse la pregunta, pero su móvil AFIRMA
// ms:0 (bonus máximo). El host debe puntuarla por los 12 s reales.
{
  const { fetch, state, patches } = makeFetch({ createdAt: '2026-07-30 10:00:12.000Z', claimedMs: 0 });
  global.fetch = fetch;
  const rt = createPocketbaseRealtime({ userId: 'host' });

  await rt.setSessionState('sess1', { status: 'running', phase: 'question', current_item: 0, deadline: null });
  assert.ok(state.itemOpenedAt, 'abrir la pregunta SELLA el instante servidor en el blob');
  assert.strictEqual(state.itemOpenedAt['0'], '2026-07-30 10:00:00.000Z', 'el sello es el `updated` del servidor');
  ok('el host sella la apertura del ítem con el reloj del servidor (host-only)');

  await rt.settleItem('sess1', 0);
  const verdict = patches.map(p => p.answer).find(Boolean);
  assert.ok(verdict, 'el settle escribe el veredicto en la fila');
  assert.strictEqual(verdict.correct, true, 'la respuesta era correcta');
  // 12 s de 20 → queda 40% de ventana → 500·1 + 1000·0.4 = 900.
  const honest = awardPoints({ correct: true, item: ACTIVITY.content.items[0], msTaken: 12000, activity: ACTIVITY, mode: 'live' });
  const cheated = awardPoints({ correct: true, item: ACTIVITY.content.items[0], msTaken: 0, activity: ACTIVITY, mode: 'live' });
  assert.notStrictEqual(honest, cheated, 'premisa del test: en Kahoot el tiempo CAMBIA los puntos');
  assert.strictEqual(verdict.points, honest, `debe puntuar por los 12 s reales (${honest}), no por el ms:0 afirmado (${cheated})`);
  ok('mentir con ms:0 ya NO cobra el bonus: puntúa el tiempo del servidor');
}

// Contra-prueba: quien responde de verdad rápido SÍ cobra su bonus (una regla
// demasiado cerrada se descubre con la clase delante).
{
  const { fetch, patches } = makeFetch({ createdAt: '2026-07-30 10:00:02.000Z', claimedMs: 99999 });
  global.fetch = fetch;
  const rt = createPocketbaseRealtime({ userId: 'host' });
  await rt.setSessionState('sess1', { status: 'running', phase: 'question', current_item: 0, deadline: null });
  await rt.settleItem('sess1', 0);
  const verdict = patches.map(p => p.answer).find(Boolean);
  const fast = awardPoints({ correct: true, item: ACTIVITY.content.items[0], msTaken: 2000, activity: ACTIVITY, mode: 'live' });
  assert.strictEqual(verdict.points, fast, 'el que responde rápido de verdad cobra su bonus (y el ms inflado no le castiga)');
  ok('contra-prueba: el alumno rápido de verdad conserva su bonus');
}

console.log(`\nserverMs.test: ${passed} checks passed`);
