// CONTRASTE DECLARADO — corre core/contrastCheck.js (el MISMO checker que el
// panel #/admin) sobre los 7 temas y los 11 fondos.
//
// Por qué existe: hasta hoy el contraste solo se comprobaba al FINAL, con la
// matriz headless midiendo lo pintado. Esa red tiene dos agujeros que este test
// cierra en el origen:
//   · llega tarde — el ámbar con letra blanca (2.4:1) y las etiquetas del
//     diagrama (2.4:1) vivieron en el repo hasta que alguien corrió la matriz;
//   · es ciega al lienzo — al topar con un `background-image` no puede componer
//     el color, y las 10 texturas son degradados, así que los fondos NUNCA se
//     midieron.
// Aquí los colores son hex y la aritmética es WCAG pura: se juzga al declarar.
// Run: node tests/contrast.test.mjs
import assert from 'node:assert';
import { listSkins } from '../core/skins.js';   // side-effect: registra los built-in
import { BACKGROUNDS } from '../core/backgrounds.js';
import { ratio, luminancia, AA_TEXTO, AA_GRANDE } from '../core/contrast.js';
import {
  checkSkinContrast, checkBackgroundContrast,
  checkAllSkinContrast, checkAllBackgroundContrast,
} from '../core/contrastCheck.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const r2 = (a, b) => Math.round(ratio(a, b) * 100) / 100;

// ── La aritmética, contra valores conocidos ──────────────────────────────────
assert.strictEqual(r2('#000000', '#ffffff'), 21, 'negro sobre blanco = 21:1');
assert.strictEqual(r2('#ffffff', '#ffffff'), 1, 'un color contra sí mismo = 1:1');
assert.strictEqual(r2('#ffffff', '#000000'), 21, 'el orden no importa');
assert.strictEqual(luminancia('#fff'), luminancia('#ffffff'), 'acepta el hex corto');
assert.strictEqual(ratio('#fff', 'rgba(0,0,0,.5)'), null, 'lo que no es hex sólido NO se juzga');
// El caso real que dio origen a todo: ámbar del Kahoot-grid con letra blanca.
assert.ok(r2('#ffffff', '#d89e00') < 3, `el ámbar con letra blanca es ${r2('#ffffff', '#d89e00')}:1 — por debajo de AA grande`);
assert.ok(r2('#1f2937', '#d89e00') >= 4.5, `con letra oscura sube a ${r2('#1f2937', '#d89e00')}:1`);
ok('aritmética WCAG: 21:1 · 1:1 · simétrica · hex corto · rechaza lo no medible');

// ── Los TEMAS registrados ────────────────────────────────────────────────────
const skins = listSkins();
assert.ok(skins.length >= 7, `esperaba ≥7 temas, hay ${skins.length}`);
const malosSkins = checkAllSkinContrast();
assert.deepStrictEqual(malosSkins, [],
  'temas con pares ilegibles:\n' + malosSkins.map(f => `  - ${f.name}: ${f.issues.join(' · ')}`).join('\n'));
ok(`los ${skins.length} temas: texto de página/tarjeta ≥${AA_TEXTO}:1 y las 4 opciones ≥${AA_GRANDE}:1`);

// ── Los FONDOS ───────────────────────────────────────────────────────────────
const fondos = Object.entries(BACKGROUNDS);
const malosBg = checkAllBackgroundContrast();
assert.deepStrictEqual(malosBg, [],
  'fondos que incumplen:\n' + malosBg.map(f => `  - ${f.name}: ${f.issues.join(' · ')}`).join('\n'));
ok(`los ${fondos.length} fondos declaran placa, o tinta + lienzo con ≥${AA_TEXTO}:1`);

// Cada fondo con lienzo propio se mide de verdad (no basta con que exista el campo).
const conLienzo = fondos.filter(([, d]) => d.ink && d.colorBase);
assert.ok(conLienzo.length >= 9, `esperaba ≥9 fondos con tinta declarada, hay ${conLienzo.length}`);
for (const [name, d] of conLienzo) {
  assert.ok(ratio(d.ink, d.colorBase) >= AA_TEXTO, `${name}: ${r2(d.ink, d.colorBase)}:1`);
}
// El único con placa es la foto del profe: es el único lienzo que no conocemos.
const conPlaca = fondos.filter(([, d]) => d.plate).map(([n]) => n);
assert.deepStrictEqual(conPlaca, ['custom'],
  'la placa es para lienzos NO medibles; si un fondo nuevo la pide, decídelo aquí');
ok(`${conLienzo.length} fondos con tinta medida · placa solo en «${conPlaca.join(', ')}» (lienzo desconocido)`);

// ── CONTRA-PRUEBA: el checker DETECTA, no solo aprueba ───────────────────────
const temaMalo = {
  name: 'malo', label: 'Malo',
  cssVars: { ...skins[0].cssVars, '--ww-shape-3': '#d89e00', '--ww-shape-3-fg': '#ffffff' },
};
assert.ok(checkSkinContrast(temaMalo).some(i => i.includes('opción 3')),
  'un tema con el ámbar en letra blanca (2.4:1) es RECHAZADO');
assert.ok(checkBackgroundContrast('x', { plate: false, ink: '#999999', colorBase: '#aaaaaa' }).length > 0,
  'un fondo con tinta que no contrasta con su lienzo es RECHAZADO');
assert.ok(checkBackgroundContrast('x', { plate: false }).length >= 2,
  'un fondo nuevo sin tinta ni lienzo es RECHAZADO (no se puede medir)');
assert.ok(checkBackgroundContrast('x', { plate: true, ink: '#fff' }).length > 0,
  'con placa, declarar tinta es una promesa que nadie usa: se rechaza');
// …y el camino legítimo sigue pasando (una regla demasiado cerrada se descubre
// con la clase delante).
assert.deepStrictEqual(checkBackgroundContrast('x', { plate: true }), [], 'un fondo con placa pasa');
assert.deepStrictEqual(checkBackgroundContrast('none', BACKGROUNDS.none), [], '«none» pasa sin declarar lienzo');
assert.deepStrictEqual(checkSkinContrast(skins[0]), [], 'el tema por defecto pasa');
ok('CONTRA-PRUEBA: caza el ámbar en blanco, la tinta floja y el fondo sin declarar — y deja pasar lo legítimo');

console.log(`\n  ${passed} contrast checks passed`);
