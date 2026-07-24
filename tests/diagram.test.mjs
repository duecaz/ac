// Etiqueta el diagrama — modelo de contenido + scorer + contrato. Puro (sin DOM).
// Run: node tests/diagram.test.mjs
import assert from 'node:assert';
import { newPin, newEmpty, validate } from '../core/contentModels/diagram.js';
import { scoreDiagramSubmission } from '../templates/diagram/scorer.js';
import '../templates/diagram/index.js';   // side-effect: registra la plantilla
import { getTemplate } from '../core/registry.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── modelo de contenido ────────────────────────────────────────────────────────
{
  const p = newPin(0.3, 0.7);
  assert.ok(p.id && p.id.startsWith('pin_'), 'newPin genera id');
  assert.deepStrictEqual([p.x, p.y], [0.3, 0.7], 'newPin guarda x,y');
  assert.strictEqual(p.label, '', 'newPin empieza sin etiqueta');
  assert.deepStrictEqual(newEmpty(), { image: null, pins: [] }, 'newEmpty vacío');
  assert.deepStrictEqual(validate({ pins: [] }), [], 'validate ok con array');
  assert.strictEqual(validate({}).length, 1, 'validate exige pins array');
  ok('modelo diagram: newPin / newEmpty / validate');
}

// ── scorer: acierto si la etiqueta va a SU pin (label id === pin id) ───────────
{
  const item = { id: 'pin_a', label: 'Cabeza' };
  const act = { scoring: { pointsPerCorrect: 1 } };
  assert.deepStrictEqual(scoreDiagramSubmission({ value: 'pin_a', item, activity: act }), { correct: true, points: 1, hits: 1, total: 1 }, 'a su pin → 1');
  assert.deepStrictEqual(scoreDiagramSubmission({ value: 'pin_b', item, activity: act }), { correct: false, points: 0, hits: 0, total: 1 }, 'a otro pin → 0');
  assert.strictEqual(scoreDiagramSubmission({ value: 'pin_a', item, activity: { scoring: { pointsPerCorrect: 5 } } }).points, 5, 'respeta ppc');
  ok('scoreDiagramSubmission: etiqueta↔su pin');
}

// ── contrato de plantilla ──────────────────────────────────────────────────────
{
  const T = getTemplate('diagram');
  assert.ok(T, 'diagram registrada');
  assert.strictEqual(T.meta.contentModel, 'diagram', 'contentModel diagram');
  assert.strictEqual(typeof T.renderPlayer, 'function', 'tiene renderPlayer');
  assert.strictEqual(typeof T.renderEditor, 'function', 'tiene renderEditor');
  assert.strictEqual(T.meta.modes.live, false, 'no es live (pantalla única)');
  const dc = T.meta.defaultContent();
  assert.ok(dc.image && dc.pins.length >= 3, 'defaultContent trae imagen + pines jugables');
  assert.ok(dc.pins.every(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1), 'pines con x,y en 0..1');
  ok('contrato: diagram registrada, contentModel, defaultContent jugable');
}

console.log(`\ndiagram.test: ${passed} checks passed`);
