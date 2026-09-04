// Colorear — el banco de dibujos (compartido con Rompecabezas, §21b) y el
// scorer puro. Sin DOMParser (Node no lo trae fuera del navegador): el
// contrato del banco se comprueba con una lectura de etiquetas por regex,
// suficiente para SVG hecho a mano con formas simples (rect/circle/ellipse/
// polygon/path) — no es un parser XML general, y no hace falta serlo aquí.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DIBUJOS, rutaDibujo } from '../core/bancoDibujos.js';
import { scoreColorearSubmission } from '../templates/colorear/scorer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const SHAPE_TAG_RE = /<(path|rect|circle|ellipse|polygon)\b[^>]*\/?>/g;
const ATTR_RE = (n) => new RegExp(`\\b${n}="(-?[\\d.]+)"`);

/** Caja envolvente (bbox) de una forma SIMPLE — no de un `<path>` cualquiera
 *  (para eso haría falta un motor de curvas de verdad), pero es justo lo que
 *  usa el banco: rect/circle/ellipse/polygon. `null` si la forma es un
 *  `<path>` (no lo necesitamos: el banco actual no usa ninguno). */
function bboxDe(tag) {
  const num = (n) => Number(ATTR_RE(n).exec(tag)?.[1]);
  if (/^<rect\b/.test(tag)) {
    const x = num('x'), y = num('y'), w = num('width'), h = num('height');
    return { x0: x, x1: x + w, y0: y, y1: y + h };
  }
  if (/^<circle\b/.test(tag)) {
    const cx = num('cx'), cy = num('cy'), r = num('r');
    return { x0: cx - r, x1: cx + r, y0: cy - r, y1: cy + r };
  }
  if (/^<ellipse\b/.test(tag)) {
    const cx = num('cx'), cy = num('cy'), rx = num('rx'), ry = num('ry');
    return { x0: cx - rx, x1: cx + rx, y0: cy - ry, y1: cy + ry };
  }
  if (/^<polygon\b/.test(tag)) {
    const pts = (/points="([^"]+)"/.exec(tag)?.[1] || '').trim().split(/\s+/)
      .map(p => p.split(',').map(Number));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }
  return null;
}

/** ¿Se cortan A y B con área POSITIVA? Tocarse por el borde (ancho o alto de
 *  intersección 0) NO cuenta — es justo cómo el tejado se apoya en la pared
 *  sin invadirla. */
function seCortan(a, b) {
  const iw = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const ih = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return iw > 0 && ih > 0;
}
const contiene = (a, b) => a.x0 <= b.x0 && a.x1 >= b.x1 && a.y0 <= b.y0 && a.y1 >= b.y1;

/** Regla del banco (encargo del coordinador, tras medir colorear-2-pintado.png:
 *  la puerta pisaba la ventana): las zonas de UN mismo dibujo no se solapan,
 *  salvo que una esté COMPLETA dentro de la otra (una ventana dentro de la
 *  pared). En la pizarra, un dedo sobre el área compartida solo pinta la de
 *  arriba y la de abajo se queda sin explicación — eso es lo que se prueba. */
function validarGeometria(svgText) {
  const cajas = [];
  for (const m of svgText.matchAll(SHAPE_TAG_RE)) {
    const tag = m[0];
    const zona = /data-zona="([^"]+)"/.exec(tag)?.[1] || '?';
    const bb = bboxDe(tag);
    if (bb) cajas.push({ zona, bb });
  }
  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      const A = cajas[i], B = cajas[j];
      if (seCortan(A.bb, B.bb) && !contiene(A.bb, B.bb) && !contiene(B.bb, A.bb)) {
        assert.fail(`"${A.zona}" y "${B.zona}" se solapan sin que una contenga a la otra`);
      }
    }
  }
}

/** Contrato del banco (docs/handoff-juegos-inicial.md §3): cada forma cerrada
 *  lleva `data-zona` y `data-color` (hex de 6). No es «parsear XML» de
 *  verdad, pero SÍ es exactamente lo que el player y el Rompecabezas leen —
 *  si esto pasa, los dos lo pueden usar. Devuelve la lista de zonas o lanza
 *  con el motivo, para que la contra-prueba pueda comprobar el fallo. */
function validarBanco(svgText) {
  assert.ok(/^\s*<svg\b/.test(svgText), 'debe empezar por <svg');
  assert.ok(/<\/svg>\s*$/.test(svgText), 'debe cerrar </svg>');
  assert.ok(!/<text\b/.test(svgText), 'sin texto dentro del SVG (contenido para quien no lee)');
  const zonas = [];
  for (const m of svgText.matchAll(SHAPE_TAG_RE)) {
    const tag = m[0];
    const zona = /data-zona="([^"]+)"/.exec(tag)?.[1];
    const color = /data-color="([^"]+)"/.exec(tag)?.[1];
    assert.ok(zona, `forma sin data-zona: ${tag.slice(0, 60)}`);
    assert.ok(color && HEX_RE.test(color), `data-color inválido en zona "${zona}": ${color}`);
    zonas.push(zona);
  }
  assert.ok(zonas.length > 0, 'ninguna zona pintable encontrada');
  return zonas;
}

// ── (a) El banco de verdad: los 8 SVG ────────────────────────────────────────
console.log('  · banco: 8 dibujos, contrato completo');
assert.strictEqual(DIBUJOS.length, 8, 'el banco declara 8 dibujos para empezar');

