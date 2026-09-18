// Rompecabezas — motor puro (rejilla + imagen) + scorer + contrato de plantilla.
// Run: node tests/puzzle.test.mjs
import assert from 'node:assert';
import { mulberry32 } from '../core/azar.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { celdas, celdaBajo, solape, encaja, barajarPosiciones, ENCAJA_MIN } from '../templates/puzzle/game/rejilla.js';
import { svgAColor, dataUrlDeSvg, viewBoxAjustado, zonasSvg, svgParaPuzzle, tieneZonas, MARGEN_SIN_ZONAS } from '../templates/puzzle/game/imagen.js';
import { scorePuzzleSubmission } from '../templates/puzzle/scorer.js';
import '../templates/puzzle/index.js'; // side-effect: registra la plantilla
import { getTemplate } from '../core/registry.js';
import { checkTemplateContract } from '../core/templateContract.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── celdas ───────────────────────────────────────────────────────────────────
{
  const cs = celdas(3, 3);
  assert.strictEqual(cs.length, 9, '3×3 → 9 celdas');
  assert.strictEqual(cs.every((c, i) => c.i === i), true, 'índices 0..8 en orden fila-mayor');
  assert.deepStrictEqual(cs[5], { i: 5, fila: 1, col: 2 }, 'fila y columna de la celda 5 en 3×3');
  // no cuadrada: 2×3 (2 filas, 3 columnas)
  const cs23 = celdas(2, 3);
  assert.strictEqual(cs23.length, 6, '2×3 → 6 celdas');
  ok('celdas() da la rejilla en orden fila-mayor');
}

// ── celdaBajo ────────────────────────────────────────────────────────────────
{
  const filas = 3, columnas = 3;
  const cs = celdas(filas, columnas);
  for (const c of cs) {
    // el CENTRO de cada celda cae bajo su propio índice
    const cx = ((c.col + 0.5) * 100) / columnas;
    const cy = ((c.fila + 0.5) * 100) / filas;
    assert.strictEqual(celdaBajo(cx, cy, filas, columnas), c.i, `centro de la celda ${c.i} resuelve a sí misma`);
  }
  assert.strictEqual(celdaBajo(-1, 50, filas, columnas), -1, 'x negativo → fuera del tablero');
  assert.strictEqual(celdaBajo(50, 100, filas, columnas), -1, 'y=100 (borde) → fuera del tablero');
  assert.strictEqual(celdaBajo(150, 50, filas, columnas), -1, 'x>100 → fuera del tablero');
  ok('celdaBajo() ubica el punto y devuelve -1 fuera del tablero');
}

// ── solape + encaja (con CONTRA-PRUEBA) ────────────────────────────────────────
{
  const celda = { x: 0, y: 0, w: 10, h: 10 };
  const centrada = { x: 0, y: 0, w: 10, h: 10 };
  assert.strictEqual(solape(centrada, celda), 1, 'pieza exactamente sobre su celda → solape 1.0');

  const mediaCelda = { x: 5, y: 5, w: 10, h: 10 };   // desplazada media celda en x e y
  assert.strictEqual(solape(mediaCelda, celda), 0.25, 'desplazada media celda en ambos ejes → 0.25');

  // CONTRA-PRUEBA del umbral: 0.49 no encaja, 0.5 sí (el umbral es ENCAJA_MIN).
  assert.strictEqual(ENCAJA_MIN, 0.5, 'el umbral declarado es 0.5 (≥50% de solape)');
  const casi = { x: 0.51, y: 0, w: 1, h: 1 };
  const cel1 = { x: 0, y: 0, w: 1, h: 1 };
  assert.strictEqual(Math.abs(solape(casi, cel1) - 0.49) < 1e-9, true, 'desplazada 0.51 de una celda unidad → solape 0.49');
  assert.strictEqual(encaja(casi, cel1), false, 'CONTRA-PRUEBA: 0.49 de solape NO encaja');
  const justo = { x: 0.5, y: 0, w: 1, h: 1 };
  assert.strictEqual(Math.abs(solape(justo, cel1) - 0.5) < 1e-9, true, 'desplazada 0.5 de una celda unidad → solape 0.5');
  assert.strictEqual(encaja(justo, cel1), true, 'CONTRA-PRUEBA: 0.5 de solape SÍ encaja (umbral inclusive)');

  // sin solape en absoluto
  assert.strictEqual(solape({ x: 20, y: 20, w: 5, h: 5 }, celda), 0, 'sin intersección → 0');
  ok('solape()/encaja() con el umbral de 0.5 y su contra-prueba en la frontera');
}

// ── barajarPosiciones (azar inyectado, nunca Math.random a pelo) ───────────────
{
  const identidad = (arr) => arr;                      // "shuffle" que no mueve nada
  assert.deepStrictEqual(barajarPosiciones(4, identidad), [0, 1, 2, 3], 'usa la función de azar inyectada, no un primitivo propio');
  const invertido = (arr) => arr.reverse();
  assert.deepStrictEqual(barajarPosiciones(4, invertido), [3, 2, 1, 0], 'respeta lo que devuelva el shuffle inyectado');
  ok('barajarPosiciones() delega el azar en la función que recibe');
}

