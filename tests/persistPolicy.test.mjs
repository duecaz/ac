// NORMA EJECUTABLE — qué persiste cada modo, y una sola fórmula de techo.
//
// Tres hallazgos de la radiografía del player, fijados aquí:
//   1. `trySaveResult` decidía con un `mode !== 'async-tracked'` suelto. Como la
//      vista de Tarea NO pasaba ese modo, cada tarea escribía su intento Y una
//      fila `results` fantasma (guardado DOBLE).
//   2. VS y Equipos no guardaban nada — pero no por decisión, sino porque nadie
//      lo escribió. Ahora está DECLARADO (y explicado) en core/persistPolicy.js.
//   3. El techo (`maxScore`) se calculaba con tres fórmulas distintas, así que el
//      "X / max" de la pantalla podía no coincidir con el registrado.
//
// Run: node tests/persistPolicy.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PERSIST, savesResult, DEFAULT_MODE } from '../core/persistPolicy.js';
import { defaultMaxScore } from '../core/scoring/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── 1. La política cubre los modos reales y es coherente ────────────────────
{
  for (const m of ['solo', 'async-tracked', 'live-student', 'vs', 'teams']) {
    assert.ok(PERSIST[m], `la política declara el modo "${m}"`);
  }
  assert.strictEqual(savesResult('solo'), true, 'Individual guarda su resultado');
  assert.strictEqual(savesResult(undefined), true, `sin modo → ${DEFAULT_MODE} (guarda)`);
  assert.strictEqual(savesResult('async-tracked'), false, 'Tarea NO escribe en results (el intento va a assignment_attempts)');
  assert.strictEqual(savesResult('live-student'), false, 'Live no guarda desde el alumno (lo liquida el host)');
  assert.strictEqual(savesResult('vs'), false, 'VS no persiste (declarado, con motivo)');
  assert.strictEqual(savesResult('teams'), false, 'Equipos no persiste (declarado, con motivo)');
  assert.strictEqual(savesResult('modo-que-no-existe'), false, 'un modo desconocido NO guarda (fail-safe)');
  // Ningún modo puede declarar a la vez las dos escrituras del alumno: sería el
  // guardado doble que este módulo existe para impedir.
  for (const [m, p] of Object.entries(PERSIST)) {
    assert.ok(!(p.results && p.attempts), `"${m}" no puede escribir results Y attempts a la vez (guardado doble)`);
  }
  ok('la política declara los 5 modos y ninguno guarda dos veces');
}

// ── 2. La vista de Tarea declara su modo (si no, vuelve el guardado doble) ──
{
  const src = read('views/studentTask.js');
  assert.match(src, /mode:\s*'async-tracked'/,
    "views/studentTask.js debe pasar mode:'async-tracked' a runPlayer — sin él, results.js lo trata como Individual y la tarea se guarda DOBLE (y además se reanudaría con F5)");
  assert.match(src, /assignmentGate\(/,
    'el gateo de la tarea sale de core/assignmentRules.js, no reescrito a mano en la vista');
  ok('Tarea declara su modo y usa el gateo compartido');
}

// ── 3. `results.js` obedece a la política (no a un literal suelto) ──────────
{
  const src = read('core/results.js');
  assert.match(src, /savesResult\(/, 'trySaveResult consulta la política');
  assert.ok(!/mode\s*!==\s*'async-tracked'/.test(src),
    'ya no queda el gateo literal por modo dentro de results.js');
  ok('trySaveResult lee la política declarada, sin literales sueltos');
}

// ── 4. Una sola fórmula de techo ────────────────────────────────────────────
{
  assert.strictEqual(defaultMaxScore({ scoring: { pointsPerCorrect: 2 } }, 5), 10, '2 × 5 ítems');
  assert.strictEqual(defaultMaxScore({ scoring: { maxScore: 99, pointsPerCorrect: 2 } }, 5), 99, 'el máximo declarado manda');
  assert.strictEqual(defaultMaxScore({}, 4), 4, 'sin config → 1 por ítem');
  assert.strictEqual(defaultMaxScore(null, 0), 0, 'sin actividad ni ítems → 0 (no NaN)');
  // El shell secuencial debe ENTREGAR el techo al caller (si no, Tarea vuelve a
  // recalcularlo por su cuenta → dos denominadores para el mismo intento).
  const shell = read('core/soloPlayer.js');
  assert.match(shell, /opts\.onFinish\(\{\s*\.\.\.state,\s*maxScore/,
    'runSequentialPlayer pasa maxScore (y timeUsed) en onFinish');
  assert.match(shell, /defaultMaxScore\(/, 'el shell usa la fórmula común');
  const task = read('views/studentTask.js');
  assert.match(task, /state\.maxScore\s*\?\?/, 'Tarea usa el techo que le da el shell (respaldo: la fórmula común)');
  assert.ok(!/pointsPerCorrect\s*\|\|\s*1\)\s*\*\s*activityItemCount/.test(task),
    'Tarea ya no lleva su copia local de la fórmula del techo');
  ok('un solo techo: la fórmula vive en core/scoring y el shell la entrega al caller');
}

console.log(`\npersistPolicy.test: ${passed} checks passed`);
