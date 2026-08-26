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

// ── 1) Ninguna página carga nada de un CDN ───────────────────────────────────
// Se mira el ORIGEN, no el nombre: la red tiene que cazar también el CDN nuevo
// que a nadie se le ha ocurrido todavía.
const EXENTAS = [
  // Ninguna. Si algún día hace falta un origen externo, va aquí CON su motivo y
  // con qué pasa en un aula sin internet.
];
const conCdn = [];
for (const f of HTML) {
  const html = readFileSync(join(ROOT, f), 'utf8');
  for (const m of html.matchAll(/(?:href|src)\s*=\s*["'](https?:\/\/[^"']+)["']/g)) {
    if (!EXENTAS.some(e => m[1].includes(e))) conCdn.push(`${f} → ${m[1]}`);
  }
}
if (conCdn.length) {
  console.log('\n  Recursos cargados desde fuera (el aula sin internet los pierde):');
  for (const c of conCdn) console.log(`    ✗ ${c}`);
  console.log('\n  Vendorízalo en vendor/ (ver vendor/README.md) o decláralo en EXENTAS');
  console.log('  diciendo qué se ve en un colegio sin red.\n');
}
assert.strictEqual(conCdn.length, 0, `${conCdn.length} recurso(s) externos en los HTML`);
ok(`las ${HTML.length} páginas cargan solo del repo: un aula sin internet ve la app entera`);

// ── 2) Cada ruta local de vendor/ apunta a un fichero que existe ─────────────
// Una ruta mal escrita no da error: da una app sin estilos, y eso se descubre
// con la clase delante.
const rutas = new Set();
for (const f of HTML) {
  const html = readFileSync(join(ROOT, f), 'utf8');
  for (const m of html.matchAll(/(?:href|src)\s*=\s*["'](vendor\/[^"'?]+)/g)) rutas.add(m[1]);
}
assert.ok(rutas.size >= 3, 'los HTML siguen cargando Bootstrap desde vendor/ (CSS, iconos y bundle)');
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
  `vendor/ tiene ${carpetas.join(', ')} y los HTML usan ${[...usadas].join(', ')} — sobra o falta una`);
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