// ── svgAColor / dataUrlDeSvg — el contrato del banco (assets/juegos/dibujos) ───
// Un SVG SINTÉTICO propio (el banco real lo escribe otro agente en paralelo;
// si al integrar aún no existe, esta suite ya prueba el contrato por su cuenta).
{
  const svgSintetico = `<svg viewBox="0 0 100 100">
    <path data-zona="tejado" data-color="#e07a3f" d="M0 0 L100 0 L50 40 Z"/>
    <path data-zona="pared" data-color="#f4e2c8" fill="none" d="M10 40 L90 40 L90 100 L10 100 Z"/>
  </svg>`;

  const coloreado = svgAColor(svgSintetico);
  assert.match(coloreado, /data-zona="tejado"[^>]*fill="#e07a3f"/, 'zona SIN fill previo recibe fill=data-color');
  assert.match(coloreado, /data-zona="pared"[^>]*fill="#f4e2c8"/, 'zona CON fill previo (none) lo reemplaza por data-color');
  assert.strictEqual(coloreado.includes('fill="none"'), false, 'el fill viejo no sobrevive');
  ok('svgAColor() aplica data-color como fill de cada zona, sin tocar el resto del SVG');

  const url = dataUrlDeSvg(coloreado);
  assert.strictEqual(url.startsWith('data:image/svg+xml,'), true, 'dataUrlDeSvg() produce una data: URL de tipo SVG');
  assert.strictEqual(decodeURIComponent(url.slice('data:image/svg+xml,'.length)), coloreado, 'la URL decodifica al SVG coloreado exacto');
  ok('dataUrlDeSvg() codifica el SVG entero, recuperable con decodeURIComponent');

  // Puro: no muta el argumento.
  const copia = svgSintetico;
  svgAColor(svgSintetico);
  assert.strictEqual(svgSintetico, copia, 'svgAColor() no muta el texto de entrada');
  ok('svgAColor() es puro');
}

// ── viewBoxAjustado — el recorte al dibujo real (defecto medido: piezas en
// blanco porque el tablero repartía la rejilla sobre el LIENZO declarado,
// no sobre lo que de verdad dibujan las zonas) ─────────────────────────────
const parseViewBox = (svg) => {
  const m = /viewBox\s*=\s*"([^"]*)"/.exec(svg);
  assert.ok(m, 'el SVG resultante declara viewBox');
  return m[1].trim().split(/\s+/).map(Number);
};

// (b) CONTRA-PRUEBA: figura pequeña centrada → se recorta a su caja;
// figura que YA llena el lienzo → no cambia. `margen:0` para una aserción
// exacta, sin el término de aire que añadiría redondeo a comprobar.
{
  const pequena = `<svg viewBox="0 0 100 100"><rect x="40" y="40" width="20" height="20" data-color="#f00" fill="#fff"/></svg>`;
  const [vx, vy, vw, vh] = parseViewBox(viewBoxAjustado(pequena, 0));
  assert.deepStrictEqual([vx, vy, vw, vh], [40, 40, 20, 20], 'figura pequeña centrada: el viewBox se recorta a su propia caja (sin margen)');

  const completa = `<svg viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100" data-color="#f00" fill="#fff"/></svg>`;
  const [wx, wy, ww, wh] = parseViewBox(viewBoxAjustado(completa, 0));
  assert.deepStrictEqual([wx, wy, ww, wh], [0, 0, 100, 100], 'figura que ya llena el lienzo: el viewBox no cambia');
  ok('viewBoxAjustado(): CONTRA-PRUEBA — recorta lo pequeño, no toca lo que ya llena el lienzo');
}

// Sin zonas reconocibles (SVG vacío o solo con formas no soportadas): se
// devuelve TAL CUAL, nunca revienta.
{
  const vacio = `<svg viewBox="0 0 100 100"></svg>`;
  assert.strictEqual(viewBoxAjustado(vacio), vacio, 'sin zonas: el SVG se devuelve sin tocar');
  ok('viewBoxAjustado(): sin zonas reconocibles, no rompe (devuelve el original)');
}

// (a) Los 8 SVG del banco real: el algoritmo no desperdicia ni un punto de
// aire de más — cada borde mide EXACTAMENTE lo que le toca por geometría:
// el margen (4%) en el eje LARGO de la caja, y el margen MÁS lo que exige
// cuadrar (la mitad de la diferencia entre lado largo y corto, partida por
// el lado final) en el eje CORTO. Cuadrar sin deformar (el tablero es 1:1)
// obliga a esa segunda parte — no es aire de sobra, es geometría del dibujo.
//
// MEDIDO (node, con las 8 piezas reales): de los 8 SVG, solo casa.svg y
// sol.svg tienen caja ya cuadrada (aire 3.7% en los cuatro bordes, todo
// margen). Los otros 6 no son cuadrados — coche 80×70, flor 86×96,
// gato 100×95, globo 88×76, mariposa 86×66, pez 83×96 — y su eje corto
// necesita bastante más que el 6% que pedía el plan (mariposa llega al
// 14,5%): NO es un fallo del recorte, es que esos dibujos no son cuadrados
// y cuadrarlos sin deformar exige ese aire. Esto se REPORTA (no se puede
// medir/lograr un tope universal del 6% sin, o bien recortar contenido de
// verdad —perdiendo dibujo—, o bien deformar la figura —lo que el propio
// plan prohíbe—, o bien redibujar el banco —ajeno, fuera de mi alcance—).
// El test de abajo verifica lo que SÍ es mío: que el algoritmo es óptimo
// (cero aire de más sobre lo que la geometría obliga), con una tolerancia
// de redondeo mínima.
{
  const dibujosDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'juegos', 'dibujos', 'zonas');
  const svgs = readdirSync(dibujosDir).filter(f => f.endsWith('.svg'));
  assert.ok(svgs.length >= 1, 'hay SVG en el banco que auditar');
  const margen = 0.04, EPS = 0.002;
  let peorAire = 0, peorArchivo = '';
  for (const f of svgs) {
    const texto = readFileSync(join(dibujosDir, f), 'utf8');
    const zs = zonasSvg(texto);
    assert.ok(zs.length, `${f}: tiene zonas reconocibles`);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const z of zs) { minX = Math.min(minX, z.bbox.minX); maxX = Math.max(maxX, z.bbox.maxX);
                           minY = Math.min(minY, z.bbox.minY); maxY = Math.max(maxY, z.bbox.maxY); }
    const w = maxX - minX, h = maxY - minY;
    const [vx, vy, vw, vh] = parseViewBox(viewBoxAjustado(texto, margen));
    const aires = {
      izq:   (minX - vx) / vw,   der:   ((vx + vw) - maxX) / vw,
      arr:   (minY - vy) / vh,   abajo: ((vy + vh) - maxY) / vh,
    };
    // Esperado por geometría pura (fracción de aire = mitad del hueco entre
    // el contenido y el lado final, partido por el lado final):
    //   eje LARGO → margen/(1+2·margen)   (el lado final ES largo·(1+2·margen))
    //   eje CORTO → (lado_final − dimensión_corta) / (2 · lado_final)
    const largoDim = Math.max(w, h), cortoDim = Math.min(w, h);
    const lado = largoDim * (1 + 2 * margen);
    const esperadoLargo = margen / (1 + 2 * margen);
    const esperadoCorto = (lado - cortoDim) / (2 * lado);
    for (const [ladoNombre, aire] of Object.entries(aires)) {
      const esperado = (ladoNombre === 'izq' || ladoNombre === 'der')
        ? (w >= h ? esperadoLargo : esperadoCorto)
        : (h >= w ? esperadoLargo : esperadoCorto);
      assert.ok(Math.abs(aire - esperado) < EPS,
        `${f}: aire "${ladoNombre}" = ${(aire * 100).toFixed(2)}%, esperado ${(esperado * 100).toFixed(2)}% (el algoritmo no añade aire de más)`);
      if (aire > peorAire) { peorAire = aire; peorArchivo = f; }
    }
  }
  console.log(`    (informativo: el peor caso real es ${peorArchivo} con ${(peorAire * 100).toFixed(1)}% de aire en su eje corto — geometría del dibujo, no del algoritmo; el plan pedía ≤6% y NO se logra ahí sin recortar/deformar/redibujar)`);
  ok(`viewBoxAjustado(): en los ${svgs.length} SVG del banco, el aire es EXACTAMENTE el que exige la geometría (margen ${margen * 100}% + cuadrar sin deformar) — cero desperdicio`);
}

