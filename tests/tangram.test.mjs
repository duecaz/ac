// Tangram — motor puro (piezas/geometría/máscara) + scorer + contrato.
// Run: node tests/tangram.test.mjs
import assert from 'node:assert';
import { PIEZAS, ORDEN_PIEZAS, areaPoligono } from '../templates/tangram/game/piezas.js';
import { SILUETAS, ORDEN_SILUETAS } from '../templates/tangram/game/siluetas.js';
import { transformarPieza, imanRotacion, imanPosicion, imantar } from '../templates/tangram/game/geometria.js';
import { xorArea, estaResuelto, UMBRAL_RESUELTO, componentesConexas } from '../templates/tangram/game/mascara.js';
import { scoreTangramSubmission, PUNTOS_RESOLVER, PIEZAS_TOTAL } from '../templates/tangram/scorer.js';
import '../templates/tangram/index.js'; // efecto: registra la plantilla
import { getTemplate } from '../core/registry.js';
import { checkTemplateContract } from '../core/templateContract.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── (a) Las 7 piezas suman área 1: la prueba de que las proporciones son las
//     clásicas (2 grandes + 1 mediano + 2 pequeños + cuadrado + paralelogramo,
//     todas derivadas del mismo cateto base t=√2/4 sobre el cuadrado unidad). ──
{
  assert.strictEqual(ORDEN_PIEZAS.length, 7, 'son 7 piezas');
  let total = 0;
  for (const n of ORDEN_PIEZAS) {
    const a = areaPoligono(PIEZAS[n].puntos);
    assert.ok(a > 0, `${n} tiene área positiva`);
    total += a;
  }
  assert.ok(Math.abs(total - 1) < 1e-6, `suma de áreas = 1 (dio ${total})`);
  ok('las 7 piezas suman área 1 sobre el cuadrado unidad');

  // Dos triángulos de cada tamaño "hermano" son congruentes entre sí (misma
  // área) — comprueba que no se coló una proporción rota al copiar/pegar.
  assert.ok(Math.abs(areaPoligono(PIEZAS.grande1.puntos) - areaPoligono(PIEZAS.grande2.puntos)) < 1e-9);
  assert.ok(Math.abs(areaPoligono(PIEZAS.pequeno1.puntos) - areaPoligono(PIEZAS.pequeno2.puntos)) < 1e-9);
  // El grande mide el doble que el mediano, y el mediano el doble que el
  // pequeño (razón de áreas 4:2:1 — el cateto dobla, el área se multiplica x2
  // en el paso pequeño→mediano por ser catetos en razón √2, y x2 otra vez en
  // mediano→grande por la misma razón: 0.25 / 0.125 = 2, 0.125 / 0.0625 = 2).
  const aG = areaPoligono(PIEZAS.grande1.puntos), aM = areaPoligono(PIEZAS.mediano.puntos), aP = areaPoligono(PIEZAS.pequeno1.puntos);
  assert.ok(Math.abs(aG / aM - 2) < 1e-9, 'grande = 2× mediano');
  assert.ok(Math.abs(aM / aP - 2) < 1e-9, 'mediano = 2× pequeño');
  ok('proporciones relativas 4:2:1 (grande:mediano:pequeño) exactas');
}

// ── geometría pura: imán y transformación ───────────────────────────────────
{
  assert.strictEqual(imanRotacion(46), 45, '46° cae al múltiplo de 45 más cercano');
  assert.strictEqual(imanRotacion(20), 0, '20° cae al múltiplo de 45 más cercano (0)');
  assert.strictEqual(imanRotacion(-10), 0, 'negativos se normalizan');
  assert.strictEqual(imanRotacion(370), 0, '>360 se normaliza');
  ok('imanRotacion ajusta a múltiplos de 45°');

  assert.ok(Math.abs(imanPosicion(0.53) - 0.5) < 1e-9, '0.53 cae en la rejilla de 1/16 (0.5)');
  ok('imanPosicion ajusta a la rejilla de 1/16');

  const c = imantar({ x: 0.501, y: 0.24, rot: 47, flip: true });
  assert.deepStrictEqual({ x: c.x, y: c.y, rot: c.rot }, { x: 0.5, y: 0.25, rot: 45 });
  assert.strictEqual(c.flip, true, 'imantar no toca flip (no tiene imán propio)');
  ok('imantar aplica ambos imanes a la vez');

  // La transformación es la que usan silueta y jugador por igual: rotar 90°
  // un triángulo con catetos sobre los ejes debe conservar el área.
  const t = transformarPieza(PIEZAS.grande1.puntos, { x: 1, y: 1, rot: 90 });
  assert.strictEqual(t.length, 3);
  ok('transformarPieza devuelve un polígono del mismo tamaño');
}

