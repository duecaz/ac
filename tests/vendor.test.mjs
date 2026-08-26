// LO QUE LA CLASE CARGA TIENE QUE ESTAR EN EL REPO.
//
// Bootstrap entraba por `cdn.jsdelivr.net` en las cuatro páginas. Sin él,
// `box-sizing: border-box` desaparece y TODA la maquetación cambia de modelo de
// caja: los anchos en % se desbordan por su propio relleno. En un colegio sin
// internet la app no se ve mal, se ve ROTA — y eso no puede depender de la red
// de otro (deuda declarada en docs/leyes.md §3).
//
// Y tenía un segundo coste, el que hizo que esto se ejecutara ahora: SEIS
// herramientas del arnés sustituían el CDN por una hoja de estilos VACÍA. O sea
// que la matriz, las piezas, el viaje en vivo, el de tareas, el de buscar y las
// capturas llevaban tiempo midiendo una pantalla que ningún profe ve. De ahí
// salió una conclusión falsa que hubo que retirar («la calculadora tiene dos
// tipografías»): los botones caían a la fuente del navegador porque Bootstrap
// no estaba, no porque el código lo hiciera.
//
// Esta red comprueba lo único que puede volver a romperse en silencio: que las
// rutas de los HTML apunten a ficheros que EXISTEN, y que nadie vuelva a meter
// un CDN por la puerta de atrás.
//
// Run: node tests/vendor.test.mjs
import assert from 'node:assert';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const HTML = ['index.html', 'teacher.html', 'student.html', 'embed.html'];