// (c) Tras el ajuste, ninguna de las 9 celdas de un 3×3 de la casa queda
// VACÍA — por GEOMETRÍA (no por captura): cada celda debe cortar al menos
// una zona. Es el defecto exacto que reportó la sonda visual (3 esquinas en
// blanco, indistinguibles entre sí).
{
  const overlap1D = (aMin, aMax, bMin, bMax) => aMin < bMax && aMax > bMin;
  const rectsOverlap = (a, b) => overlap1D(a.minX, a.maxX, b.minX, b.maxX) && overlap1D(a.minY, a.maxY, b.minY, b.maxY);
  const circleIntersectsRect = (cx, cy, r, rect) => {
    const nx = Math.max(rect.minX, Math.min(cx, rect.maxX));
    const ny = Math.max(rect.minY, Math.min(cy, rect.maxY));
    return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r;
  };
  const ellipseIntersectsRect = (cx, cy, rx, ry, rect) => {
    if (!(rx > 0) || !(ry > 0)) return false;
    const n = { minX: (rect.minX - cx) / rx, maxX: (rect.maxX - cx) / rx, minY: (rect.minY - cy) / ry, maxY: (rect.maxY - cy) / ry };
    const nx = Math.max(n.minX, Math.min(0, n.maxX));
    const ny = Math.max(n.minY, Math.min(0, n.maxY));
    return nx * nx + ny * ny <= 1;
  };
  const pointInPolygon = (x, y, pts) => {
    let dentro = false;
    const n = pts.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = pts[2 * i], yi = pts[2 * i + 1], xj = pts[2 * j], yj = pts[2 * j + 1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) dentro = !dentro;
    }
    return dentro;
  };
  const cruzan = (p1, p2, p3, p4) => {
    const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };
  const polygonIntersectsRect = (pts, rect) => {
    const n = pts.length / 2;
    const esquinas = [[rect.minX, rect.minY], [rect.maxX, rect.minY], [rect.maxX, rect.maxY], [rect.minX, rect.maxY]];
    for (let i = 0; i < n; i++) { const x = pts[2 * i], y = pts[2 * i + 1]; if (x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY) return true; }
    for (const [x, y] of esquinas) if (pointInPolygon(x, y, pts)) return true;
    for (let i = 0; i < n; i++) {
      const a = [pts[2 * i], pts[2 * i + 1]], b = [pts[2 * ((i + 1) % n)], pts[2 * ((i + 1) % n) + 1]];
      for (let j = 0; j < 4; j++) if (cruzan(a, b, esquinas[j], esquinas[(j + 1) % 4])) return true;
    }
    return false;
  };
  const zonaIntersectaCelda = (z, celda) => {
    if (z.tipo === 'rect') return rectsOverlap({ minX: z.x, minY: z.y, maxX: z.x + z.w, maxY: z.y + z.h }, celda);
    if (z.tipo === 'circle') return circleIntersectsRect(z.cx, z.cy, z.r, celda);
    if (z.tipo === 'ellipse') return ellipseIntersectsRect(z.cx, z.cy, z.rx, z.ry, celda);
    if (z.tipo === 'polygon' || z.tipo === 'path') return polygonIntersectsRect(z.puntos, celda);
    return false;
  };

  const dibujosDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'juegos', 'dibujos', 'zonas');
  const casaTexto = readFileSync(join(dibujosDir, 'casa.svg'), 'utf8');
  const zonas = zonasSvg(casaTexto);
  const [vx, vy, vw, vh] = parseViewBox(viewBoxAjustado(casaTexto));
  const filas = 3, columnas = 3;
  const vacias = [];
  for (let fila = 0; fila < filas; fila++) {
    for (let col = 0; col < columnas; col++) {
      const celda = {
        minX: vx + (col * vw) / columnas, maxX: vx + ((col + 1) * vw) / columnas,
        minY: vy + (fila * vh) / filas, maxY: vy + ((fila + 1) * vh) / filas,
      };
      const tocaAlgo = zonas.some(z => zonaIntersectaCelda(z, celda));
      if (!tocaAlgo) vacias.push(`${fila},${col}`);
    }
  }
  assert.deepStrictEqual(vacias, [], `ninguna celda 3×3 de la casa queda vacía tras el recorte (vacías: ${vacias.join(' | ') || 'ninguna'})`);
  ok('viewBoxAjustado(): las 9 celdas de la casa en 3×3 tocan al menos una zona (0 piezas en blanco)');
}

