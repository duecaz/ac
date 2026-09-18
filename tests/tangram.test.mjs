// Tangram — motor puro (piezas/geometría/máscara) + scorer + contrato.
// Run: node tests/tangram.test.mjs
import assert from 'node:assert';
import { PIEZAS, ORDEN_PIEZAS, areaPoligono } from '../templates/tangram/game/piezas.js';
import { SILUETAS, ORDEN_SILUETAS } from '../templates/tangram/game/siluetas.js';
import { transformarPieza, imanRotacion, imanPosicion, imantar, poligonosDe, bboxDe, transformarEnSitio } from '../templates/tangram/game/geometria.js';
import { xorArea, estaResuelto, UMBRAL_RESUELTO, componentesConexas } from '../templates/tangram/game/mascara.js';
import { scoreTangramSubmission, PUNTOS_RESOLVER, PIEZAS_TOTAL } from '../templates/tangram/scorer.js';
import { ensureContent, normalizarItem } from '../templates/tangram/content.js';
import { TangramTemplate } from '../templates/tangram/template.js';
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

    const silueta = poligonosDe(f.solucion, PIEZAS);
    const err = xorArea(silueta, f.solucion, PIEZAS);
    assert.ok(err < UMBRAL_RESUELTO, `${n}: XOR de su propia solución = ${err.toFixed(4)} (debe ser < ${UMBRAL_RESUELTO})`);
    assert.ok(estaResuelto(silueta, f.solucion, PIEZAS), `${n}: estaResuelto() debe dar true con su solución`);
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
    const caja = bboxDe(poligonosDe(f.solucion, PIEZAS));
    const w = caja.maxx - caja.minx, h = caja.maxy - caja.miny;
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
  const casa = poligonosDe(SILUETAS.casa.solucion, PIEZAS);
  const errCruzado = xorArea(casa, SILUETAS.cuadrado.solucion, PIEZAS);
  assert.ok(errCruzado > UMBRAL_RESUELTO, `cuadrado sobre casa debería fallar (dio ${errCruzado.toFixed(4)})`);
  assert.strictEqual(estaResuelto(casa, SILUETAS.cuadrado.solucion, PIEZAS), false);
  ok('contra-prueba: la solución de otra figura NO resuelve la silueta');

  // Una solución CORRECTA salvo que una pieza está desplazada 1/4 del lado
  // del cuadrado unidad: no debe dar "resuelto".
  const figura = SILUETAS.cuadrado, cuadrado = poligonosDe(figura.solucion, PIEZAS);
  const desplazada = figura.solucion.map((c, i) => (i === 0 ? { ...c, x: c.x + 0.25 } : c));
  const errDespl = xorArea(cuadrado, desplazada, PIEZAS);
  assert.ok(errDespl > UMBRAL_RESUELTO, `pieza desplazada debería fallar (dio ${errDespl.toFixed(4)})`);
  assert.strictEqual(estaResuelto(cuadrado, desplazada, PIEZAS), false);
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

  // defaultContent() debe traer una figura válida (nunca nace vacía): v2, con
  // nombre y las 7 colocaciones, y esa figura se resuelve con sus propias piezas.
  const dc = T.meta.defaultContent();
  assert.ok(Array.isArray(dc.items) && dc.items.length === 1);
  const demo = dc.items[0];
  assert.ok(demo.nombre && demo.colocaciones.length === 7, 'el ítem demo es v2 (nombre + 7 colocaciones)');
  assert.ok(estaResuelto(poligonosDe(demo.colocaciones), demo.colocaciones, PIEZAS), 'la figura demo se resuelve con sus propias colocaciones');
  ok('defaultContent trae una figura jugable (v2)');
}

