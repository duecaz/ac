// DEUDA C — "no puntuable" NO es "incorrecto".
//
// `autoScore` hacía `correct: !!r.correct`, así que un ítem SIN clave de respuesta
// (Pregunta en Vivo, Ruleta: los puntos los da el docente a mano) colapsaba a
// `false` y marcaba a TODA la clase como incorrecta — en la tabla del profe, en la
// analítica y en la pantalla del alumno, a quien se le decía que había fallado
// cuando no había nada que acertar.
//
// Aquí se fija la cadena entera: motor → fila de PocketBase → filas normalizadas
// → tabla, con la contra-prueba de que un ítem normal sigue puntuando igual.
//
// Run: node tests/unscorable.test.mjs
import assert from 'node:assert';
import { registerTemplate } from '../core/registry.js';
import { createSession, FORMATS } from '../kernel/session/engine.js';
import { rowsFromLiveAnswers } from '../core/answerRows.js';
import { buildSessionTable } from '../views/sessionTable.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Plantilla SIN clave: su scorer no juzga (como question-live / wheel).
registerTemplate({
  meta: { name: 'uns_open', label: 'Abierta', contentModel: 'items', modes: { solo: false, live: true } },
  renderPlayer() {}, renderEditor() {}, renderRound() {}, getRoundPayload() { return {}; },
  scoreSubmission() { return { correct: null, points: 0, hits: 0, total: 0 }; },
});
// Plantilla normal (contra-prueba): sí juzga.
registerTemplate({
  meta: { name: 'uns_quiz', label: 'Quiz', contentModel: 'qa', modes: { solo: true, live: true } },
  renderPlayer() {}, renderEditor() {}, renderRound() {}, getRoundPayload() { return {}; },
  scoreSubmission({ value, item }) { return { correct: value === item.a, points: value === item.a ? 1 : 0 }; },
});

const OPEN = { id: 'a1', template: 'uns_open', live: {}, content: { items: [{ id: 'it_1', question: '¿Qué opinas?' }] } };
const QUIZ = { id: 'a2', template: 'uns_quiz', live: {}, content: { items: [{ id: 'q_1', q: '2+2', a: '4' }] } };

// ── 1. El motor PRESERVA el null ────────────────────────────────────────────
{
  const s = createSession(OPEN, { format: FORMATS.LIVE });
  const p = s.join('u1', 'Ana');
  s.dispatch('start');
  s.submit(p.id, 0, 'lo que sea', 1000);
  s.settle(0);
  const ans = s.state.answers[`0:${p.id}`];
  assert.strictEqual(ans.correct, null, 'un ítem sin clave queda NO PUNTUABLE, no incorrecto');
  assert.strictEqual(ans.points, 0, 'y sin puntos automáticos (los da el docente)');
  assert.strictEqual(s.state.players[0].score, 0, 'el marcador no se mueve solo');

  // Contra-prueba: con clave, el veredicto es el de siempre.
  const s2 = createSession(QUIZ, { format: FORMATS.LIVE });
  const p2 = s2.join('u1', 'Ana');
  s2.dispatch('start');
  s2.submit(p2.id, 0, '4', 1000);
  s2.settle(0);
  assert.strictEqual(s2.state.answers[`0:${p2.id}`].correct, true, 'una respuesta correcta sigue siendo true');
  assert.strictEqual(s2.state.players[0].score, 1, 'y sí suma su punto');
  ok('autoScore preserva `correct: null` (no puntuable) y no toca el marcador');
}

// ── 2. La fila de PocketBase lo transporta y se restaura ────────────────────
{
  // PocketBase no guarda booleanos nulos: el settle marca `unscorable` y la
  // normalización devuelve el null.
  const rows = rowsFromLiveAnswers([
    { player: 'p1', item: 0, value: 'algo', scored: true, correct: false, unscorable: true, points: 0 },
    { player: 'p2', item: 0, value: 'otra', scored: true, correct: false, points: 0 },
  ], 0);
  assert.strictEqual(rows[0].correct, null, 'la fila `unscorable` vuelve a null, no a false');
  assert.strictEqual(rows[0].correctFinal, null, 'también en el veredicto final (tabla/ranking)');
  assert.strictEqual(rows[1].correct, false, 'una respuesta de verdad incorrecta sigue siendo false');
  ok('la fila viaja con `unscorable` y se restaura como no puntuable');
}

// ── 3. La tabla del profe no lo cuenta como fallo ──────────────────────────
{
  const items = OPEN.content.items;
  const T = { scoreSubmission: () => ({ correct: null, points: 0, hits: 0, total: 0 }) };
  const table = buildSessionTable([
    { player: 'p1', name: 'Ana', itemIndex: 0, value: 'algo', correct: null, correctFinal: null, points: 0 },
  ], 1, { items, template: T, activity: OPEN });
  const row = table.players[0];
  assert.strictEqual(row.nCorrect, 0, 'no cuenta como acierto');
  const cell = row.cells[0];
  assert.strictEqual(cell.correct, null, 'la celda queda en "no puntuable"');
  assert.strictEqual(cell.total, 0, 'y NO entra en el denominador (antes contaba como fallo)');
  ok('la tabla del profe pinta "—" y no penaliza el ítem sin clave');
}

