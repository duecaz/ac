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
console.log(`\nscoring.test: ${passed} checks passed`);