// ── (e) poligonosDe = LA derivación de la silueta (§21b), y LAS PIEZAS NO SE
//     PISAN. Esta segunda parte es la que faltaba: hasta v1.51.715 el catálogo
//     se comprobaba contra SÍ MISMO (la silueta salía de la solución, así que
//     encajar era trivial) y nadie miraba si las 7 piezas teselaban de verdad.
//     «Cuadrado» llevaba versiones sin ser un cuadrado —la pieza del cuadrado
//     colgaba fuera y dentro quedaban dos huecos— y solo se vio cuando el
//     editor las pintó de colores. El área de la unión lo dice sin dibujar
//     nada: si dos piezas se solapan, la unión mide menos que 1.
{
  /** Área de la unión, rasterizando sobre la caja de la figura. */
  const areaUnion = (colocaciones, n = 480) => {
    const polis = poligonosDe(colocaciones, PIEZAS);
    const c = bboxDe(polis);
    const w = c.maxx - c.minx, h = c.maxy - c.miny;
    const dentro = (pts, x, y) => {
      let d = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < xi + ((y - yi) / (yj - yi)) * (xj - xi)) d = !d;
      }
      return d;
    };
    let con = 0;
    for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) {
      const x = c.minx + ((q + 0.5) / n) * w, y = c.miny + ((r + 0.5) / n) * h;
      if (polis.some(p => dentro(p, x, y))) con++;
    }
    return (con / (n * n)) * w * h;
  };

  for (const n of ORDEN_SILUETAS) {
    const union = areaUnion(SILUETAS[n].solucion);
    // Las 7 piezas suman 1 (bloque (a)): si la unión mide menos, se pisan, y
    // entonces la figura tiene un hueco del mismo tamaño en otro sitio.
    assert.ok(Math.abs(union - 1) < 0.01,
      `${n}: las piezas se solapan — la unión mide ${union.toFixed(3)} y las 7 piezas suman 1`);
  }
  ok(`las ${ORDEN_SILUETAS.length} figuras del catálogo TESELAN: ninguna pieza pisa a otra`);

  // Y «Cuadrado» tiene que ser un CUADRADO, no una figura conexa cualquiera:
  // es la única del catálogo cuyo nombre promete una forma exacta.
  const unidad = [[[0, 0], [1, 0], [1, 1], [0, 1]]];
  const err = xorArea(unidad, SILUETAS.cuadrado.solucion, PIEZAS, 400);
  assert.ok(err < 0.005, `«Cuadrado» no es un cuadrado: XOR ${(err * 100).toFixed(1)} % contra el cuadrado unidad`);
  ok('«Cuadrado» cubre EXACTAMENTE el cuadrado unidad (0,0)-(1,1)');

  // CONTRA-PRUEBA de la derivación: para «Casa» —coordenadas que dio el dueño,
  // pieza a pieza— `poligonosDe` tiene que reproducir sus polígonos exactos.
  // El oráculo vive aquí y no en el catálogo, donde era una segunda fuente de
  // la misma verdad que nadie cruzaba.
  const CASA = [
    [[0.707106781, 0], [0, 0], [0.707106781, -0.707106781]],
    [[0, -0.707106781], [0.707106781, -0.707106781], [0, 0]],
    [[0.353553391, -1.060660172], [0.707106781, -0.707106781], [0, -0.707106781]],
    [[0.707106781, -0.353553391], [1.060660172, -0.353553391], [1.060660172, 0], [0.707106781, 0]],
    [[0.103553391, 0], [0.353553391, 0.25], [0.853553391, 0.25], [0.603553391, 0]],
    [[0.103553391, 0], [0.353553391, 0.25], [-0.146446609, 0.25]],
    [[0.853553391, 0.25], [0.603553391, 0], [1.103553391, 0]],
  ];
  const derivados = poligonosDe(SILUETAS.casa.solucion, PIEZAS);
  assert.strictEqual(derivados.length, CASA.length, 'casa: un polígono por colocación');
  derivados.forEach((poly, i) => {
    assert.strictEqual(poly.length, CASA[i].length, `casa[${i}]: mismo nº de vértices`);
    poly.forEach(([x, y], j) => {
      assert.ok(Math.abs(x - CASA[i][j][0]) < 1e-6 && Math.abs(y - CASA[i][j][1]) < 1e-6,
        `casa[${i}][${j}]: derivado (${x.toFixed(6)},${y.toFixed(6)}) ≠ oráculo (${CASA[i][j][0]},${CASA[i][j][1]})`);
    });
  });
  const caja = bboxDe(derivados);
  assert.ok(Math.abs(caja.minx + 0.146446609) < 1e-6 && Math.abs(caja.maxy - 0.25) < 1e-6, 'casa: la caja se deriva de los puntos');
  // Sin `piezas` explícito usa PIEZAS; una colocación de pieza desconocida se omite, no se inventa.
  assert.strictEqual(poligonosDe(SILUETAS.cuadrado.solucion).length, 7);
  assert.strictEqual(poligonosDe([{ pieza: 'dragon', x: 0, y: 0, rot: 0, flip: false }]).length, 0);
  assert.deepStrictEqual(bboxDe([]), { minx: 0, miny: 0, maxx: 1, maxy: 1 }, 'sin puntos: la caja del cuadrado unidad');
  ok('poligonosDe(solucion) reproduce el oráculo del dueño (casa, 1e-6) y bboxDe su caja');
}