// ── 4. La pantalla del alumno tiene su caso ────────────────────────────────
{
  // Guardarraíl de texto: la vista debe distinguir los TRES casos, porque el
  // bug se veía justo ahí ("Incorrecto" a quien no tenía nada que acertar).
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../views/studentLive.js', import.meta.url), 'utf8');
  assert.match(src, /own\.correct == null/, 'studentLive debe detectar el "no puntuable"');
  assert.match(src, /La valora tu profe/, 'y decírselo al alumno en vez de "Incorrecto"');
  assert.match(src, /if \(!unscored\) Streaks\.bump/, 'un ítem no puntuable no rompe ni sube la racha');
  ok('la pantalla del alumno distingue sin respuesta · no puntuable · correcto · incorrecto');
}

// ── 6. PEDIR LA PALABRA: los puntos del DOCENTE llegan al podio ────────────
// Bug encontrado y verificado contra PocketBase real (v1.51.347): el podio se
// DERIVA de live_answers desde la deuda A, pero este bucle escribía los puntos
// solo en el blob de la sala → el docente repartía puntos toda la clase y al
// final el podio mostraba CERO a todos. Ahora cada premio es también una fila:
// `scored` (el veredicto ya está dado) + `unscorable` (no hubo clave que
// acertar; el mérito es del docente, §22-5).
{
  const { readFileSync } = await import('node:fs');
  const pb = readFileSync(new URL('../adapters/pocketbase/realtime.js', import.meta.url), 'utf8');
  assert.match(pb, /patch\.ql_award && Number\.isInteger\(patch\.ql_award\.item\)/,
    'el adaptador escribe la fila del premio (y necesita saber QUÉ caja se premió)');
  const block = pb.slice(pb.indexOf('patch.ql_award && Number.isInteger'), pb.indexOf('El host puede tocar AMBOS'));
  assert.match(block, /scored: true/, 'la fila va puntuada: el veredicto ya lo dio el docente');
  assert.match(block, /unscorable: true/,
    'y NO puntuable: sin clave que acertar, la tabla la pinta "—" en vez de fingir un acierto');
  assert.match(block, /conflict/, 'si la caja se reabre y se re-premia, se actualiza la fila (no se duplica)');
  const host = readFileSync(new URL('../views/hostLive.js', import.meta.url), 'utf8');
  assert.match(host, /ql_award: \{ playerId: qlBy, points, item: qlOpen \}/,
    'el host manda la caja premiada: sin `item` los puntos se quedarían solo en el blob');
  ok('pedir la palabra: el premio del docente es una fila de live_answers → llega al podio');
}

// ── 7. CL-1 · quién ha participado ya: AVISO en la pizarra, no regla ───────
// El reparto de este bucle era ciego: el primero que toca se queda la caja y
// los rápidos acaparan, sin que el docente pudiera ver a quién le falta. Ahora
// queda registrado QUIÉN se llevó cada caja y la pizarra lo muestra. NO se
// bloquea a nadie: un gate en el móvil sería una promesa que el cliente no
// puede garantizar (la única garantía sería una regla de servidor, y este
// problema es de gestión de aula, no de trampa).
{
  const { readFileSync } = await import('node:fs');
  const host = readFileSync(new URL('../views/hostLive.js', import.meta.url), 'utf8');
  assert.match(host, /ql_points: newPoints, ql_taken: newTaken/,
    'al premiar se registra QUIÉN se llevó la caja, no solo cuánto valió');
  assert.match(host, /function participationHtml\(/, 'la pizarra muestra la participación');
  assert.match(host, /Aún no participan/, 'y destaca a los que aún no han participado (lo accionable)');
  // Es un AVISO: la rejilla del ALUMNO no puede depender de ello para bloquear.
  const student = readFileSync(new URL('../views/studentLive.js', import.meta.url), 'utf8');
  assert.ok(!/ql_taken/.test(student),
    'el móvil NO usa ql_taken para bloquear: sería una regla que el cliente no puede garantizar (CL-1 opción 1)');
  // Y el dato viaja por los dos adaptadores.
  for (const drv of ['../adapters/pocketbase/realtime.js', '../adapters/local/realtime.js']) {
    const src = readFileSync(new URL(drv, import.meta.url), 'utf8');
    assert.match(src, /'ql_taken' in patch/, `${drv}: transporta ql_taken`);
  }
  ok('CL-1: la pizarra dice quién ha participado; nadie queda bloqueado en el móvil');
}

console.log(`\nunscorable.test: ${passed} checks passed`);
