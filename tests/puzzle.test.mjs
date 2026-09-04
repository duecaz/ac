// Rompecabezas — motor puro (rejilla + imagen) + scorer + contrato de plantilla.
// Run: node tests/puzzle.test.mjs
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { celdas, celdaBajo, solape, encaja, barajarPosiciones, ENCAJA_MIN } from '../templates/puzzle/game/rejilla.js';
import { svgAColor, dataUrlDeSvg, viewBoxAjustado, zonasSvg } from '../templates/puzzle/game/imagen.js';
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
  // esquinas del bgPos: 0%/0% arriba-izda, 100%/100% abajo-dcha
  assert.strictEqual(cs[0].bgPos, '0% 0%', 'esquina superior-izquierda en 0% 0%');
  assert.strictEqual(cs[8].bgPos, '100% 100%', 'esquina inferior-derecha en 100% 100%');
  assert.strictEqual(cs[2].bgPos, '100% 0%', 'esquina superior-derecha en 100% 0%');
  assert.strictEqual(cs[6].bgPos, '0% 100%', 'esquina inferior-izquierda en 0% 100%');
  // no cuadrada: 2×3 (2 filas, 3 columnas)
  const cs23 = celdas(2, 3);
  assert.strictEqual(cs23.length, 6, '2×3 → 6 celdas');
  ok('celdas() da la rejilla con bgPos correcto en las esquinas');
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
  const dibujosDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'juegos', 'dibujos');
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

  const dibujosDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'juegos', 'dibujos');
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

console.log(`\n✅ puzzle: ${passed} checks`);