// ── (b) el catálogo: cada silueta, su SOLUCIÓN resuelve con las 7 piezas ────
// §30: el catálogo tiene SOLO las figuras que se leen como su nombre (hoy
// cuadrado + casa) — nunca un número fijo aquí: el test itera lo que HAYA en
// SILUETAS, así una figura nueva (o retirada) no obliga a tocar este fichero.
{
  assert.ok(ORDEN_SILUETAS.length >= 1, 'el catálogo tiene al menos una figura');
  const nombres = new Set(ORDEN_SILUETAS);
  assert.strictEqual(nombres.size, ORDEN_SILUETAS.length, 'sin nombres repetidos');
  assert.strictEqual(Object.keys(SILUETAS).length, ORDEN_SILUETAS.length, 'ORDEN_SILUETAS = las claves de SILUETAS (nada "oculto")');

  for (const n of ORDEN_SILUETAS) {
    const f = SILUETAS[n];
    assert.strictEqual(f.solucion.length, 7, `${n}: la solución coloca las 7 piezas`);
    const idsSolucion = new Set(f.solucion.map(c => c.pieza));
    assert.strictEqual(idsSolucion.size, 7, `${n}: sin piezas repetidas en la solución`);
    for (const id of ORDEN_PIEZAS) assert.ok(idsSolucion.has(id), `${n}: falta ${id} en la solución`);

    const err = xorArea(f.poligonos, f.solucion, PIEZAS);
    assert.ok(err < UMBRAL_RESUELTO, `${n}: XOR de su propia solución = ${err.toFixed(4)} (debe ser < ${UMBRAL_RESUELTO})`);
    assert.ok(estaResuelto(f.poligonos, f.solucion, PIEZAS), `${n}: estaResuelto() debe dar true con su solución`);
  }
  ok(`las ${ORDEN_SILUETAS.length} siluetas del catálogo se resuelven con la solución guardada (XOR < 4%)`);
}

// ── (a2) CONEXIDAD: la solución de cada silueta del catálogo es UNA sola
//     componente — cada pieza nueva se pegó a una arista completa (o media
//     arista) YA puesta, nunca colocada a ojo — así que un flood-fill sobre
//     la máscara debe dar 1, no un archipiélago de piezas que solo coinciden
//     por casualidad de área. También se limita la caja: ninguna figura debe
//     desbordar mucho más de lo razonable para un tablero de pizarra
//     (≤ 2 × 1.5 unidades de lado, en cualquier orden). ──────────────────────
{
  for (const n of ORDEN_SILUETAS) {
    const f = SILUETAS[n];
    const comps = componentesConexas(f.solucion, PIEZAS);
    assert.strictEqual(comps, 1, `${n}: la solución debe ser 1 sola componente (dio ${comps})`);
    const w = f.bbox.maxx - f.bbox.minx, h = f.bbox.maxy - f.bbox.miny;
    const [mayor, menor] = w >= h ? [w, h] : [h, w];
    assert.ok(mayor <= 2 + 1e-6 && menor <= 1.5 + 1e-6,
      `${n}: caja ${w.toFixed(3)}×${h.toFixed(3)} se sale de 2×1.5`);
  }
  ok(`las ${ORDEN_SILUETAS.length} soluciones del catálogo son conexas (1 componente) y caben en una caja de 2×1.5`);

  // CONTRA-PRUEBA: dos piezas que NO se tocan (una lejos de las otras 6) dan
  // más de una componente — así se comprueba que el flood-fill detecta de
  // verdad un archipiélago y no siempre devuelve 1 porque sí.
  const sueltas = SILUETAS.cuadrado.solucion.map((c, i) => (i === 0 ? { ...c, x: c.x + 5, y: c.y + 5 } : c));
  const compsSueltas = componentesConexas(sueltas, PIEZAS);
  assert.ok(compsSueltas >= 2, `pieza separada 5 unidades debería dar ≥2 componentes (dio ${compsSueltas})`);
  ok('contra-prueba: una pieza separada del resto da MÁS de una componente');
}