// ── (f) MIGRACIÓN v1 → v2 (§24): `{id, figura}` sube a `{id, nombre, colocaciones}`.
{
  const M = (c) => TangramTemplate.migrateContent(JSON.parse(JSON.stringify(c)));
  // Las colocaciones salen en el orden de ORDEN_PIEZAS (el catálogo tiene el
  // suyo): se comparan por pieza.
  const porPieza = (cs) => [...cs].sort((a, b) => a.pieza.localeCompare(b.pieza));
  // Figura del catálogo → su nombre y su solución, sin `figura` residual.
  const v1 = { items: [{ id: 'it_1', figura: 'casa' }] };
  const v2 = M(v1);
  assert.strictEqual(v2.items.length, 1);
  assert.strictEqual(v2.items[0].id, 'it_1', 'conserva el id');
  assert.strictEqual(v2.items[0].nombre, SILUETAS.casa.nombre);
  assert.deepStrictEqual(porPieza(v2.items[0].colocaciones), porPieza(SILUETAS.casa.solucion));
  assert.ok(!('figura' in v2.items[0]), 'el campo legado no viaja al v2');
  ok('migrate v1→v2: una figura del catálogo lleva su nombre y su solución');

  // Figura desconocida → la primera del catálogo (nunca un ítem sin piezas).
  const raro = M({ items: [{ id: 'it_2', figura: 'dragon' }] });
  assert.strictEqual(raro.items[0].nombre, SILUETAS[ORDEN_SILUETAS[0]].nombre);
  assert.deepStrictEqual(porPieza(raro.items[0].colocaciones), porPieza(SILUETAS[ORDEN_SILUETAS[0]].solucion));
  ok('migrate v1→v2: una figura desconocida cae a la primera del catálogo');

  // Idempotente: migrar lo migrado no cambia nada.
  assert.deepStrictEqual(M(v2), v2, 'migrar dos veces = una');
  ok('migrate es idempotente');

  // Un ítem v2 NO se toca: ni las colocaciones que el docente armó (aunque
  // no sean ninguna del catálogo) ni su nombre; y se devuelve la MISMA
  // referencia (§24: migrar no reescribe lo guardado).
  const propio = { items: [{ id: 'it_3', nombre: 'Mi cohete', colocaciones: SILUETAS.cuadrado.solucion.map(c => ({ ...c, x: c.x + 3 })) }] };
  const salida = TangramTemplate.migrateContent(propio);
  assert.strictEqual(salida, propio, 'un contenido ya v2 vuelve tal cual (misma referencia)');
  assert.deepStrictEqual(M(propio), propio);
  ok('migrate: un ítem v2 no se toca');

  // Otro contenido (de otra plantilla) pasa sin tocar.
  const ajeno = { passages: [] };
  assert.strictEqual(TangramTemplate.migrateContent(ajeno), ajeno);
  ok('migrate: contenido de otro modelo se devuelve sin tocar');
}

