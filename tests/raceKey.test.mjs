// LA CARRERA SIN CLAVE — el bug que la clase vio antes que nosotros.
//
// Reportado en pruebas reales con Tildes en vivo: "pongo la tilde y avanza;
// cuando termino las 2 hojas vuelve a la primera aunque esté todo bien, y suena
// el sonido de error". No era de Tildes: era de la CARRERA, y afectaba a las
// cuatro plantillas que la declaran.
//
// La cadena: al entrar por PIN el alumno recibe el snapshot SANEADO (sin clave,
// ley §22-2). Al arrancar la carrera la sala sube la actividad COMPLETA —porque
// en carrera el veredicto lo da el propio móvil— pero ese PATCH iba DESPUÉS del
// que abre la fase, y además `views/studentLive.js` guardaba la actividad UNA
// sola vez, al entrar. Resultado: el móvil jugaba con el snapshot vacío,
// `scoreSubmission` devolvía `correct:false` para TODO (incluida una hoja
// perfecta), la hoja volvía a la cola y la carrera no terminaba nunca.
//
// Por qué el e2e no lo cazó: `tools/race-e2e.mjs` llamaba a `submitRaceAttempt`
// con el veredicto ya calculado POR EL TEST. Probaba el ranking, nunca el
// veredicto del móvil. Aquí se prueba justo eso.
//
// Run: node tests/raceKey.test.mjs
import assert from 'node:assert';
import '../core/registerTemplates.js';
import { getTemplate } from '../core/registry.js';
import { sessionItems } from '../kernel/session/engine.js';
import { studentSnapshot, hasClientKey, needsClientKey } from '../core/liveSnapshot.js';
import { createPocketbaseRealtime } from '../adapters/pocketbase/realtime.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const tildes = () => ({
  id: 't1', title: 'Tildes', template: 'tildes', schemaVersion: 4, templateVersion: 1,
  rules: {}, presentation: {}, live: {}, scoring: { pointsPerCorrect: 1 },
  content: { passages: [
    { id: 'ps_1', text: 'El arbol es grande', marks: [{ kind: 'tilde', pos: 3 }] },
    { id: 'ps_2', text: 'Mi mama vino', marks: [{ kind: 'tilde', pos: 6 }] },
  ] },
});

// ── 1. La marca dice la verdad sobre lo que hay en la mano ─────────────────
{
  const act = tildes();
  assert.strictEqual(hasClientKey(act), true, 'la actividad del profe SÍ lleva clave');
  assert.strictEqual(hasClientKey(studentSnapshot(act)), false, 'el snapshot NO');
  assert.strictEqual(hasClientKey(null), false, 'sin actividad no se juzga');
  ok('`sanitized` marca el snapshot: el móvil sabe si puede juzgar, no lo adivina');
}

// ── 2. POR QUÉ existe el guard: sin clave, lo perfecto puntúa MAL ──────────
// Este es el test que reproduce el bug de clase. No comprueba una opinión:
// comprueba que juzgar sin clave produce el veredicto contrario al real.
{
  const act = tildes();
  const T = getTemplate('tildes');
  const real = sessionItems(act)[0];
  const bueno = T.scoreSubmission({ value: [3], item: real, activity: act, mode: 'race' });
  assert.strictEqual(bueno.correct, true, 'con clave, la hoja perfecta es correcta');
  assert.strictEqual(bueno.perfect, true);

  const snap = studentSnapshot(act);
  const ciego = T.scoreSubmission({ value: [3], item: sessionItems(snap)[0], activity: snap, mode: 'race' });
  assert.strictEqual(ciego.correct, false,
    'sin clave el scorer NO puede acertar — por eso el móvil no debe llamarlo');
  ok('reproducido: la MISMA hoja perfecta sale "mal" si se juzga sin clave (bug de clase)');
}

// ── 3. Las cuatro plantillas de carrera, no solo Tildes ────────────────────
// El bug se reportó con Tildes porque es lo que se probó. Se comprueba que
// ninguna plantilla que declare carrera puede juzgar con el snapshot.
{
  const { LOOP_LABELS } = await import('../core/liveLoops.js');
  const { loopsOf } = await import('../core/liveLoops.js');
  const { listTemplates } = await import('../core/registry.js');
  const conCarrera = listTemplates().filter(T => loopsOf(T).includes('race')).map(T => T.meta.name);
  assert.ok(conCarrera.length >= 4, `esperaba 4+ plantillas con carrera, hay ${conCarrera.length}`);
  assert.ok(LOOP_LABELS.race, 'el bucle carrera sigue declarado');
  for (const name of conCarrera) {
    assert.strictEqual(hasClientKey(studentSnapshot({ template: name, content: {} })), false,
      `${name}: su snapshot debe declararse sin clave`);
  }
  ok(`las ${conCarrera.length} plantillas de carrera (${conCarrera.join(' · ')}) comparten el guard`);
}

