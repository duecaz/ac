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

// ── DOS HERRAMIENTAS, UNA FRONTERA (v1.51.610) ───────────────────────────────
// Eran cuatro (punta · dedo · trasera · palma) y por tanto tres fronteras. Punta
// y dedo hacían lo MISMO —dibujar—, así que separarlas no cambiaba nada y daba
// dos maneras más de colocar mal la única frontera que importa.
{
  const T = DEFAULT_THRESHOLDS;
  // SIN CALIBRAR el tamaño no borra: no se ha medido el aparato, así que no hay
  // forma de saber qué es «grande» en él. Solo el conteo de contactos borra.
  assert.strictEqual(classifyTool(0.5, 1, T), 'dedo', 'ratón / punta de lápiz → dedo (dibuja)');
  assert.strictEqual(classifyTool(20, 1, T),  'dedo',
    'SIN calibrar, ni un contacto enorme borra: el defecto seguro es no destruir nada');
  assert.strictEqual(classifyTool(5, 3, T),   'palma', '≥3 contactos a la vez → palma, sin mirar el tamaño');
  assert.strictEqual(toolAction('dedo'),  'draw',  'el dedo y todo lo más pequeño escriben');
  assert.strictEqual(toolAction('palma'), 'erase', 'solo la palma borra');
  ok('dos herramientas: lo pequeño escribe, la palma borra (y sin calibrar solo borra por conteo)');
}

// ── LA FRONTERA sale del punto medio, y hacen falta LAS DOS medidas ──────────
{
  const thr = deriveThresholds({ dedo: 6, palma: 20 });
  assert.strictEqual(thr.palma.min, 13, 'la frontera es el punto medio entre dedo y palma');
  assert.strictEqual(classifyTool(10, 1, thr), 'dedo',  'por debajo de la frontera, escribe');
  assert.strictEqual(classifyTool(16, 1, thr), 'palma', 'por encima, borra — aunque sea UN solo contacto');
  // Con UNA sola medida NO se inventa la frontera. Antes se adivinaba
  // (`trasera - 1`): un punto no describe un aparato, y el error se paga borrando
  // lo que el alumno había escrito.
  assert.strictEqual(deriveThresholds({ palma: 20 }).palma.min, 1e9,
    'con solo la palma medida no hay frontera: se queda en el defecto seguro');
  assert.strictEqual(deriveThresholds({ dedo: 6 }).palma.min, 1e9,
    'y con solo el dedo, tampoco');
  // CONTRA-PRUEBA: una palma medida MÁS PEQUEÑA que el dedo es una calibración
  // mal hecha (recuadros al revés). No se acepta, o todo pasaría a borrar.
  assert.strictEqual(deriveThresholds({ dedo: 20, palma: 6 }).palma.min, 1e9,
    'CONTRA-PRUEBA: si la palma mide menos que el dedo, la calibración está al revés y no se aplica');
  ok('la frontera es el punto medio, exige las DOS medidas, y rechaza una calibración al revés');
}

// ── El conteo manda aunque el tamaño diga lo contrario ──────────────────────
{
  const thr = deriveThresholds({ dedo: 6, palma: 20 });
  assert.strictEqual(classifyTool(1, 3, thr), 'palma',
    'tres contactos finos siguen siendo una palma: hay pizarras que la reportan así');
  ok('las DOS señales valen: una pizarra reporta la palma como un contacto grande y otra como varios');
}

console.log(`\npenDetector.test: ${passed} checks passed`);
