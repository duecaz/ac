// PenDetector — clasificación por tamaño de contacto + derivación de umbrales.
// Run: node tests/penDetector.test.mjs
import assert from 'node:assert';
import {
  DEFAULT_THRESHOLDS, classifyTool, toolAction, pointerMetric,
  deriveThresholds, loadThresholds,
} from '../core/penDetector.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── métrica del puntero ───────────────────────────────────────────────────────
{
  assert.strictEqual(pointerMetric({ width: 0, height: 0 }), 0, 'sin geometría → 0');
  assert.strictEqual(pointerMetric({ width: 2, height: 2 }), 1, 'radio medio = diámetro/2');
  assert.strictEqual(pointerMetric({}), 0, 'campos ausentes → 0');
  ok('pointerMetric devuelve el radio medio del contacto');
}

// ── clasificación con umbrales por defecto (SIN calibrar) ─────────────────────
{
  const T = DEFAULT_THRESHOLDS;
  assert.strictEqual(classifyTool(0.5, 1, T), 'penThin',  'ratón/lápiz fino → penThin');
  assert.strictEqual(classifyTool(20, 1, T),  'penThick', 'dedo (mediano) → penThick (dibuja) sin calibrar');
  assert.strictEqual(classifyTool(5, 3, T),   'palm',     '≥3 puntos → palma (prioritario)');
  assert.strictEqual(toolAction('penThin'),  'draw',  'lápiz punta dibuja');
  assert.strictEqual(toolAction('penThick'), 'draw',  'dedo dibuja');
  assert.strictEqual(toolAction('eraser'),   'erase', 'lápiz trasero borra');
  assert.strictEqual(toolAction('palm'),     'erase', 'palma borra');
  ok('sin calibrar: todo dibuja salvo la palma (=Fase 1)');
}

// ── derivación de umbrales tras calibrar ──────────────────────────────────────
{
  // lápiz punta pequeño, dedo mediano, lápiz trasero grande.
  const thr = deriveThresholds({ penTip: 1, dedo: 5, trasera: 15 });
  // frontera punta↔dedo = 3 ; frontera dedo↔trasero = 10
  assert.strictEqual(thr.penThin.max, 3,  'frontera lápiz↔dedo = punto medio (3)');
  assert.strictEqual(thr.penThick.min, 3, 'penThick empieza en la frontera');
  assert.strictEqual(thr.penThick.max, 10, 'frontera dedo↔borrador = punto medio (10)');
  assert.strictEqual(thr.eraser.min, 10, 'borrador empieza en la frontera');

  // ahora el lápiz trasero (métrica 15) SÍ se clasifica como borrador → borra.
  assert.strictEqual(classifyTool(15, 1, thr), 'eraser', 'tras calibrar, lápiz trasero → eraser');
  assert.strictEqual(toolAction(classifyTool(15, 1, thr)), 'erase', 'y por tanto BORRA');
  // el dedo (5) sigue dibujando.
  assert.strictEqual(toolAction(classifyTool(5, 1, thr)), 'draw', 'el dedo sigue dibujando');
  ok('deriveThresholds separa dibujar/borrar por punto medio entre herramientas');
}

// ── tolera medidas parciales y entorno sin sessionStorage (node) ──────────────
{
  const base = loadThresholds();
  assert.ok(base.penThin && base.eraser && base.palm, 'loadThresholds devuelve defaults sin sessionStorage');
  const thr = deriveThresholds({ penTip: 2 });  // solo midió el lápiz
  assert.strictEqual(thr.penThin.max, 3, 'solo lápiz: penThin.max = tip+1');
  assert.strictEqual(thr.eraser.min, DEFAULT_THRESHOLDS.eraser.min, 'sin trasera, borrador sigue desactivado');
  ok('robusto ante calibración parcial y sin almacenamiento');
}

console.log(`\npenDetector.test: ${passed} checks passed`);