// ── (g) ensureContent: vacío o roto → SIEMPRE un ítem con 7 colocaciones,
//     una por pieza de ORDEN_PIEZAS; las válidas se conservan.
{
  const sietePiezas = (item) => {
    assert.strictEqual(item.colocaciones.length, 7);
    assert.deepStrictEqual(item.colocaciones.map(c => c.pieza), ORDEN_PIEZAS, 'una por pieza, en orden');
    for (const c of item.colocaciones) {
      assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.rot) && typeof c.flip === 'boolean', `${c.pieza}: colocación válida`);
    }
    assert.ok(typeof item.nombre === 'string' && item.nombre, 'con nombre');
    assert.ok(typeof item.id === 'string' && item.id, 'con id (el que traía, o uno nuevo de rid())');
  };
  for (const content of [undefined, null, {}, { items: [] }, { items: [null] }, { items: [{ id: 'x' }] }, 'basura']) {
    const a = /** @type {any} */ ({ content });
    ensureContent(a);
    assert.strictEqual(a.content.items.length, 1);
    sietePiezas(a.content.items[0]);
  }
  ok('ensureContent: contenido vacío/roto → un ítem con 7 colocaciones válidas');

  // Roto A MEDIAS: 3 colocaciones buenas (una repetida, una de pieza inventada,
  // una sin números) → se conservan las buenas y se rellenan las 4 que faltan.
  const mezcla = normalizarItem({ id: 'it_9', nombre: 'Pez', colocaciones: [
    { pieza: 'grande1', x: 2, y: 2, rot: 90, flip: 1 },
    { pieza: 'grande1', x: 9, y: 9, rot: 0, flip: false },   // repetida: se ignora
    { pieza: 'cuadrado', x: 1, y: 1, rot: 45, flip: false },
    { pieza: 'dragon', x: 0, y: 0, rot: 0, flip: false },    // pieza inventada
    { pieza: 'mediano', x: 'no', y: 0, rot: 0, flip: false }, // sin números
    { pieza: 'pequeno2', x: 0.5, y: 0.5, rot: 0, flip: true },
  ] });
  sietePiezas(mezcla);
  assert.strictEqual(mezcla.nombre, 'Pez');
  assert.deepStrictEqual(mezcla.colocaciones.find(c => c.pieza === 'grande1'), { pieza: 'grande1', x: 2, y: 2, rot: 90, flip: true });
  assert.deepStrictEqual(mezcla.colocaciones.find(c => c.pieza === 'cuadrado'), { pieza: 'cuadrado', x: 1, y: 1, rot: 45, flip: false });
  assert.deepStrictEqual(mezcla.colocaciones.find(c => c.pieza === 'pequeno2'), { pieza: 'pequeno2', x: 0.5, y: 0.5, rot: 0, flip: true });
  ok('ensureContent/normalizarItem: conserva las colocaciones válidas y rellena las que faltan');

  // Un contenido v2 bueno se deja EN SU SITIO (misma referencia): el editor
  // y el tablero comparten el array de colocaciones.
  const bueno = { items: [normalizarItem({ figura: 'casa' })] };
  const a = /** @type {any} */ ({ content: bueno });
  ensureContent(a);
  assert.strictEqual(a.content, bueno, 'contenido v2 válido: misma referencia');
  ok('ensureContent no reescribe un contenido v2 válido');
}

// ── (h) v3 · EL CUADRADO ROTO QUE YA ESTABA GUARDADO ────────────────────────
// Arreglar el catálogo no arregla lo que el docente ya creó: su actividad
// copió las colocaciones malas. El contenido del usuario solo cambia por
// migración versionada (§24), así que la subida va aquí — y SOLO si las siete
// piezas siguen exactamente donde las dejó aquel catálogo.
{
  const T = getTemplate('tangram');
  const ROTO = [
    { pieza: 'grande1', x: 0.5, y: 0.5, rot: 225, flip: false },
    { pieza: 'grande2', x: 0.5, y: 0.5, rot: 135, flip: false },
    { pieza: 'mediano', x: 1, y: 0.5, rot: 180, flip: false },
    { pieza: 'pequeno1', x: 0.75, y: 0.75, rot: 315, flip: false },
    { pieza: 'pequeno2', x: 0.75, y: 0.75, rot: 225, flip: false },
    { pieza: 'cuadrado', x: 0.25, y: 0.75, rot: 45, flip: false },
    { pieza: 'paralelogramo', x: 1, y: 1, rot: 225, flip: true },
  ];
  const conRoto = (extra = {}) => ({ items: [{ id: 'it_1', nombre: 'Cuadrado', colocaciones: ROTO.map(c => ({ ...c, ...extra[c.pieza] })) }] });
  const unidad = [[[0, 0], [1, 0], [1, 1], [0, 1]]];

  assert.strictEqual(T.meta.templateVersion, 3, 'la plantilla declara la versión que trae la reparación');

  // 1) La figura rota, intacta, se REPARA: pasa a ser un cuadrado de verdad.
  const reparado = T.migrateContent(conRoto(), 2);
  const err = xorArea(unidad, reparado.items[0].colocaciones, PIEZAS, 400);
  assert.ok(err < 0.005, `el cuadrado guardado no se reparó: XOR ${(err * 100).toFixed(1)} %`);
  assert.strictEqual(reparado.items[0].nombre, 'Cuadrado', 'el nombre que puso el docente no se toca');
  assert.strictEqual(reparado.items[0].id, 'it_1', 'ni el id');

  // 2) CONTRA-PRUEBA: si el docente MOVIÓ una pieza, la figura es suya.
  const tocado = conRoto({ mediano: { x: 0.875 } });
  const despues = T.migrateContent(tocado, 2);
  assert.deepStrictEqual(despues.items[0].colocaciones, tocado.items[0].colocaciones,
    'una figura que el docente retocó NO se reescribe (§24)');

  // 3) Idempotente, y desde la versión 3 ya no se toca nada.
  assert.deepStrictEqual(T.migrateContent(T.migrateContent(conRoto(), 2), 3), T.migrateContent(conRoto(), 2),
    'migrar dos veces da lo mismo');
  assert.deepStrictEqual(T.migrateContent(conRoto(), 3).items[0].colocaciones, ROTO,
    'un contenido que ya se declara v3 no se vuelve a tocar');
  ok('v3: el «Cuadrado» roto ya guardado se repara, y una figura retocada por el docente no');
}

