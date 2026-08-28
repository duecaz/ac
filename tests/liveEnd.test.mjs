// C-1 · POLÍTICA DE FIN de los bucles a ritmo del alumno (carrera y tablero).
//
// El problema que cierra (docs/estudio-bucles-live.md ficha 2 C-1): en rondas
// el juego acaba solo —se terminan las preguntas—, pero la carrera y el tablero
// NO terminaban nunca: seguían hasta que el profe pulsaba "Terminar", aunque
// los 30 hubieran acabado hace dos minutos. Y el primero que terminaba se
// quedaba mirando un "esperando…" mudo, sin saber si faltaban diez segundos o
// diez minutos.
//
// Run: node tests/liveEnd.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { END_POLICIES, DEFAULT_POLICY, DEFAULT_FIRST_N,
         endPolicyOf, shouldEnd, waitingInfo } from '../core/liveEnd.js';
import { createLocalRealtime } from '../adapters/local/realtime.js';
import { registerTemplate } from '../core/registry.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const read = (p) => readFileSync(new URL(p, new URL('..', import.meta.url)), 'utf8');
const NOW = Date.UTC(2026, 7, 1, 10, 0, 0);

// ── 1. 'all' — no se cierra hasta que terminan TODOS ───────────────────────
{
  const base = { policy: 'all', n: 3, deadlineMs: null, now: NOW };
  assert.strictEqual(shouldEnd({ ...base, players: 5, finished: 4 }), false, 'con uno a medias NO se cierra');
  assert.strictEqual(shouldEnd({ ...base, players: 5, finished: 5 }), true, 'con todos terminados, se cierra');
  // El caso que rompería una sala recién abierta: 0 de 0.
  assert.strictEqual(shouldEnd({ ...base, players: 0, finished: 0 }), false,
    'una sala sin jugadores NO se auto-termina (0 de 0 no es "todos acabaron")');
  ok("'all': cierra al terminar todos, y una sala vacía no se cierra sola");
}

// ── 2. 'firstN' — y el caso de menos alumnos que N ────────────────────────
{
  const base = { policy: 'firstN', n: 3, deadlineMs: null, now: NOW };
  assert.strictEqual(shouldEnd({ ...base, players: 10, finished: 2 }), false);
  assert.strictEqual(shouldEnd({ ...base, players: 10, finished: 3 }), true, 'al llegar al tercero, cierra');
  assert.strictEqual(shouldEnd({ ...base, players: 2, finished: 2 }), true,
    'si hay MENOS alumnos que N, basta con que acaben todos (si no, no cerraría nunca)');
  ok("'firstN': cierra con los N primeros, y con menos alumnos que N no se cuelga");
}

// ── 3. 'time' — manda el instante, no cuántos terminaron ──────────────────
{
  const base = { policy: 'time', n: 3, players: 10, finished: 0 };
  assert.strictEqual(shouldEnd({ ...base, deadlineMs: NOW + 1000, now: NOW }), false, 'antes del instante, sigue');
  assert.strictEqual(shouldEnd({ ...base, deadlineMs: NOW, now: NOW }), true, 'al llegar el instante, cierra');
  assert.strictEqual(shouldEnd({ ...base, deadlineMs: NOW - 1, now: NOW }), true, 'pasado el instante también');
  assert.strictEqual(shouldEnd({ ...base, deadlineMs: null, now: NOW }), false,
    'sin instante NO se cierra sola: mejor que el profe corte a cerrar una clase por sorpresa');
  ok("'time': manda el instante del servidor, con o sin gente terminada");
}

// ── 4. Lectura de la política desde la fila de la sala ────────────────────
{
  assert.deepStrictEqual(endPolicyOf({}), { policy: DEFAULT_POLICY, n: DEFAULT_FIRST_N, deadlineMs: null },
    'una sala sin política declarada usa el defecto (todos terminan)');
  assert.strictEqual(endPolicyOf({ end_policy: 'inventada' }).policy, DEFAULT_POLICY,
    'una política desconocida cae al defecto en vez de romper la partida');
  assert.strictEqual(endPolicyOf({ end_n: 0 }).n, DEFAULT_FIRST_N, 'N inválido → defecto');
  assert.strictEqual(endPolicyOf({ end_n: '7' }).n, 7);
  // PocketBase serializa las fechas con espacio en vez de T.
  assert.strictEqual(endPolicyOf({ deadline: '2026-08-01 10:00:00.000Z' }).deadlineMs, NOW,
    'el instante se lee igual venga de PocketBase (espacio) o en ISO');
  assert.strictEqual(endPolicyOf({ deadline: 'basura' }).deadlineMs, null);
  ok('la política se lee de la sala con defectos sanos y sin romperse');
}