// ── svgParaPuzzle — EL PIPELINE QUE USA EL PLAYER, entero salvo el getBBox ──
// `viewBoxAjustado` estuvo probada y SIN LECTOR (§31): el player hacía
// `dataUrlDeSvg(svgAColor(texto))` y nunca la llamaba. Este test mira la
// data URL FINAL, que es lo que llega a `background-image`: si alguien vuelve
// a saltarse el recorte, aquí sale «0 0 100 100» y se ve. (Verificado en rojo
// dejando `svgParaPuzzle` sin el paso de recorte.)
const svgDeDataUrl = (url) => {
  assert.ok(url.startsWith('data:image/svg+xml,'), 'svgParaPuzzle() devuelve una data: URL de SVG');
  return decodeURIComponent(url.slice('data:image/svg+xml,'.length));
};
const dibujosZonasDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'juegos', 'dibujos', 'zonas');
{
  const casaTexto = readFileSync(join(dibujosZonasDir, 'casa.svg'), 'utf8');
  assert.deepStrictEqual(parseViewBox(casaTexto), [0, 0, 100, 100], 'la casa legada nace sobre el lienzo entero');
  assert.strictEqual(tieneZonas(casaTexto), true, 'la casa legada trae zonas data-color');

  const salida = svgDeDataUrl(svgParaPuzzle(casaTexto));
  assert.notDeepStrictEqual(parseViewBox(salida), [0, 0, 100, 100], 'la URL final NO lleva el lienzo entero: el recorte está cableado');
  assert.deepStrictEqual(parseViewBox(salida), parseViewBox(viewBoxAjustado(casaTexto)), 'el viewBox final es EXACTAMENTE el de viewBoxAjustado (un solo dueño del recorte)');
  assert.match(salida, /data-zona="tejado"[^>]*fill="#c0392b"/, 'y las zonas van con su data-color aplicado');
  ok('svgParaPuzzle(): con la casa legada, la data URL final lleva el viewBox recortado y las zonas coloreadas');
}

// ── viewBoxAjustado con CAJA aportada (las láminas sin zonas de OpenMoji) ──
// En el navegador la caja sale de `getBBox()`; aquí se simula pasándola. La
// caja MANDA aunque el SVG no traiga zonas — y CONTRA-PRUEBA: sin caja y sin
// zonas, el original, como hoy.
{
  const sinZonas = `<svg viewBox="0 0 100 100"><g transform="scale(1.5)"><path d="M10 10 C 20 30, 40 30, 50 10 Z" fill="#EA5A47"/></g></svg>`;
  assert.strictEqual(tieneZonas(sinZonas), false, 'una lámina de OpenMoji no trae data-color');
  assert.strictEqual(viewBoxAjustado(sinZonas, 0.06), sinZonas, 'CONTRA-PRUEBA: sin caja y sin zonas reconocibles → el original, sin tocar');

  const caja = { minX: 15, minY: 15, maxX: 75, maxY: 45 };   // 60×30, como si la diera getBBox()
  const [vx, vy, vw, vh] = parseViewBox(viewBoxAjustado(sinZonas, 0, caja));
  assert.deepStrictEqual([vx, vy, vw, vh], [15, 0, 60, 60], 'con caja y margen 0: cuadrada al lado mayor (60) y centrada sobre la caja');
  const [mx, my, mw, mh] = parseViewBox(viewBoxAjustado(sinZonas, 0.06, caja));
  assert.strictEqual(mw, 60 * 1.12, 'con margen 0.06: 6 % de aire a cada lado del lado mayor');
  assert.strictEqual(mw, mh, 'sigue cuadrada (el tablero es 1:1)');
  assert.deepStrictEqual([mx + mw / 2, my + mh / 2], [45, 30], 'y centrada en el centro de la caja');

  // La caja aportada MANDA incluso si el texto SÍ tiene zonas reconocibles
  // (OpenMoji lleva rects bajo un `scale()` que el parser del texto no ve).
  const conRectBajoScale = `<svg viewBox="0 0 100 100"><g transform="scale(1.38889)"><rect x="19" y="32" width="34" height="24" fill="#fff"/></g></svg>`;
  const [cx, cy, cw] = parseViewBox(viewBoxAjustado(conRectBajoScale, 0, caja));
  assert.deepStrictEqual([cx, cy, cw], [15, 0, 60], 'la caja aportada gana a la que el texto deja adivinar');
  ok('viewBoxAjustado(texto, margen, caja): la caja aportada manda; sin caja ni zonas, el original');

  // Y el pipeline con caja: recorta con MARGEN_SIN_ZONAS y NO colorea nada.
  const salida = svgDeDataUrl(svgParaPuzzle(sinZonas, { caja }));
  assert.deepStrictEqual(parseViewBox(salida), parseViewBox(viewBoxAjustado(sinZonas, MARGEN_SIN_ZONAS, caja)), 'svgParaPuzzle con caja = viewBoxAjustado con el margen de las láminas sin zonas');
  assert.ok(MARGEN_SIN_ZONAS > 0.04, 'el margen del camino medido es mayor que el 4 % del banco (getBBox excluye el trazo)');
  assert.strictEqual(svgDeDataUrl(svgParaPuzzle(sinZonas)), sinZonas, 'sin caja ni zonas: viaja tal cual (nada que recortar ni colorear)');
  ok('svgParaPuzzle(texto, {caja}): el camino de OpenMoji recorta con su margen y no toca el color');
}