for (const d of DIBUJOS) {
  const ruta = join(ROOT, 'assets', 'juegos', 'dibujos', d.archivo);
  const buf = readFileSync(ruta);
  assert.ok(buf.length <= 12 * 1024, `${d.archivo}: ${buf.length} bytes > 12 KB`);

  const svgText = buf.toString('utf8');
  assert.ok(/viewBox="0 0 100 100"/.test(svgText), `${d.archivo}: viewBox debe ser "0 0 100 100"`);

  const zonas = validarBanco(svgText);
  // Cada zona ≥4, ≤9 (docs/handoff-juegos-inicial.md) y el índice no puede MENTIR:
  // si el fichero cambia de zonas y nadie actualiza index.js, esto lo caza.
  assert.ok(zonas.length >= 4 && zonas.length <= 9,
    `${d.nombre}: ${zonas.length} zonas fuera de 4-9`);
  assert.strictEqual(zonas.length, d.zonas,
    `${d.nombre}: index.js dice ${d.zonas} zonas pero el SVG tiene ${zonas.length}`);
  // Nombres de zona únicos dentro del mismo dibujo (si no, el player no sabría
  // distinguir "ya pintada ésta" de "ya pintada la otra" al contar el Set).
  assert.strictEqual(new Set(zonas).size, zonas.length, `${d.nombre}: data-zona repetido`);

  // GEOMETRÍA: ninguna zona pisa a otra sin contenerla del todo (un dedo real
  // sobre el área compartida solo pintaría la de encima).
  assert.doesNotThrow(() => validarGeometria(svgText), `${d.nombre}: zonas solapadas`);
}

console.log('  · rutaDibujo(): ruta válida para el banco, null para lo desconocido');
assert.strictEqual(rutaDibujo('casa'), 'assets/juegos/dibujos/casa.svg');
assert.strictEqual(rutaDibujo('unicornio-inventado'), null);

// ── (c) CONTRA-PRUEBA: un SVG sintético con una zona sin data-color falla ────
console.log('  · contra-prueba: el escaneo SÍ detecta un banco roto');
const svgRoto = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="0" y="0" width="50" height="50" data-zona="a" data-color="#ff0000"/>
  <rect x="50" y="50" width="50" height="50" data-zona="b"/>
</svg>`;
assert.throws(() => validarBanco(svgRoto), /data-color inválido/, 'una zona sin data-color debe fallar la validación');

// Y su contraprueba positiva: la MISMA forma, arreglada, pasa.
const svgArreglado = svgRoto.replace('data-zona="b"', 'data-zona="b" data-color="#00ff00"');
assert.deepStrictEqual(validarBanco(svgArreglado), ['a', 'b']);

console.log('  · contra-prueba: dos rects a medio solapar SÍ se detectan');
const svgSolapado = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="0" y="0" width="60" height="60" data-zona="a" data-color="#ff0000"/>
  <rect x="40" y="40" width="60" height="60" data-zona="b" data-color="#00ff00"/>
</svg>`;
assert.throws(() => validarGeometria(svgSolapado), /"a" y "b" se solapan/, 'rects a medio solapar deben fallar');

console.log('  · contra-prueba: una zona TOTALMENTE dentro de otra (ventana en la pared) SÍ pasa');
const svgContenido = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="0" y="0" width="100" height="100" data-zona="pared" data-color="#ffffff"/>
  <rect x="20" y="20" width="20" height="20" data-zona="ventana" data-color="#0000ff"/>
</svg>`;
assert.doesNotThrow(() => validarGeometria(svgContenido));

console.log('  · contra-prueba: dos formas que solo se TOCAN por el borde no cuentan como solape');
const svgTocan = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="0" y="0" width="50" height="50" data-zona="a" data-color="#ff0000"/>
  <rect x="50" y="0" width="50" height="50" data-zona="b" data-color="#00ff00"/>
</svg>`;
assert.doesNotThrow(() => validarGeometria(svgTocan));

// ── (b) El scorer, puro ───────────────────────────────────────────────────────
console.log('  · scorer: 0 pintadas → no acierta');
{
  const r = scoreColorearSubmission({ value: { pintadas: 0, total: 6 } });
  assert.strictEqual(r.correct, false);
  assert.strictEqual(r.points, 0);
  assert.strictEqual(r.hits, 0);
  assert.strictEqual(r.total, 6);
}

console.log('  · scorer: todas pintadas → 100 puntos');
{
  const r = scoreColorearSubmission({ value: { pintadas: 6, total: 6 } });
  assert.strictEqual(r.correct, true);
  assert.strictEqual(r.points, 100);
  assert.strictEqual(r.hits, 6);
}

console.log('  · scorer: a medias → puntaje proporcional, ≥1 pintada YA es correcto (sin "mal" posible)');
{
  const r = scoreColorearSubmission({ value: { pintadas: 3, total: 6 } });
  assert.strictEqual(r.correct, true);
  assert.strictEqual(r.points, 50);
}

console.log('  · scorer: contra-prueba — total 0 no divide por cero');
{
  const r = scoreColorearSubmission({ value: { pintadas: 0, total: 0 } });
  assert.strictEqual(r.points, 0);
  assert.strictEqual(r.correct, false);
  assert.strictEqual(Number.isFinite(r.points), true);
}

console.log('  · scorer: pintadas nunca puede superar total (dato defensivo)');
{
  const r = scoreColorearSubmission({ value: { pintadas: 9, total: 4 } });
  assert.strictEqual(r.hits, 4);
  assert.strictEqual(r.points, 100);
}

console.log('✅ colorear');