// ── 5. Lo que se le dice al alumno que ya terminó ─────────────────────────
{
  assert.match(waitingInfo({ policy: 'all', players: 12, finished: 9 }).text, /Faltan 3 compañeros/);
  assert.match(waitingInfo({ policy: 'all', players: 12, finished: 11 }).text, /Faltan 1 compañero\b/);
  assert.strictEqual(waitingInfo({ policy: 'all', players: 0 }).text, 'Termina cuando acaben todos.',
    'sin saber cuántos hay (el alumno no lee la lista, §21) se dice la REGLA, no un número inventado');
  assert.match(waitingInfo({ policy: 'firstN', n: 3 }).text, /los 3 primeros/);
  const t = waitingInfo({ policy: 'time' });
  assert.strictEqual(t.showClock, true, 'con tiempo límite el alumno ve el reloj (el instante de la sala)');
  assert.strictEqual(waitingInfo({ policy: 'all', players: 5, finished: 5 }).showClock, false);
  ok('el que termina primero sabe QUÉ espera, no un "esperando…" mudo');
}

// ── 6. La política viaja por la sala (ida y vuelta real) ──────────────────
{
  const m = new Map();
  const kv = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)),
               removeItem: (k) => m.delete(k), get length() { return m.size; }, key: (i) => [...m.keys()][i] };
  const rt = createLocalRealtime({ kv, makeChannel: () => ({ addEventListener() {}, removeEventListener() {}, postMessage() {}, close() {} }), userId: 'u1' });
  registerTemplate({
    meta: { name: 'qend', contentModel: 'qa', modes: { live: true }, play: { live: ['race'] },
            defaultRules: () => ({}), defaultScoring: () => ({}), defaultLive: () => ({}) },
    renderPlayer() {}, renderEditor() {},
    scoreSubmission: () => ({ correct: true, points: 1 }),
    getRoundPayload: (a, ctx) => ({ question: a.content.items[ctx.itemIndex]?.question }),
  });
  const { code } = await rt.createRoom({ id: 'a', template: 'qend', content: { items: [
    { id: 'q1', question: 'x', answer: '1', options: ['1'] },
    { id: 'q2', question: 'y', answer: '2', options: ['2'] },
  ] } });
  await rt.setSessionState(code, { phase: 'race', end_policy: 'firstN', end_n: 4, deadline: null });
  const sess = await rt.fetchSession(code);
  assert.strictEqual(sess.end_policy, 'firstN', 'la política llega al ALUMNO (por eso vive en la sala)');
  assert.strictEqual(sess.end_n, 4);
  assert.strictEqual(endPolicyOf(sess).n, 4, 'y se lee con el mismo módulo en los dos lados');
  ok('la política viaja en la fila de la sala (driver local, ida y vuelta)');
}

// ── 7. Cableado: UNA comprobación para los DOS bucles, y el profe manda ───
{
  const host = read('views/hostLive.js');
  assert.match(host, /async function maybeAutoEnd\(/, 'el cierre automático es UNA función compartida');
  assert.strictEqual((host.match(/maybeAutoEnd\(/g) || []).length, 3,
    'la definen 1 vez y la llaman 2 (carrera y tablero): si un bucle se la salta, no termina nunca');
  assert.match(host, /autoEnding = true/, 'dispara UNA vez (no re-entra mientras cierra)');
  assert.match(host, /id="btn-end-race"/, 'y el profe conserva su botón de cortar antes');
  // El tiempo límite se escribe como INSTANTE en la sala, no como contador local.
  assert.match(host, /deadline = endPolicy === 'time'/, 'el tiempo límite nace como instante');
  // v1.51.627: el adaptador se partió POR COLECCIÓN — la cita apunta al fichero que recibió el código.
  const pb = read('adapters/pocketbase/realtimeRooms.js');
  assert.match(pb, /'end_policy' in patch/, 'el adaptador PocketBase transporta la política');
  assert.match(pb, /end_policy: rec\.state\?\.endPolicy/, 'y la devuelve al leer la sala');
  ok('cableado: una comprobación para carrera y tablero, y el mando sigue en el profe');
}

console.log(`\nliveEnd.test: ${passed} checks passed`);