// ── scorer ───────────────────────────────────────────────────────────────────
{
  const item = { filas: 2, columnas: 2 };
  const activity = { scoring: { pointsPerCorrect: 100 } };

  const todas = scorePuzzleSubmission({ value: { encajadas: 4, total: 4 }, item, activity });
  assert.deepStrictEqual(todas, { correct: true, points: 100, hits: 4, total: 4 }, 'todas las piezas encajadas → 100 puntos');

  const amedias = scorePuzzleSubmission({ value: { encajadas: 2, total: 4 }, item, activity });
  assert.strictEqual(amedias.correct, false, 'a medias no es "correct" (el juego no termina hasta encajarlas todas)');
  assert.strictEqual(amedias.points, 0, 'a medias no da puntos (no hay premio por piezas sueltas)');
  assert.strictEqual(amedias.hits, 2, 'hits refleja el mérito real (2 de 4), aunque no puntúe');
  ok('scorePuzzleSubmission() da 100 al completar y 0/hits parciales a medias');
}

// ── contrato de plantilla (registrada de verdad) ────────────────────────────
{
  const T = getTemplate('puzzle');
  assert.ok(T, 'la plantilla "puzzle" está registrada');
  const issues = checkTemplateContract(T);
  assert.deepStrictEqual(issues, [], `contrato limpio (sin issues): ${issues.join(' | ')}`);
  assert.strictEqual(T.meta.kind, 'juego', 'es un JUEGO (norte §4c)');
  assert.strictEqual(T.meta.modes.async, false, 'un juego no se ofrece como Tarea');
  assert.strictEqual(T.meta.play.submit, 'gesto', 'el toque ES la respuesta: cero botones de envío');
  ok('checkTemplateContract(PuzzleTemplate) sin incidencias');
}

// ── LOS DOS BANCOS NO COMPARTEN NOMBRE ──────────────────────────────────────
// Ocho legados (casa, gato, sol…) se llamaban igual que su lámina de OpenMoji y
// el player resolvía primero el legado: la lámina buena era INALCANZABLE por
// nombre y el editor la escondía para no prometer una miniatura que no se
// jugaba. Con nombres distintos, los dos bancos se eligen y se juegan.
{
  const { DIBUJOS, DIBUJOS_PUZZLE, rutaDibujo, rutaDibujoPuzzle } = await import('../core/bancoDibujos.js');
  const openmoji = new Set(DIBUJOS.map(d => d.nombre));
  const choques = DIBUJOS_PUZZLE.map(d => d.nombre).filter(n => openmoji.has(n));
  assert.deepStrictEqual(choques, [], `nombre repetido entre bancos: ${choques.join(', ')}`);
  // Contra-prueba: cada banco sigue resolviendo los suyos, y solo los suyos.
  for (const d of DIBUJOS_PUZZLE) {
    assert.ok(rutaDibujoPuzzle(d.nombre), `${d.nombre}: el legado no resuelve su ruta`);
    assert.strictEqual(rutaDibujo(d.nombre, 'color'), null, `${d.nombre}: un legado no puede resolver en OpenMoji`);
  }
  assert.ok(rutaDibujo('casa', 'color') && !rutaDibujoPuzzle('casa'), 'la casa a secas es la de OpenMoji');
  ok(`los ${DIBUJOS_PUZZLE.length} legados y las ${DIBUJOS.length} láminas de OpenMoji no comparten nombre`);
}

// ── LA FIGURA SE COMPONE SOBRE SU ESCENA (2d: la imagen llena el marco) ─────
// Medido en v1.51.710: con el aire recortado, 39 de 51 dibujos seguían dejando
// piezas casi vacías en las esquinas — es la FORMA, no el aire. Con el
// decorado detrás, cada pieza tiene algo que reconocer.
{
  const { componerEscena, CAJA_FIGURA, escenaColorDe, SUELO } = await import('../core/escenasDibujo.js');
  const figura = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 50 50"><!-- crédito --><circle cx="35" cy="45" r="20" fill="#f00"/></svg>';
  const escena = escenaColorDe('animales');
  assert.ok(escena, 'el tema animales tiene escena coloreada');

  const compuesto = componerEscena(figura, escena);
  assert.match(compuesto, /^<svg [^>]*viewBox="0 0 100 100">/, 'el lienzo final es el de la escena (100×100)');
  assert.ok(compuesto.includes(escena), 'la escena va dentro, tal cual');
  assert.match(compuesto, /<svg x="14" y="6" width="72" height="72" viewBox="10 20 50 50" preserveAspectRatio="xMidYMax meet">/,
    'la figura se ANIDA con su viewBox recortado intacto, apoyada por abajo');
  assert.ok(compuesto.includes('<!-- crédito -->') && compuesto.includes('<circle'), 'el contenido (y el crédito) de la figura viajan enteros');
  assert.strictEqual(CAJA_FIGURA.y + CAJA_FIGURA.h, SUELO, 'los pies de la figura tocan el SUELO de la escena (un solo dueño del 78)');
  assert.ok(compuesto.indexOf(escena) < compuesto.indexOf('<svg x='), 'la escena se pinta DEBAJO de la figura');

  // Contra-pruebas: sin escena no se toca nada; una figura sin <svg> tampoco.
  assert.strictEqual(componerEscena(figura, ''), figura);
  assert.strictEqual(componerEscena('<p>no es svg</p>', escena), '<p>no es svg</p>');

  // Y el pipeline entero la enchufa: la data URL final lleva la escena.
  const url = svgParaPuzzle(figura, { caja: { minX: 10, minY: 20, maxX: 60, maxY: 70 }, escena });
  const svgFinal = decodeURIComponent(url.replace(/^data:image\/svg\+xml,/, ''));
  assert.ok(svgFinal.startsWith('<svg') && svgFinal.includes(escena), 'svgParaPuzzle({escena}) compone');
  assert.ok(!decodeURIComponent(svgParaPuzzle(figura, { caja: { minX: 10, minY: 20, maxX: 60, maxY: 70 } })).includes('<rect'),
    'sin escena, la figura va sola (como antes)');
  ok('componerEscena(): la figura anidada sobre el decorado, pies en el suelo, y sin escena nada cambia');
}

