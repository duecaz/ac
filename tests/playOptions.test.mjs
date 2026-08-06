// OPCIONES DE PARTIDA — lo que el profe decide al lanzar, no en el editor.
//
// Reportado en clase (Ordena las Pelotas): "no hay opción de elegir si se gana
// por tiempo o por movimientos; el docente debe decidir". La opción existía…
// dentro del editor: para cambiarla había que salir del juego, abrir la
// actividad, guardarla y volver, con la clase esperando.
//
// La regla que fija esta suite: elegir para ESTA partida no puede tocar la
// actividad guardada (§24, el contenido es del usuario), y la opción siempre
// viene ya elegida (R2 del norte: el profe no configura nada para empezar).
//
// Run: node tests/playOptions.test.mjs
import assert from 'node:assert';
import '../core/registerTemplates.js';
import { getTemplate, listTemplates } from '../core/registry.js';
import { playOptionsOf, currentChoices, applyPlayOptions, playOptionsHtml } from '../core/playOptions.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const ballsort = () => {
  const T = getTemplate('ballsort');
  return { id: 'b1', title: 'Pelotas', template: 'ballsort', schemaVersion: 4, templateVersion: 1,
    rules: {}, presentation: {}, live: {}, scoring: T.meta.defaultScoring(),
    content: T.meta.defaultContent() };
};

// ── 1. La plantilla declara sus dos formas de ganar ────────────────────────
{
  const T = getTemplate('ballsort');
  const opts = playOptionsOf(T);
  assert.strictEqual(opts.length, 1, 'una opción: cómo se gana');
  assert.deepStrictEqual(opts[0].values.map(v => v.value), ['moves', 'time']);
  assert.strictEqual(currentChoices(T, ballsort()).mode, 'moves', 'viene ya elegida (R2)');
  ok('Ordena las Pelotas declara sus dos modos y uno viene marcado de entrada');
}

// ── 2. Elegir NO toca la actividad guardada ────────────────────────────────
// El punto entero: es una elección de PARTIDA. Mañana, con otro grupo, otra.
{
  const T = getTemplate('ballsort');
  const a = ballsort();
  const antes = JSON.stringify(a);
  const jugada = applyPlayOptions(T, a, { mode: 'time' });

  assert.strictEqual(jugada.content.mode, 'time');
  assert.strictEqual(jugada.content.items[0].mode, 'time',
    'también en el ítem: es lo que lee el scorer, o se jugaría de una forma y puntuaría de otra');
  assert.strictEqual(JSON.stringify(a), antes, 'la actividad ORIGINAL queda intacta (§24)');
  ok('elegir "menos tiempo" cambia la partida y no la actividad guardada');
}

// ── 3. Y el scorer obedece de verdad ───────────────────────────────────────
// Sin esto la opción sería decorativa: el cuadro cambia y los puntos no.
{
  const T = getTemplate('ballsort');
  const porTiempo = applyPlayOptions(T, ballsort(), { mode: 'time' });
  const porMovs = ballsort();
  const resuelto = { solved: true, moveCount: 40, elapsedMs: 10_000, tubes: [], tubeCapacity: 7 };

  const t = T.scoreSubmission({ value: resuelto, item: porTiempo.content.items[0], activity: porTiempo });
  const m = T.scoreSubmission({ value: resuelto, item: porMovs.content.items[0], activity: porMovs });
  assert.notStrictEqual(t.points, m.points,
    'el mismo tablero resuelto puntúa distinto según cómo se decidió ganar');
  assert.strictEqual(t.points, 1000 - 10 * 5, 'por tiempo: −5 por segundo');
  assert.strictEqual(m.points, 1000 - 40 * 8, 'por movimientos: −8 por movimiento');
  ok('la elección llega al scorer: el mismo tablero da 950 por tiempo y 680 por movimientos');
}

