// Puntuación incremental compartida (acierto/fallo) — piso en 0 en un solo sitio.
import assert from 'node:assert';
import { applyPoints } from '../core/results.js';
let passed = 0; const ok = (m) => { passed++; console.log('  ✓', m); };

const sc = { pointsPerCorrect: 2, pointsPerWrong: -1 };
assert.strictEqual(applyPoints(0, sc, true), 2, 'acierto suma ppc');
assert.strictEqual(applyPoints(3, sc, false), 2, 'fallo resta ppw');
assert.strictEqual(applyPoints(0, sc, false), 0, 'fallo nunca baja de 0');
assert.strictEqual(applyPoints(5, { pointsPerCorrect: 1, pointsPerWrong: 0 }, false), 5, 'ppw 0 no cambia');
assert.strictEqual(applyPoints(0, undefined, true), 1, 'ppc por defecto 1');
ok('applyPoints: suma/resta con piso en 0 y defaults');

// ── CONTRA-PRUEBAS de la pasada de tipos (v1.51.674-676): lo que un `?? 0` o un
// `typeof` nuevo NO puede haber cambiado. Nacieron de la revisión humana del diff
// de runtime (docs/historico/revision-tipos-2026-09-10.md).
import { basePoints } from '../core/scoring/award.js';
import { scoreMarksPerHit } from '../core/scoring/marks.js';
assert.strictEqual(basePoints({ points: 5 }, { pointsPerCorrect: 2 }), 5, 'points del ítem manda');
assert.strictEqual(basePoints({ points: '5' }, { pointsPerCorrect: 2 }), 5, 'points como TEXTO ("5", contenido importado) sigue valiendo 5, como antes de tipar');
assert.strictEqual(basePoints({ points: 'abc' }, { pointsPerCorrect: 2 }), 2, 'points no numérico cae a pointsPerCorrect');
assert.strictEqual(basePoints({ points: 0 }, { pointsPerCorrect: 2 }), 2, 'points 0 cae a pointsPerCorrect (como el `||` de siempre)');
assert.strictEqual(basePoints(null, undefined), 1, 'sin ítem ni scoring: 1');
ok('basePoints: el tipado no cambió qué vale un ítem');
{
  const item = { text: 'a b c d', marks: [{ pos: 0, kind: 'tilde' }, { pos: 2, kind: 'tilde' }] };
  const r = scoreMarksPerHit([0, 2, 1, 3], item, ['tilde'], { scoring: { pointsPerCorrect: 10 } });
  assert.strictEqual(r.hits, 2, 'dos aciertos');
  assert.strictEqual(r.over, 2, 'dos de más');
  assert.strictEqual(r.points, 0, 'neto 0: marcar todo no gana (el `over ?? 0` del pie no lo tapa)');
  const bien = scoreMarksPerHit([0, 2], item, ['tilde'], { scoring: { pointsPerCorrect: 10 } });
  assert.strictEqual(bien.points, 20, 'y acertar las dos vale 20');
  ok('scoreMarksPerHit: `over` sigue restando y se sigue informando');
}
console.log(`\nscoring.test: ${passed} checks passed`);