// ── (i) GIRAR NO ES MOVER: la pieza se queda donde está ─────────────────────
// El dueño lo vio jugando (2026-09-18): «hace el snap en un lugar erróneo, a
// distancia del lugar correcto». El giro que se guarda es alrededor del ORIGEN
// del polígono —el vértice del ángulo recto—, así que un toque para orientar la
// pieza la mandaba a media figura de distancia del dedo. Girar tiene que ser
// girar EN EL SITIO: el centro de la pieza no se mueve.
{
  const centro = (c) => { const b = bboxDe(poligonosDe([c], PIEZAS)); return [(b.minx + b.maxx) / 2, (b.miny + b.maxy) / 2]; };
  for (const pieza of ORDEN_PIEZAS) {
    const c = { pieza, x: 0.7, y: 0.4, rot: 0, flip: false };
    const [cx, cy] = centro(c);
    for (const grados of [45, 90, 135, 180, 225, 270, 315]) {
      const g = transformarEnSitio(c, { rot: grados }, PIEZAS);
      const [gx, gy] = centro(g);
      assert.ok(Math.abs(gx - cx) < 1e-9 && Math.abs(gy - cy) < 1e-9,
        `${pieza} girada ${grados}°: el centro se movió a (${gx.toFixed(3)}, ${gy.toFixed(3)}) desde (${cx.toFixed(3)}, ${cy.toFixed(3)})`);
      assert.strictEqual(g.rot, grados, 'el giro guardado es el pedido');
      assert.strictEqual(g.pieza, pieza, 'sigue siendo la misma pieza');
    }
    // Voltear tampoco la mueve (el paralelogramo es donde se nota).
    const v = transformarEnSitio(c, { flip: true }, PIEZAS);
    const [vx, vy] = centro(v);
    assert.ok(Math.abs(vx - cx) < 1e-9 && Math.abs(vy - cy) < 1e-9, `${pieza} volteada: el centro se movió`);
    assert.strictEqual(v.flip, true);
  }
  // La FORMA es la de siempre: girar en el sitio es girar sobre el origen más
  // una traslación, no otra geometría (la máscara y las siluetas no cambian).
  const base = { pieza: 'paralelogramo', x: 0.3, y: 0.2, rot: 0, flip: false };
  const enSitio = transformarEnSitio(base, { rot: 90 }, PIEZAS);
  const crudo = poligonosDe([{ ...base, rot: 90 }], PIEZAS)[0];
  const movido = poligonosDe([enSitio], PIEZAS)[0];
  const dx = movido[0][0] - crudo[0][0], dy = movido[0][1] - crudo[0][1];
  movido.forEach(([x, y], i) => {
    assert.ok(Math.abs((x - crudo[i][0]) - dx) < 1e-9 && Math.abs((y - crudo[i][1]) - dy) < 1e-9,
      'la pieza girada en sitio es la girada sobre el origen, solo trasladada');
  });
  ok('girar y voltear dejan la pieza DONDE ESTÁ (mismo centro), sin cambiar su forma');
}

console.log(`\n${passed} aserciones OK — tangram`);