// ── 1) Nada de la app se carga desde fuera ───────────────────────────────────
// Se mira el ORIGEN, no el nombre: la red tiene que cazar también el CDN nuevo
// que a nadie se le ha ocurrido todavía.
//
// Y se miran las TRES puertas, no solo la evidente. La primera versión de esta
// red solo leía `href`/`src` de los cuatro HTML y por eso daba verde con
// `themes/arcade/skin.css` importando la fuente de píxeles de
// fonts.googleapis.com: en un aula sin internet el tema Arcade se quedaba en
// Courier mientras la ley proclamaba «cero recursos externos». Una red que
// mira una sola puerta enseña a confiar en una promesa que no cubre.
const EXENTAS = [
  // Ninguna. Si algún día hace falta un origen externo, va aquí CON su motivo y
  // con qué pasa en un colegio sin red.
];
const PUERTAS = [
  { que: 'HTML (href/src)', ficheros: HTML, re: /(?:href|src)\s*=\s*["'](https?:\/\/[^"']+)["']/g },
  { que: 'CSS (@import / url())', ficheros: hojas(), re: /(?:@import\s+url\(\s*["']?|url\(\s*["']?)(https?:\/\/[^"')]+)/g },
  { que: 'HTML (@import en <style>)', ficheros: HTML, re: /@import\s+url\(\s*["']?(https?:\/\/[^"')]+)/g },
];
function hojas() {
  const out = [];
  for (const dir of ['styles', 'themes']) {
    (function walk(d) {
      for (const f of readdirSync(join(ROOT, d), { withFileTypes: true })) {
        if (f.isDirectory()) walk(`${d}/${f.name}`);
        else if (f.name.endsWith('.css')) out.push(`${d}/${f.name}`);
      }
    })(dir);
  }
  return out;
}
const conCdn = [];
for (const { que, ficheros, re } of PUERTAS) {
  for (const f of ficheros) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    for (const m of src.matchAll(re)) {
      if (!EXENTAS.some(e => m[1].includes(e))) conCdn.push(`${f} [${que}] → ${m[1]}`);
    }
  }
}
if (conCdn.length) {
  console.log('\n  Recursos cargados desde fuera (el aula sin internet los pierde):');
  for (const c of conCdn) console.log(`    ✗ ${c}`);
  console.log('\n  Vendorízalo en vendor/ (ver vendor/README.md) o decláralo en EXENTAS');
  console.log('  diciendo qué se ve en un colegio sin red.\n');
}
assert.strictEqual(conCdn.length, 0, `${conCdn.length} recurso(s) externos`);
// CONTRA-PRUEBA de la puerta que se escapó: si el escáner de CSS no viera los
// `@import`, este caso pasaría por bueno y la fuente volvería al CDN sin ruido.
const falso = [...'@import url(\'https://fonts.googleapis.com/css2?family=X\');'
  .matchAll(PUERTAS[1].re)].map(m => m[1]);
assert.deepStrictEqual(falso, ['https://fonts.googleapis.com/css2?family=X'],
  'CONTRA-PRUEBA: el escáner de hojas ve un @import a un CDN');
ok(`${HTML.length} páginas + ${hojas().length} hojas: nada se carga de fuera (3 puertas miradas)`);

// ── 2) Cada ruta local de vendor/ apunta a un fichero que existe ─────────────
// Una ruta mal escrita no da error: da una app sin estilos, y eso se descubre
// con la clase delante.
// Se recogen por las MISMAS puertas del punto 1: los HTML apuntan a `vendor/…`
// y las hojas con `../../vendor/…` (así llega la fuente de píxeles a Arcade).
// Mirar solo los HTML dejaría media carpeta fuera del control de versiones.
const rutas = new Set();
for (const f of HTML) {
  const html = readFileSync(join(ROOT, f), 'utf8');
  for (const m of html.matchAll(/(?:href|src)\s*=\s*["'](vendor\/[^"'?]+)/g)) rutas.add(m[1]);
}
for (const f of hojas()) {
  const css = readFileSync(join(ROOT, f), 'utf8');
  for (const m of css.matchAll(/url\(\s*["']?(?:\.\.\/)*(vendor\/[^"')?]+)/g)) rutas.add(m[1]);
}
assert.ok(rutas.size >= 4, 'siguen cargándose desde vendor/ Bootstrap (CSS, iconos, bundle) y la fuente del tema');
const faltan = [...rutas].filter(r => !existsSync(join(ROOT, r)));
assert.deepStrictEqual(faltan, [], `rutas de vendor/ que no existen: ${faltan.join(', ')}`);
ok(`las ${rutas.size} rutas de vendor/ apuntan a ficheros que existen`);

// ── 3) La versión del path es la versión de la carpeta ───────────────────────
// La versión va en el NOMBRE de la carpeta para que el navegador no pueda
// servir la anterior desde caché. Si los HTML y las carpetas se desincronizan,
// media clase carga una versión y media la otra.
const carpetas = readdirSync(join(ROOT, 'vendor'), { withFileTypes: true })
  .filter(d => d.isDirectory()).map(d => d.name);
const usadas = new Set([...rutas].map(r => r.split('/')[1]));
assert.deepStrictEqual([...usadas].sort(), carpetas.sort(),
  `vendor/ tiene ${carpetas.join(', ')} y la app usa ${[...usadas].join(', ')} — sobra o falta una`);
ok(`vendor/ no acumula versiones muertas: ${carpetas.join(' · ')}`);

// ── 4) El arnés mide lo que ve el profe ──────────────────────────────────────
// CONTRA-PRUEBA de la razón por la que existe esta red. Si mañana alguien
// vuelve a sustituir Bootstrap por una hoja vacía «para no depender de la red»,
// las mediciones vuelven a describir una app que nadie usa.
const HERRAMIENTAS = ['matrix-smoke.mjs', 'piezas.mjs', 'find-smoke.mjs',
  'live-smoke.mjs', 'task-smoke.mjs', 'shots.mjs'];
const anulan = HERRAMIENTAS.filter(h => {
  const src = readFileSync(join(ROOT, 'tools', h), 'utf8');
  return /route\([^)]*bootstrap[^)]*\)|route\([^)]*vendor\/[^)]*\)/i.test(src);
});
assert.deepStrictEqual(anulan, [],
  `estas herramientas interceptan Bootstrap y por tanto NO miden la pantalla real: ${anulan.join(', ')}`);
ok(`las ${HERRAMIENTAS.length} herramientas del arnés cargan el Bootstrap de verdad`);

console.log(`\nvendor.test: ${passed} checks passed`);
