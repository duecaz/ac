// LA ARITMÉTICA DEL MEDIDOR DE FLUIDEZ (Fase 0 del plan de rendimiento).
//
// El medidor existe para decidir con NÚMEROS qué animación hay que rehacer. Si
// la aritmética miente, la decisión se toma sobre humo: por eso los casos de
// abajo son los que despistan de verdad — una mediana buena con un p95 horrible
// (la animación que "va bien" y da tirones), la pestaña oculta que no emite
// cuadros, y el reloj que salta.
// Run: node tests/fluidez.test.mjs
import assert from 'node:assert';
import { resumenFluidez, intervalos, percentil, ventana, UMBRAL_LARGO } from '../core/fluidez.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

/** Marcas a partir de una lista de intervalos, que es como se piensa un caso. */
const marcasDe = (ivs) => ivs.reduce((acc, d) => [...acc, acc[acc.length - 1] + d], [0]);

// ── 60 fps clavados ─────────────────────────────────────────────────────────
{
  const r = resumenFluidez(marcasDe(Array(60).fill(16.7)));
  assert.strictEqual(r.cuadros, 60, 'un cuadro por intervalo: 61 marcas → 60 intervalos');
  assert.strictEqual(r.p50, 16.7);
  assert.strictEqual(r.p95, 16.7);
  assert.strictEqual(r.largos, 0);
  assert.strictEqual(r.fps, 60, '16,7 ms de mediana son 60 fps');
  ok('60 fps limpios: p50 = p95 = 16,7 ms, cero cuadros largos');
}

// ── LO QUE LA CLASE VE: mediana buena, p95 malo ─────────────────────────────
// 95 cuadros a 16 ms y 5 de 120 ms es «60 fps» de mediana y una animación que
// da tirones. Sin p95 ni cuenta de largos, este caso pasaría por sano.
{
  const r = resumenFluidez(marcasDe([...Array(95).fill(16), ...Array(5).fill(120)]));
  assert.strictEqual(r.p50, 16, 'la mediana sigue siendo buena');
  assert.strictEqual(r.p95, 120, 'y el p95 delata el tirón');
  assert.strictEqual(r.largos, 5, 'cinco cuadros por encima de 50 ms');
  ok('mediana buena + p95 malo: el tirón se ve en el p95 y en la cuenta de largos');
}

// ── El umbral de «largo» es 50 ms y se puede mover ──────────────────────────
{
  assert.strictEqual(UMBRAL_LARGO, 50, 'el umbral por defecto son 50 ms');
  const marcas = marcasDe([10, 51, 49, 80]);
  assert.strictEqual(resumenFluidez(marcas).largos, 2, '51 y 80 pasan de 50; 49 no');
  assert.strictEqual(resumenFluidez(marcas, { umbralLargo: 75 }).largos, 1, 'con umbral 75, solo el de 80');
  ok('cuadros largos: > umbral, y el umbral es un parámetro');
}

// ── Nada que medir no es cero fps inventado ─────────────────────────────────
{
  for (const caso of [[], [123], [NaN, NaN]]) {
    const r = resumenFluidez(caso);
    assert.deepStrictEqual(r, { cuadros: 0, p50: 0, p95: 0, largos: 0, fps: 0 },
      'sin al menos dos marcas válidas no hay medida');
  }
  ok('sin intervalos: todo a cero (no se inventa un fps)');
}

// ── Un reloj que retrocede no es un cuadro ──────────────────────────────────
{
  assert.deepStrictEqual(intervalos([0, 10, 5, 15]), [10, 10],
    'el salto hacia atrás se ignora y el siguiente se mide desde la marca real');
  assert.deepStrictEqual(intervalos([0, 'x', 10]), [10], 'lo que no es número finito no cuenta');
  ok('marcas sucias: retrocesos y basura no ensucian los intervalos');
}

// ── Percentil por rango más cercano (el mismo método que tools/perf-sonda.mjs) ─
{
  const ord = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.strictEqual(percentil(ord, 0.5), 6, 'mediana por rango: índice 5');
  assert.strictEqual(percentil(ord, 0.95), 10, 'p95 no se sale de la lista');
  assert.strictEqual(percentil([], 0.5), 0, 'lista vacía: 0');
  ok('percentil por rango, sin interpolar y sin desbordar');
}

// ── La ventana de 5 s poda, no acumula ──────────────────────────────────────
{
  const marcas = [0, 1000, 3000, 6000, 9000, 9500];
  assert.deepStrictEqual(ventana(marcas, 5000), [6000, 9000, 9500],
    'se cuenta hacia atrás desde la ÚLTIMA marca, no desde la primera');
  assert.deepStrictEqual(ventana([], 5000), []);
  ok('ventana de 5 s: se queda con la cola, medida desde la última marca');
}

// ── CONTRA-PRUEBA: la pestaña oculta no finge una pizarra rota ───────────────
// Con la pestaña en segundo plano el navegador deja de emitir cuadros: si el
// medidor calculara «cuadros / segundos» daría ~0 fps sobre una pantalla que
// nadie está mirando, y el dueño perseguiría un defecto que no existe. La
// mediana sigue describiendo el cuadro típico.
{
  const r = resumenFluidez(marcasDe([16, 16, 16, 4000, 16, 16]));
  assert.strictEqual(r.p50, 16, 'la mediana ignora el parón');
  assert.strictEqual(r.fps, 63, 'y los fps salen de la mediana, no de contar cuadros por segundo');
  assert.strictEqual(r.largos, 1, 'el parón se registra como UN cuadro largo, que es lo que fue');
  ok('CONTRA-PRUEBA: un parón largo no convierte la medida en «0 fps»');
}

console.log(`\n  ${passed} fluidez checks passed`);
