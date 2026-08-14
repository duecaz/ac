// «PUNTOS POR ACIERTO» TIENE QUE MANDAR — y no mandaba.
//
// El caso del dueño (2026-08-14, foto del podio): en Operaciones puso «Puntos
// por acierto: 10», jugó un duelo y el ganador salió con «3 pts · 3 de 3
// aciertos» — uno por operación. El campo del panel no hacía nada.
//
// Motivo: la fórmula única es `item.points || scoring.pointsPerCorrect`, y CADA
// ítem nacía con un `points: 1` sembrado por el modelo `qa`. Ese 1 invisible
// ganaba siempre, en TODOS los modos. Los puntos por ítem son una función real
// (una pregunta puede valer más), pero solo el editor de Quiz los enseña: un
// valor que el profe no puede ver no puede mandar sobre uno que sí ve.
// Run: node tests/puntosPorAcierto.test.mjs
import assert from 'node:assert';
import '../core/registerTemplates.js';
import { listTemplates, getTemplate } from '../core/registry.js';
import { migrate, newActivity } from '../core/migrate.js';
import { SCHEMA_VERSION } from '../core/constants.js';
import { basePoints } from '../core/scoring/index.js';
import { readFileSync, existsSync } from 'node:fs';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Solo plantillas REALES: `listTemplates()` incluye los dobles que registran
// otras suites en el mismo proceso (`t_solo`), y un doble sin carpeta no tiene
// ni migración ni fuente que escanear.
const QA = listTemplates()
  .filter(T => T.meta?.contentModel === 'qa')
  .map(T => T.meta.name)
  .filter(n => existsSync(new URL(`../templates/${n}/template.js`, import.meta.url)));

// ── El caso exacto de la foto: actividad YA GUARDADA ─────────────────────────
{
  for (const tpl of QA) {
    const guardada = migrate({
      id: 'x', template: tpl, title: 'Operaciones', schemaVersion: SCHEMA_VERSION, templateVersion: 1,
      scoring: { mode: 'flat', pointsPerCorrect: 10, pointsPerWrong: 0 },
      content: { items: [{ id: 'm1', question: '2 × 6', answer: '12', options: ['12', '10'], answerIdx: [0], points: 1 }] },
    });
    assert.strictEqual(basePoints(guardada.content.items[0], guardada.scoring), 10,
      `${tpl}: lo ya guardado con el 1 sembrado debe seguir al panel tras migrar`);
  }
  ok(`las ${QA.length} plantillas del modelo qa migran lo guardado: el panel vuelve a mandar (1 → 10)`);
}

// ── Y una actividad nueva, por el camino real ────────────────────────────────
{
  for (const tpl of QA) {
    const a = newActivity(tpl);
    a.scoring.pointsPerCorrect = 10;
    for (const it of a.content.items) {
      assert.strictEqual(basePoints(it, a.scoring), 10, `${tpl}: recién creada, el acierto vale lo del panel`);
    }
  }
  ok('una actividad nueva nace SIN puntos por ítem: el acierto vale lo que dice el panel');
}

// ── CONTRA-PRUEBA: el peso POR PREGUNTA sigue siendo una función real ────────
// Quiz deja poner puntos distintos por pregunta («Avanzado»). Eso NO se toca:
// la migración solo quita el 1 sembrado, que es el que no se podía distinguir
// de «sin elegir».
{
  const a = migrate({
    id: 'y', template: 'quiz', title: 'Repaso', schemaVersion: SCHEMA_VERSION, templateVersion: 1,
    scoring: { mode: 'flat', pointsPerCorrect: 2 },
    content: { items: [
      { id: 'q1', question: 'vale 5', answer: 'a', options: ['a', 'b'], answerIdx: [0], points: 5 },
      { id: 'q2', question: 'sigue al panel', answer: 'a', options: ['a', 'b'], answerIdx: [0], points: 1 },
    ] },
  });
  assert.strictEqual(basePoints(a.content.items[0], a.scoring), 5, 'un peso elegido a propósito se respeta');
  assert.strictEqual(basePoints(a.content.items[1], a.scoring), 2, 'y el sembrado pasa a seguir al panel');
  ok('CONTRA-PRUEBA: los puntos por pregunta elegidos a mano siguen mandando (solo se quita el 1 sembrado)');
}

// ── La migración es IDEMPOTENTE (§24) ────────────────────────────────────────
{
  const T = getTemplate('math');
  const c = { items: [{ id: 'm1', question: '1+1', answer: '2', points: 1 }] };
  const una = T.migrateContent(structuredClone(c), 1);
  const dos = T.migrateContent(structuredClone(una), 1);
  assert.deepStrictEqual(dos, una, 'migrar dos veces da lo mismo');
  assert.ok(!('points' in dos.items[0]));
  ok('la migración es idempotente');
}

// ── GUARDARRAÍL DE DESCUBRIMIENTO: que no vuelva a sembrarse ─────────────────
// Se escanea la FUENTE de las plantillas del modelo qa: un `points: 1` escrito
// en un contenido de muestra o en un «Añadir pregunta» reabre el agujero, y lo
// haría en silencio (todo sigue verde, el panel deja de mandar otra vez).
{
  const culpables = [];
  for (const tpl of QA) {
    for (const f of ['template.js', 'editor.js']) {
      let src = '';
      try { src = readFileSync(new URL(`../templates/${tpl}/${f}`, import.meta.url), 'utf8'); } catch { continue; }
      // Sin comentarios: el motivo se explica ahí y no debe contar como uso.
      const limpio = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      if (/points:\s*1\b/.test(limpio)) culpables.push(`${tpl}/${f}`);
    }
  }
  assert.deepStrictEqual(culpables, [],
    `siembran «points: 1» otra vez (anula «Puntos por acierto»): ${culpables.join(', ')}`);
  ok('ninguna plantilla del modelo qa vuelve a sembrar «points: 1»');
}

console.log(`\n  ${passed} puntosPorAcierto checks passed`);