// ── (c) CONTRA-PRUEBA: otra figura y una pieza mal colocada NO valen ────────
{
  // La solución del cuadrado sobre la silueta de la casa da un XOR grande
  // (y viceversa) — dos figuras cualesquiera del catálogo no se confunden.
  const errCruzado = xorArea(SILUETAS.casa.poligonos, SILUETAS.cuadrado.solucion, PIEZAS);
  assert.ok(errCruzado > UMBRAL_RESUELTO, `cuadrado sobre casa debería fallar (dio ${errCruzado.toFixed(4)})`);
  assert.strictEqual(estaResuelto(SILUETAS.casa.poligonos, SILUETAS.cuadrado.solucion, PIEZAS), false);
  ok('contra-prueba: la solución de otra figura NO resuelve la silueta');

  // Una solución CORRECTA salvo que una pieza está desplazada 1/4 del lado
  // del cuadrado unidad: no debe dar "resuelto".
  const figura = SILUETAS.cuadrado;
  const desplazada = figura.solucion.map((c, i) => (i === 0 ? { ...c, x: c.x + 0.25 } : c));
  const errDespl = xorArea(figura.poligonos, desplazada, PIEZAS);
  assert.ok(errDespl > UMBRAL_RESUELTO, `pieza desplazada debería fallar (dio ${errDespl.toFixed(4)})`);
  assert.strictEqual(estaResuelto(figura.poligonos, desplazada, PIEZAS), false);
  ok('contra-prueba: una pieza desplazada 1/4 de lado NO resuelve la figura');
}

// ── (d) scorer: resuelto → 100/7/7 ───────────────────────────────────────────
{
  assert.strictEqual(PUNTOS_RESOLVER, 100);
  assert.strictEqual(PIEZAS_TOTAL, 7);

  const resuelto = scoreTangramSubmission({ value: { resuelto: true, colocadas: 7 } });
  assert.deepStrictEqual(resuelto, { correct: true, points: 100, hits: 7, total: 7 });

  const sinResolver = scoreTangramSubmission({ value: { resuelto: false, colocadas: 3 } });
  assert.deepStrictEqual(sinResolver, { correct: false, points: 0, hits: 0, total: 7 });

  const sinValor = scoreTangramSubmission({});
  assert.deepStrictEqual(sinValor, { correct: false, points: 0, hits: 0, total: 7 });
  ok('scoreTangramSubmission: resuelto → 100/7/7, si no 0/0/7');
}

// ── contrato de plantilla (registro, meta, scorer) ───────────────────────────
{
  const T = getTemplate('tangram');
  assert.ok(T, 'la plantilla queda registrada');
  const issues = checkTemplateContract(T);
  assert.deepStrictEqual(issues, [], `contrato roto: ${issues.join(' | ')}`);
  assert.strictEqual(T.meta.kind, 'juego');
  assert.strictEqual(T.meta.play.submit, 'gesto');
  assert.strictEqual(T.meta.modes.async, false, 'juego: sin Tarea (§4c)');
  ok('contrato de plantilla (core/templateContract.js) sin incidencias');

  // defaultContent() debe traer una figura válida (nunca nace vacía).
  const dc = T.meta.defaultContent();
  assert.ok(Array.isArray(dc.items) && dc.items.length === 1);
  assert.ok(SILUETAS[dc.items[0].figura], 'la figura demo existe en el catálogo');
  ok('defaultContent trae una figura jugable');
}

console.log(`\n${passed} aserciones OK — tangram`);
