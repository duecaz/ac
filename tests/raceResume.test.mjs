// CARRERA: fallar una pregunta re-encola SOLO esa, y una recarga REANUDA.
//
// Bug real (primera partida en producción, v1.51.334): la cola de la carrera
// era estado en memoria del móvil; una recarga a mitad de carrera (F5, bloqueo
// de pantalla, o la auto-actualización de versión) la reconstruía con TODOS los
// ítems y el alumno repetía lo ya acertado. "Solo la que falló debía volver a
// la cola."
//
// Run: node tests/raceResume.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { raceResumeState } from '../core/raceResume.js';
import { createLocalRealtime } from '../adapters/local/realtime.js';
import { registerTemplate } from '../core/registry.js';
import { scoreQuizSubmission } from '../templates/quiz/scorer.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── 1. Siembra pura: lo acertado NO vuelve; lo fallado y lo nuevo SÍ ────────
{
  // 5 ítems; el alumno acertó 0 y 2, falló el 1 (sin puntuar → correct null),
  // y no ha visto 3 ni 4.
  const rows = [
    { itemIndex: 0, correct: true, points: 0 },
    { itemIndex: 1, correct: null, points: 0 },
    { itemIndex: 2, correct: true, points: 0 },
  ];
  const s = raceResumeState(5, rows);
  assert.deepStrictEqual(s.queue, [1, 3, 4], 'la cola reanuda con el fallado + los no vistos, en orden');
  assert.strictEqual(s.correctCount, 2, 'el contador de aciertos se siembra');
  assert.deepStrictEqual([...s.firstSent].sort(), [0, 1, 2], 'los ítems con primer intento enviado se recuerdan (analítica v0/c0)');
  ok('reanudar: solo el fallado y los no vistos vuelven a la cola');
}

// ── 1b. Sin filas (o fetch fallido) = carrera desde cero, como siempre ──────
{
  const s = raceResumeState(3, []);
  assert.deepStrictEqual(s.queue, [0, 1, 2], 'sin respuestas previas la cola es completa');
  assert.strictEqual(s.correctCount, 0);
  assert.strictEqual(s.firstSent.size, 0);
  // Y la basura no rompe ni cuela índices fuera de rango.
  const g = raceResumeState(2, [{ itemIndex: 99, correct: true }, { itemIndex: -1, correct: true }, { itemIndex: 'x' }, null]);
  assert.deepStrictEqual(g.queue, [0, 1], 'índices fuera de rango o basura se ignoran');
  ok('contra-prueba: sin filas (o con basura) la carrera arranca completa');
}

// ── 1c. Un veredicto scored=false (fallo puntuado) también vuelve a la cola ──
{
  const s = raceResumeState(2, [{ itemIndex: 0, correct: false }]);
  assert.deepStrictEqual(s.queue, [0, 1], 'correct=false (veredicto de fallo) re-encola igual que null');
  ok('correct=false re-encola: solo true saca un ítem de la cola');
}