// ── 4. Un valor inventado no rompe la partida ──────────────────────────────
// Los valores vienen de la UI y de un `?` en la URL el día de mañana.
{
  const T = getTemplate('ballsort');
  const a = ballsort();
  assert.strictEqual(applyPlayOptions(T, a, { mode: 'chorizo' }).content.mode, 'moves',
    'un valor fuera del catálogo se ignora');
  assert.strictEqual(currentChoices(T, a, { mode: 'chorizo' }).mode, 'moves');
  assert.strictEqual(applyPlayOptions(T, a, {}), a, 'sin elección, la misma actividad');
  ok('un valor inventado se ignora en vez de romper el juego');
}

// ── 5. Las que no declaran opciones no pintan nada ─────────────────────────
// R2 del norte: el profe no configura nada. Esto es la excepción declarada, no
// una puerta abierta a llenar de mandos la pantalla de inicio.
{
  const sinOpciones = listTemplates().filter(T => !playOptionsOf(T).length);
  assert.ok(sinOpciones.length >= 12, `${sinOpciones.length} plantillas sin opciones: sigue siendo la excepción`);
  for (const T of sinOpciones) {
    assert.strictEqual(playOptionsHtml(T, { template: T.meta.name }), '',
      `${T.meta.name} no debe pintar control alguno`);
  }
  ok(`${sinOpciones.length} de 13 plantillas no muestran ningún mando: la excepción sigue siendo excepción`);
}

// ── 6. El control marca lo vigente y escapa lo que pinta ───────────────────
{
  const T = getTemplate('ballsort');
  const html = playOptionsHtml(T, ballsort(), { mode: 'time' });
  assert.ok(html.includes('Menos tiempo') && html.includes('Menos movimientos'), 'las dos salidas');
  assert.ok(/data-value="time"[^>]*aria-pressed="true"/s.test(html.replace(/\n\s*/g, ' ')),
    'la elegida sale marcada');
  assert.ok(!html.includes('<script'), 'sin inyección');
  ok('el control marca la opción vigente (no hay que adivinar cuál está puesta)');
}

// ── 7. LEY §28 (R2): el techo de opciones lo EXIGE el contrato ─────────────
// playOptions.js prometía este tope en un comentario y nadie lo vigilaba. R2 no
// muere de un golpe: muere opción a opción razonable.
{
  const { checkTemplateContract } = await import('../core/templateContract.js');
  const base = getTemplate('ballsort');
  const clon = (play) => ({
    meta: { ...base.meta, name: 'fake', play: { ...base.meta.play, ...play } },
    renderPlayer: () => {}, renderEditor: () => {}, previewHtml: () => '<div></div>',
    scoreSubmission: base.scoreSubmission, getRoundPayload: base.getRoundPayload,
    renderRound: base.renderRound, migrateContent: (c) => c,
  });
  const opcion = (id) => ({ id, label: id, values: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], get: () => 'a', set: (a) => a });

  const tres = checkTemplateContract(clon({ options: [opcion('x'), opcion('y'), opcion('z')] }));
  assert.ok(tres.some(i => /techo de R2 es 2/.test(i)), `3 opciones deben romper el contrato: ${tres.join(' | ')}`);

  const sinSet = checkTemplateContract(clon({ options: [{ ...opcion('x'), set: undefined }] }));
  assert.ok(sinSet.some(i => /get\/set obligatorios/.test(i)), 'una opción sin set debe romper');

  const unValor = checkTemplateContract(clon({ options: [{ ...opcion('x'), values: [{ value: 'a', label: 'A' }] }] }));
  assert.ok(unValor.some(i => /entre 2 y 4 valores/.test(i)), 'una "opción" de un solo valor no es una opción');

  const dosOk = checkTemplateContract(clon({ options: [opcion('x'), opcion('y')] }));
  assert.ok(!dosOk.some(i => /options/.test(i)), `dos opciones válidas pasan: ${dosOk.join(' | ')}`);
  ok('LEY §28-R2: el contrato rechaza 3 opciones, valores fuera de 2-4 y opciones sin get/set');
}

console.log(`\n  ${passed} playOptions checks passed`);