// ── NACE EN 3×3 Y «FÁCIL» SIGUE SIENDO 2×2 (dueño, 2026-09-18) ──────────────
{
  const T = getTemplate('puzzle');
  const { PUZZLE_POR_DEFECTO } = await import('../templates/puzzle/content.js');
  const def = PUZZLE_POR_DEFECTO();
  assert.deepStrictEqual([def.filas, def.columnas], [3, 3], 'el rompecabezas nace en 3×3');
  const opt = T.meta.play.options.find(o => o.id === 'piezas');
  assert.ok(opt, 'la opción de partida «piezas» existe');
  const a = /** @type {any} */ ({ content: T.meta.defaultContent() });
  assert.strictEqual(opt.get(a), '3x3', 'la opción refleja el defecto');
  assert.strictEqual(opt.get({ content: { items: [{}] } }), '3x3', 'sin filas declaradas cae al MISMO defecto que content.js (§21b)');
  const facil = opt.values.find(v => v.value === '2x2');
  assert.match(facil?.label ?? '', /Fácil/, 'la de 4 piezas se llama «Fácil»');
  const b = opt.set(a, '2x2');
  assert.deepStrictEqual([b.content.items[0].filas, b.content.items[0].columnas], [2, 2], 'elegir Fácil da 2×2');
  assert.deepStrictEqual([a.content.items[0].filas, a.content.items[0].columnas], [3, 3], 'set es PURO: la actividad original no se toca (§24)');
  ok('nace en 3×3; «Fácil · 4 piezas» sigue dando 2×2 y set() es puro');
}

// ── CONTORNOS: piezas con LENGÜETA y HUECO (2a, handoff §8d) ─────────────────
// Cada pieza era un cuadrado con las esquinas redondeadas («se lee como un
// puzle deslizante»). Ahora el contorno es geometría pura (Bézier cúbicas,
// cero assets) y se prueba en Node: la lengüeta de una pieza ES el hueco de la
// vecina — la misma curva recorrida al revés.
const {
  contornos, invertir, TAB, fondoPieza, cajaEncajada, rectNucleo,
} = await import('../templates/puzzle/game/contornos.js');
// El azar del test es el primitivo del proyecto con semilla (core/azar.js): el mismo que inyecta el player.
const rndFijo = (semilla) => mulberry32(semilla);
const tieneCurva = (lado) => lado.some(seg => seg.tipo === 'C');

// (a) 3×3 → 9 piezas; cada path arranca en M y cierra en Z; la caja es la
// celda ampliada TAB por los cuatro lados, SIEMPRE (todas la misma caja relativa).
{
  const ps = contornos(3, 3, rndFijo(1));
  assert.strictEqual(ps.length, 9, '3×3 → 9 contornos');
  assert.deepStrictEqual(ps.map(p => p.i), [0, 1, 2, 3, 4, 5, 6, 7, 8], 'índices en orden fila-mayor');
  for (const p of ps) {
    assert.match(p.d, /^M/, `pieza ${p.i}: el path empieza en M`);
    assert.match(p.d, /Z$/, `pieza ${p.i}: el path cierra en Z`);
    assert.doesNotMatch(p.d, /[^MLCZ0-9.\s-]/, `pieza ${p.i}: solo M/L/C/Z y números`);
    const c = p.caja;
    assert.ok(Math.abs(c.w - (1 + 2 * TAB)) < 1e-9 && Math.abs(c.h - (1 + 2 * TAB)) < 1e-9, `pieza ${p.i}: la caja mide 1+2·TAB celdas`);
    assert.ok(Math.abs(c.x - (p.col - TAB)) < 1e-9 && Math.abs(c.y - (p.fila - TAB)) < 1e-9, `pieza ${p.i}: la caja es la celda ampliada TAB`);
    // Todo el path cabe en la caja normalizada (0..1): nada asoma fuera del recorte.
    const nums = p.d.match(/-?\d*\.?\d+/g).map(Number);
    assert.ok(nums.every(n => n >= -1e-9 && n <= 1 + 1e-9), `pieza ${p.i}: todas las coordenadas del path están en 0..1`);
  }
  assert.ok(TAB > 0.2 && TAB <= 0.35, `TAB (${TAB}) deja asomar la lengüeta ~un cuarto del lado`);
  ok('contornos(3,3): 9 piezas, path M…Z normalizado a la caja = celda + TAB por los cuatro lados');
}