// ── 2. El driver LOCAL sirve las filas propias con el hint de carrera ───────
{
  registerTemplate({
    meta: { name: 'qrace', contentModel: 'qa', modes: { live: true },
            defaultRules: () => ({}), defaultScoring: () => ({}), defaultLive: () => ({}) },
    renderPlayer() {}, renderEditor() {},
    scoreSubmission: scoreQuizSubmission,
    getRoundPayload: (a, ctx) => ({ question: a.content.items[ctx.itemIndex].question }),
  });
  const m = new Map();
  const kv = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
  const makeChannel = () => ({ addEventListener() {}, removeEventListener() {}, postMessage() {}, close() {} });
  const rt = createLocalRealtime({ kv, makeChannel, userId: 'u1' });
  const activity = { id: 'a1', template: 'qrace', scoring: {}, live: {}, content: { items: [
    { id: 'q1', question: '2+2', answer: '4', options: ['3', '4'], points: 1 },
    { id: 'q2', question: '3+3', answer: '6', options: ['5', '6'], points: 1 },
    { id: 'q3', question: '4+4', answer: '8', options: ['7', '8'], points: 1 },
  ] } };
  const { code } = await rt.createRoom(activity);
  const p = await rt.joinSession(code, 'Ana');
  // Acierta q1, falla q2, no toca q3 (la carrera guarda el veredicto como HINT).
  await rt.submitRaceAttempt(code, p.playerId, 0, '4', true, 1, 500);
  await rt.submitRaceAttempt(code, p.playerId, 1, '5', false, 0, 700);
  const rows = await rt.listOwnAnswers(code, p.playerId);
  const s = raceResumeState(3, rows);
  assert.deepStrictEqual(s.queue, [1, 2], 'tras recarga: el acertado fuera, el fallado y el nuevo dentro');
  assert.strictEqual(s.correctCount, 1, 'el acierto previo se cuenta');
  assert.deepStrictEqual([...s.firstSent].sort(), [0, 1], 'los primeros intentos enviados se recuerdan');
  // Otro jugador (otro dispositivo → otro userId) no contamina las filas propias.
  const rt2 = createLocalRealtime({ kv, makeChannel, userId: 'u2' });
  const p2 = await rt2.joinSession(code, 'Beto');
  await rt2.submitRaceAttempt(code, p2.playerId, 2, '8', true, 1, 300);
  const rows2 = await rt.listOwnAnswers(code, p.playerId);
  assert.strictEqual(rows2.length, 2, 'listOwnAnswers devuelve SOLO las filas del propio jugador');
  ok('driver local: listOwnAnswers refleja el hint de carrera y filtra por jugador');
}

// ── 3. La vista siembra desde el servidor (no reconstruye la cola a ciegas) ──
{
  const src = readFileSync(new URL('../views/studentLive.js', import.meta.url), 'utf8');
  assert.match(src, /raceResumeState\(/, 'studentLive siembra la cola con raceResumeState');
  assert.match(src, /listOwnAnswers\(session\.id, player\.playerId\)/, 'y las filas salen de listOwnAnswers (las propias)');
  assert.ok(!/raceQueue = allItems\.map/.test(src), 'la cola ya NO se reconstruye a ciegas con todos los ítems');
  // El adaptador PB expone el método (mismo contrato que el local).
  const pb = readFileSync(new URL('../adapters/pocketbase/realtime.js', import.meta.url), 'utf8');
  assert.match(pb, /async listOwnAnswers\(/, 'el adaptador PocketBase implementa listOwnAnswers');
  ok('studentLive reanuda la carrera desde el servidor en vez de reiniciarla');
}

// ── 4. La hora de meta SOBREVIVE a la recarga (revisión v1.51.432) ───────────
// Tras cruzar la meta y recargar, el "tu tiempo" salía del reloj de la RECARGA
// (contradecía el orden del podio). Ahora se deriva de las filas del servidor:
// el ms del último acierto — y SOLO si de verdad terminó (cola vacía).
{
  const done = raceResumeState(3, [
    { itemIndex: 0, correct: true, ms: 4000 },
    { itemIndex: 1, correct: true, ms: 9000 },
    { itemIndex: 2, correct: true, ms: 7500 },
  ]);
  assert.strictEqual(done.finishMs, 9000, 'meta = ms del ÚLTIMO acierto (no el mayor índice)');
  const aMedias = raceResumeState(3, [
    { itemIndex: 0, correct: true, ms: 4000 },
    { itemIndex: 1, correct: false, ms: 6000 },
  ]);
  assert.strictEqual(aMedias.finishMs, null, 'sin terminar (cola no vacía) NO hay hora de meta');
  const sinMs = raceResumeState(1, [{ itemIndex: 0, correct: true }]);
  assert.strictEqual(sinMs.finishMs, null, 'filas viejas sin ms → null (la vista cae al reloj, como antes)');
  ok('raceResumeState recupera la hora de meta del servidor (y solo si terminó)');
}

console.log(`\nraceResume.test: ${passed} checks passed`);