// ── 4. La clave se sube ANTES de abrir la carrera ──────────────────────────
// El orden importa y era el orden equivocado: el móvil recibía "empieza" y se
// ponía a jugar antes de tener con qué juzgar. Se observa el orden REAL de las
// peticiones del adaptador con `fetch` inyectado.
{
  const orden = [];
  const res = (obj) => ({ status: 200, ok: true, text: async () => JSON.stringify(obj ?? {}), json: async () => obj ?? {} });
  const sala = { id: 'sess1', code: 'ABCDE', state: { status: 'lobby', phase: 'lobby', players: [] }, activity: tildes() };
  global.fetch = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    if (method === 'PATCH' && url.includes('/live_sessions/records/sess1')) {
      const body = JSON.parse(opts.body);
      orden.push(body.activity !== undefined ? 'clave' : 'estado');
      return res({ ...sala, updated: '2026-08-05 10:00:00.000Z' });
    }
    if (url.includes('/live_keys/records')) return res({ items: [{ activity: tildes() }] });
    if (url.includes('/live_sessions/records/sess1')) return res(sala);
    return res({ items: [] });
  };
  const rt = createPocketbaseRealtime({ userId: 'u1' });
  await rt.setSessionState('sess1', { status: 'running', phase: 'race', current_item: 0, loop: 'race' });

  assert.ok(orden.includes('clave'), 'al abrir la carrera debe subirse la actividad completa');
  assert.ok(orden.indexOf('clave') < orden.indexOf('estado'),
    `primero la clave, luego la salida — orden observado: ${orden.join(' → ')}`);
  ok(`la clave viaja ANTES de abrir la fase (${orden.join(' → ')})`);
}

// ── 5. CONTRA-PRUEBA: fuera de la carrera NO se sube la clave ──────────────
// El guard no puede convertirse en "subamos siempre el contenido": las rondas
// juntas puntúan en el host y el móvil no debe tener nunca la solución (§22-2).
{
  const orden = [];
  const res = (obj) => ({ status: 200, ok: true, text: async () => JSON.stringify(obj ?? {}), json: async () => obj ?? {} });
  const sala = { id: 'sess2', code: 'BCDEF', state: { status: 'lobby', phase: 'lobby', players: [] }, activity: tildes() };
  global.fetch = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    if (method === 'PATCH' && url.includes('/live_sessions/records/sess2')) {
      orden.push(JSON.parse(opts.body).activity !== undefined ? 'clave' : 'estado');
      return res({ ...sala, updated: '2026-08-05 10:00:00.000Z' });
    }
    if (url.includes('/live_keys/records')) return res({ items: [{ activity: tildes() }] });
    if (url.includes('/live_sessions/records/sess2')) return res(sala);
    return res({ items: [] });
  };
  const rt = createPocketbaseRealtime({ userId: 'u1' });
  await rt.setSessionState('sess2', { status: 'running', phase: 'question', current_item: 0, loop: 'rounds' });
  assert.ok(!orden.includes('clave'),
    'en rondas juntas el móvil NUNCA recibe la solución (§22-2) — orden: ' + orden.join(' → '));
  assert.strictEqual(needsClientKey('question'), false);
  ok('CONTRA-PRUEBA: en rondas juntas la clave NO sale del servidor');
}

// ── 6. En carrera la vara es COMPLETA (§26) ────────────────────────────────
// El otro medio-bug del mismo reporte: Tildes da crédito por marca
// (`correct: net>0`), así que una hoja con 1 de 3 tildes se daba por superada.
// El podio ordena por hora de meta PORQUE todos terminan con todas bien: con la
// vara suelta esa premisa es falsa y el podio miente.
{
  const { racePassed } = await import('../core/liveLoops.js');
  const act = tildes();
  const T = getTemplate('tildes');
  const item = { id: 'ps_x', text: 'El arbol es mas grande', marks: [
    { kind: 'tilde', pos: 3 }, { kind: 'tilde', pos: 13 },
  ] };

  const media = T.scoreSubmission({ value: [3], item, activity: act, mode: 'race' });
  assert.strictEqual(media.correct, true, 'el scorer sigue dando crédito por marca (no se toca)');
  assert.strictEqual(racePassed(media), false, 'pero en CARRERA una hoja a medias vuelve a la cola');

  const entera = T.scoreSubmission({ value: [3, 13], item, activity: act, mode: 'race' });
  assert.strictEqual(racePassed(entera), true, 'la hoja completa sí supera');

  const demas = T.scoreSubmission({ value: [3, 13, 0], item, activity: act, mode: 'race' });
  assert.strictEqual(demas.perfect, false);
  assert.strictEqual(racePassed(demas), false, 'marcar de más tampoco supera (si no, "márcalo todo" gana)');

  // CONTRA-PRUEBA: los scorers de todo-o-nada no declaran `perfect` y siguen
  // valiendo por su `correct` — la regla no puede romper Quiz ni Operaciones.
  const Q = getTemplate('quiz');
  const qItem = { id: 'q1', question: '2+2', answer: '4', options: ['4', '5'], points: 1 };
  const qAct = { ...act, template: 'quiz', content: { items: [qItem] } };
  const bien = Q.scoreSubmission({ value: '4', item: qItem, activity: qAct, mode: 'race' });
  const mal  = Q.scoreSubmission({ value: '5', item: qItem, activity: qAct, mode: 'race' });
  assert.strictEqual(racePassed(bien), true, 'Quiz correcto supera');
  assert.strictEqual(racePassed(mal), false, 'Quiz incorrecto vuelve a la cola');
  ok('carrera = hoja COMPLETA (perfect), con contra-prueba de que Quiz/Operaciones siguen igual');
}

console.log(`\n  ${passed} raceKey checks passed`);