// (b) ARISTA COMPARTIDA: la curva del lado derecho de (r,c) es la INVERSA
// exacta del lado izquierdo de (r,c+1), en coordenadas del TABLERO; ídem
// abajo/arriba. Y la lengüeta de una es el hueco de la otra (curvan, no rectas).
{
  const filas = 3, columnas = 3;
  const ps = contornos(filas, columnas, rndFijo(7));
  const at = (r, c) => ps[r * columnas + c];
  const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let curvas = 0;
  for (let r = 0; r < filas; r++) for (let c = 0; c < columnas; c++) {
    if (c + 1 < columnas) {
      assert.ok(mismo(at(r, c).lados.derecha, invertir(at(r, c + 1).lados.izquierda)),
        `(${r},${c}) derecha = inversa de (${r},${c + 1}) izquierda`);
      assert.ok(tieneCurva(at(r, c).lados.derecha), `(${r},${c})→(${r},${c + 1}): la arista interior curva`);
      curvas++;
    }
    if (r + 1 < filas) {
      assert.ok(mismo(at(r, c).lados.abajo, invertir(at(r + 1, c).lados.arriba)),
        `(${r},${c}) abajo = inversa de (${r + 1},${c}) arriba`);
      assert.ok(tieneCurva(at(r, c).lados.abajo), `(${r},${c})→(${r + 1},${c}): la arista interior curva`);
      curvas++;
    }
  }
  assert.strictEqual(curvas, 12, 'un 3×3 tiene 12 aristas interiores');
  // GEOMETRÍA, no solo estructura: la vecina TRAZA la misma curva al revés. Se
  // muestrean las Bézier (A(u) = B(1−u) tramo a tramo) sin pasar por
  // `invertir` — así se ve si `invertir` olvidase intercambiar c1↔c2.
  const bez = (s, u) => {
    if (s.tipo === 'L') return { x: s.a.x + u * (s.p.x - s.a.x), y: s.a.y + u * (s.p.y - s.a.y) };
    const k = 1 - u;
    return { x: k ** 3 * s.a.x + 3 * k * k * u * s.c1.x + 3 * k * u * u * s.c2.x + u ** 3 * s.p.x,
             y: k ** 3 * s.a.y + 3 * k * k * u * s.c1.y + 3 * k * u * u * s.c2.y + u ** 3 * s.p.y };
  };
  const trazaIgual = (A, B) => {
    assert.strictEqual(A.length, B.length);
    for (let k = 0; k < A.length; k++) for (const u of [0, .2, .35, .5, .8, 1]) {
      const pa = bez(A[k], u), pb = bez(B[A.length - 1 - k], 1 - u);
      assert.ok(Math.abs(pa.x - pb.x) < 1e-9 && Math.abs(pa.y - pb.y) < 1e-9, `las dos vecinas trazan el mismo punto (${pa.x},${pa.y}) vs (${pb.x},${pb.y})`);
    }
  };
  trazaIgual(at(1, 1).lados.derecha, at(1, 2).lados.izquierda);
  trazaIgual(at(0, 0).lados.abajo, at(1, 0).lados.arriba);
  // Y la CABEZA (n = TAB) de esa arista cae dentro de UNA de las dos celdas
  // (x = 2 ± TAB): sale de una y entra en la otra.
  const xs = at(1, 1).lados.derecha.filter(s => s.tipo === 'C').flatMap(s => [s.c1.x, s.c2.x]);
  assert.ok(xs.some(x => Math.abs(Math.abs(x - 2) - TAB) < 1e-9), 'la cabeza de la lengüeta llega a TAB de la arista');
  // invertir() es una involución y, sobre un lado con lengüeta, cambia el lado
  // del bulto: la cabeza (el punto más lejos de la arista) cae al otro lado.
  const lado = at(1, 1).lados.derecha;
  assert.ok(mismo(invertir(invertir(lado)), lado), 'invertir(invertir(x)) = x');
  const ys = (segs) => segs.flatMap(s => s.tipo === 'C' ? [s.c1.x, s.c2.x, s.p.x] : [s.p.x]);
  const maxL = Math.max(...ys(lado)), minL = Math.min(...ys(lado));
  assert.ok(maxL > 2 + 1e-6 || minL < 2 - 1e-6, 'el lado derecho de (1,1) (x=2) tiene un bulto a un lado');
  ok('arista compartida: la curva de una pieza es la inversa exacta de la vecina (en coordenadas del tablero)');
}

// (c) Las aristas del BORDE del tablero son rectas (sin C en ese lado).
{
  const filas = 3, columnas = 3;
  const ps = contornos(filas, columnas, rndFijo(3));
  for (const p of ps) {
    if (p.fila === 0) assert.ok(!tieneCurva(p.lados.arriba), `pieza ${p.i}: borde superior recto`);
    if (p.fila === filas - 1) assert.ok(!tieneCurva(p.lados.abajo), `pieza ${p.i}: borde inferior recto`);
    if (p.col === 0) assert.ok(!tieneCurva(p.lados.izquierda), `pieza ${p.i}: borde izquierdo recto`);
    if (p.col === columnas - 1) assert.ok(!tieneCurva(p.lados.derecha), `pieza ${p.i}: borde derecho recto`);
  }
  // Contra-prueba: en un 1×1 los cuatro lados son rectos y el path es un rectángulo.
  const [solo] = contornos(1, 1, rndFijo(3));
  assert.ok(!Object.values(solo.lados).some(tieneCurva), '1×1: ningún lado curva');
  assert.strictEqual((solo.d.match(/C/g) || []).length, 0, '1×1: el path no lleva ninguna C');
  ok('aristas de borde rectas (y un 1×1 es un rectángulo)');
}

// (d) Determinista con la misma rnd; distinto con otra.
{
  const a = contornos(3, 3, rndFijo(11)).map(p => p.d).join('|');
  const b = contornos(3, 3, rndFijo(11)).map(p => p.d).join('|');
  const c = contornos(3, 3, rndFijo(12)).map(p => p.d).join('|');
  assert.strictEqual(a, b, 'misma fuente de azar → mismos contornos');
  assert.notStrictEqual(a, c, 'otra fuente de azar → otros contornos');
  // Y con rnd constante (siempre 0.9 → todas las lengüetas al mismo lado) sigue
  // saliendo un tablero válido: 9 piezas, 12 aristas curvas.
  const todasIgual = contornos(3, 3, () => 0.9);
  assert.strictEqual(todasIgual.length, 9);
  ok('contornos() es determinista por la rnd inyectada (nunca Math.random propio)');
}

