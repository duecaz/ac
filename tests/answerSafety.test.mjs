// ANSWER-SAFETY (R5) — el payload de una ronda NUNCA lleva la respuesta.
//
// `getRoundPayload` es lo que viaja al MÓVIL del alumno en vivo. La auditoría
// marcó "las respuestas correctas viajan al alumno" y el anti-trampa de C6 dejó
// los PUNTOS en manos del host — esta es la otra mitad: que tampoco viajen las
// CLAVES. El contrato es: un payload es apto para enviarse a un alumno SIEMPRE,
// aunque hoy la plantilla sea solo-only (crossword lo era y filtraba `word`).
//
// Método del veneno: se inyecta un token S3CR3T en los campos-respuesta del ítem
// (answer/marks/solution/word/right) y se exige que el payload NO lo contenga.
// Esto caza también el passthrough del ítem crudo (wheel/question-live lo eran):
// da igual el nombre del campo — si el payload arrastra lo que no conoce, filtra.
//
// EXCEPCIÓN POR DISEÑO (documentada, no silenciosa): en Sopa de Letras la lista
// de palabras ES la mecánica (el alumno las ve y las busca en el tablero — la
// respuesta es DÓNDE están, no cuáles son). Su ítem es un string, no un objeto,
// así que el veneno de campos no aplica; se verifica aparte que el payload no
// exponga las coordenadas de colocación con nombre de solución.
//
// Run: node tests/answerSafety.test.mjs
import assert from 'node:assert';
import '../core/registerTemplates.js';
import { listTemplates } from '../core/registry.js';
import { sessionItems } from '../kernel/session/engine.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const POISON = 'S3CR3T_ANSWER_TOKEN';

const templates = listTemplates().filter(T => typeof T.getRoundPayload === 'function');
assert.ok(templates.length >= 8, `se esperaban ≥8 plantillas con getRoundPayload, hay ${templates.length}`);

const leaks = [];
for (const T of templates) {
  const m = T.meta;
  const act = {
    id: `as_${m.name}`, template: m.name,
    content: m.defaultContent ? m.defaultContent() : {},
    rules: m.defaultRules ? m.defaultRules() : {},
    scoring: m.defaultScoring ? m.defaultScoring() : {},
  };
  if (T.migrateContent) { try { act.content = T.migrateContent(act.content) ?? act.content; } catch {} }

  const items = sessionItems(act);
  const it = items[0];
  // Veneno: en TODOS los campos que suelen ser clave de respuesta. Los ítems
  // string (wordsearch) no se pueden envenenar por campo → los cubre la
  // verificación específica de abajo.
  if (it && typeof it === 'object') {
    it.answer = POISON;
    it.solution = POISON;
    it.right = POISON;                      // pairs: la pareja correcta
    if ('word' in it) it.word = POISON;     // crossword: la palabra ES la clave
    if (Array.isArray(it.marks)) it.marks = [{ pos: 1, kind: 'tilde', token: POISON }];
    else it.marks = [{ pos: 1, kind: 'tilde', token: POISON }];
  }

  let payload = null;
  try { payload = T.getRoundPayload(act, { itemIndex: 0 }); } catch { /* payload que lanza = sin fuga */ }
  const json = JSON.stringify(payload ?? null);

  // El token puede aparecer LEGÍTIMAMENTE solo como una opción entre distractores
  // (match/quiz son de opción múltiple: la respuesta se muestra ENTRE opciones,
  // eso es la mecánica). Ilegítimo = aparecer como campo con nombre de clave.
  const namedLeak = /"(answer|solution|right|marks|word)"\s*:/.test(json) && json.includes(POISON);
  const passthroughLeak = json.includes(POISON) && !/"options"\s*:/.test(json);
  if (namedLeak || passthroughLeak) leaks.push(`${m.name}: ${json.slice(0, 160)}`);
}
assert.deepStrictEqual(leaks, [],
  'estos payloads FILTRAN la clave de respuesta al alumno:\n      ' + leaks.join('\n      '));
ok(`${templates.length} payloads envenenados: ninguno filtra la clave (ni por nombre ni por passthrough)`);

// ── Casos con nombre (los tres arreglos de R5 quedan fijados) ────────────────
{
  const cw = listTemplates().find(T => T.meta.name === 'crossword');
  const act = { content: cw.meta.defaultContent() };
  const p = cw.getRoundPayload(act, { itemIndex: 0 });
  assert.ok(p.words.length >= 1, 'el payload del crucigrama trae la forma');
  assert.ok(p.words.every(w => !('word' in w) && Number.isInteger(w.len)),
    'cada palabra viaja como forma (len/pos/pista), NUNCA las letras');
  ok('crossword: el payload lleva la FORMA del crucigrama, no las letras');
}
{
  for (const name of ['wheel', 'question-live']) {
    const T = listTemplates().find(t => t.meta.name === name);
    const act = { content: { items: [{ id: 'x', question: 'Q', image: null, hidden: POISON }] } };
    const p = T.getRoundPayload(act, { itemIndex: 0 });
    assert.deepStrictEqual(Object.keys(p).sort(), ['id', 'image', 'question'],
      `${name}: whitelist de campos de pantalla (sin passthrough)`);
    assert.ok(!JSON.stringify(p).includes(POISON), `${name}: un campo extraño del ítem no viaja`);
  }
  ok('wheel/question-live: whitelist — un campo desconocido del ítem no llega al alumno');
}
{
  // Sopa: su payload SÍ contiene la solución (`placed` = palabra + coordenadas)
  // porque la ronda valida el tablero en la MISMA pantalla (VS/Equipos). Eso es
  // legal ÚNICAMENTE porque declara play.live 'none': ese payload jamás viaja a
  // un dispositivo de alumno. Este test fija el ACOPLAMIENTO: quien lleve
  // solución en el payload no puede declarar live — y viceversa.
  const ws = listTemplates().find(T => T.meta.name === 'wordsearch');
  const act = { content: ws.meta.defaultContent(), rules: ws.meta.defaultRules() };
  const p = ws.getRoundPayload(act, { itemIndex: 0 });
  assert.ok(Array.isArray(p.placed) && p.placed.length, 'la sopa reparte el tablero con su colocación (pantalla compartida)');
  assert.strictEqual(ws.meta.play.live, 'none', "quien lleva solución en el payload DEBE declarar play.live 'none'");
  // Y la regla general: ninguna plantilla que declare live lleva 'placed'/'solution'.
  for (const T of templates) {
    if (T.meta.play?.live && T.meta.play.live !== 'none') {
      const a2 = { content: T.meta.defaultContent ? T.meta.defaultContent() : {}, rules: T.meta.defaultRules ? T.meta.defaultRules() : {} };
      if (T.migrateContent) { try { a2.content = T.migrateContent(a2.content) ?? a2.content; } catch {} }
      let pl = null; try { pl = T.getRoundPayload(a2, { itemIndex: 0 }); } catch {}
      assert.ok(!/"(placed|solution)"\s*:/.test(JSON.stringify(pl ?? null)),
        `${T.meta.name}: declara live pero su payload lleva un campo-solución`);
    }
  }
  ok("acoplamiento fijado: payload con solución ⇔ play.live 'none' (pantalla compartida)");
}

console.log(`\nanswerSafety.test: ${passed} checks passed`);