// (e) LA ARITMÉTICA DEL FONDO para la caja ampliada, con números. Caja =
// celda·(1+2·TAB); tablero = columnas celdas. Con TAB = 0.3:
//   2×2 → size 125 %, posición-x −75 % (col 0) y 175 % (col 1)
//   3×3 → size 187,5 %, posición-x −21,43 % · 50 % · 121,43 %
{
  assert.strictEqual(TAB, 0.3, 'los números de abajo están calculados con TAB = 0.3');
  const cerca = (a, b) => Math.abs(a - b) < 1e-6;
  const f22 = fondoPieza({ fila: 1, col: 0 }, 2, 2);
  assert.ok(cerca(f22.sizeX, 125) && cerca(f22.sizeY, 125), `2×2: size 125 % (${f22.sizeX})`);
  assert.ok(cerca(f22.posX, -75), `2×2 col 0: posición-x −75 % (${f22.posX})`);
  assert.ok(cerca(f22.posY, 175), `2×2 fila 1: posición-y 175 % (${f22.posY})`);
  assert.ok(cerca(fondoPieza({ fila: 0, col: 1 }, 2, 2).posX, 175), '2×2 col 1: posición-x 175 %');
  const f33 = [0, 1, 2].map(col => fondoPieza({ fila: 0, col }, 3, 3));
  assert.ok(cerca(f33[0].sizeX, 187.5), `3×3: size 187,5 % (${f33[0].sizeX})`);
  assert.ok(cerca(f33[0].posX, -300 / 14) && cerca(f33[1].posX, 50) && cerca(f33[2].posX, 1700 / 14),
    `3×3: posición-x −21,43 · 50 · 121,43 (${f33.map(f => f.posX.toFixed(2)).join(' · ')})`);
  // Que el porcentaje es CORRECTO de verdad: aplicando la fórmula del CSS
  // (offset = p·(caja − imagen)) el borde izquierdo de la imagen cae a
  // −(col − TAB) celdas del borde de la caja, o sea, la celda queda centrada.
  for (const [col, f] of f33.entries()) {
    const caja = 1 + 2 * TAB, imagen = 3;
    const offset = (f.posX / 100) * (caja - imagen);
    assert.ok(cerca(offset, -(col - TAB)), `3×3 col ${col}: la imagen se desplaza −(col − TAB) celdas`);
  }
  // El estilo que se escribe en la pieza lleva esos mismos números.
  assert.match(f33[1].css, /background-size:\s*187\.5% 187\.5%/, 'el css lleva el size');
  assert.match(f33[1].css, /background-position:\s*50% -21\.4\d*%/, 'el css lleva la posición');
  // Pieza encajada: su caja en % del tablero (izquierda/arriba pueden ser negativos).
  const e = cajaEncajada({ fila: 0, col: 1 }, 3, 3);
  assert.ok(cerca(e.left, (1 - TAB) * 100 / 3) && cerca(e.top, -TAB * 100 / 3), 'encajada: left/top = (col − TAB)·(100/columnas)');
  assert.ok(cerca(e.width, (1 + 2 * TAB) * 100 / 3) && cerca(e.height, (1 + 2 * TAB) * 100 / 3), 'encajada: width/height = (1+2TAB)·(100/columnas)');
  ok('fondoPieza()/cajaEncajada(): la aritmética del fondo y de la caja ampliada, comprobada con números (2×2 y 3×3)');
}

// (f) CONTRA-PRUEBA de encaja con el NÚCLEO: la caja ampliada, soltada
// EXACTAMENTE sobre su celda, no llega al 50 % de solape (1/1.6² = 39 %) y NO
// encajaría; su núcleo sí (100 %). Y el núcleo desplazado media celda sigue
// sin encajar (25 %): el margen no regala encajes.
{
  const celda = { x: 0, y: 0, w: 100 / 3, h: 100 / 3 };
  const caja = { x: -TAB * celda.w, y: -TAB * celda.h, w: (1 + 2 * TAB) * celda.w, h: (1 + 2 * TAB) * celda.h };
  assert.ok(solape(caja, celda) < ENCAJA_MIN, `la caja entera sobre su celda solapa ${(solape(caja, celda) * 100).toFixed(0)} % < 50 %: no encajaría`);
  const n = rectNucleo(caja);
  assert.ok(Math.abs(n.x) < 1e-9 && Math.abs(n.y) < 1e-9 && Math.abs(n.w - celda.w) < 1e-9 && Math.abs(n.h - celda.h) < 1e-9, 'el núcleo de la caja es exactamente la celda');
  assert.strictEqual(encaja(n, celda), true, 'el núcleo sobre su celda ENCAJA');
  const medio = rectNucleo({ ...caja, x: caja.x + celda.w / 2, y: caja.y + celda.h / 2 });
  assert.strictEqual(encaja(medio, celda), false, 'CONTRA-PRUEBA: núcleo a media celda en los dos ejes (25 %) NO encaja');
  const casi = rectNucleo({ ...caja, x: caja.x + celda.w * 0.4 });
  assert.strictEqual(encaja(casi, celda), true, 'núcleo desplazado 0,4 de celda en un eje (60 %) sí encaja');
  ok('encaja() se juzga con el NÚCLEO de la pieza (la caja ampliada sola no encajaría ni sobre su celda)');
}

console.log(`\n✅ puzzle: ${passed} checks`);
