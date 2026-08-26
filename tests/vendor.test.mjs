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
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { hojasDelRepo, leer, paginasDelRepo, ROOT } from './helpers/inventario.mjs';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Las páginas se DERIVAN del disco, no se escriben. La lista literal de «las
// cuatro» estaba copiada en tres sitios y ya se había quedado corta: `test.html`
// —la hoja de pruebas del equipo, que sirve aulareto.com/test— no estaba en
// ninguna, así que ni esta red ni el índice de tokens la habían mirado nunca.
const HTML = paginasDelRepo();
const HOJAS = hojasDelRepo();
const FUENTES = new Map([...HTML, ...HOJAS].map(f => [f, leer(f)]));

// ── 1) Nada de la app se carga desde fuera ───────────────────────────────────
// Se mira el ORIGEN, no el nombre: la red tiene que cazar también el CDN nuevo
// que a nadie se le ha ocurrido todavía.
//
// Esta red va por su TERCERA forma, y las dos primeras fallaron igual: por mirar
// menos de lo que decían mirar.
//   1ª (v1.51.594): solo `href`/`src` de los HTML → daba verde con
//      `themes/arcade/skin.css` importando la fuente de píxeles de
//      fonts.googleapis.com. Sin internet, Arcade se quedaba en Courier mientras
//      la ley proclamaba «cero recursos externos».
//   2ª (v1.51.596): tres «puertas» enumeradas, pero una era postiza —la rama
//      `@import url(` está enteramente subsumida por la rama `url(`— y NINGUNA
//      cazaba la forma sin paréntesis, `@import "https://…";`. Un regex que
//      NOMBRA un caso que no trata aparte se lee como cobertura que no está.
// Ahora son DOS formas de verdad distintas, cada una con su contra-prueba, sobre
// TODO el texto de páginas y hojas (así entra también un `url(https://…)` dentro
// de un `<style>`, que ninguna versión anterior veía).
const EXTERNO = String.raw`https?:\/\/[^"')\s]+`;
const FORMAS = [
  { que: 'url(…) — hojas, <style> y @import con paréntesis', re: new RegExp(String.raw`url\(\s*["']?(${EXTERNO})`, 'g') },
  { que: '@import "…" — sin paréntesis', re: new RegExp(String.raw`@import\s+["'](${EXTERNO})`, 'g') },
  { que: 'href/src de una página', re: new RegExp(String.raw`(?:href|src)\s*=\s*["'](${EXTERNO})["']`, 'g') },
];
const EXENTAS = [
  // Ninguna. Si algún día hace falta un origen externo, va aquí CON su motivo y
  // con qué pasa en un colegio sin red.
];
const conCdn = [];
for (const [f, src] of FUENTES) {
  for (const { que, re } of FORMAS) {
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

// CONTRA-PRUEBA: cada forma tiene que cazar SU caso. Sin esto, un escáner que no
// encontrase nada nunca —por un regex roto— pasaría por verde para siempre, que
// es exactamente como fallaron las dos versiones anteriores.
const CASOS = [
  `@import url('https://fonts.googleapis.com/css2?family=X');`,
  `@import "https://fonts.googleapis.com/css2?family=X";`,
  `<link href="https://cdn.jsdelivr.net/npm/x/y.css" rel="stylesheet">`,
  `.a { background: url(https://ejemplo.com/f.png); }`,
];
for (const caso of CASOS) {
  const visto = FORMAS.some(({ re }) => { re.lastIndex = 0; return re.test(caso); });
  assert.ok(visto, `CONTRA-PRUEBA: ninguna forma caza ${caso}`);
}
ok(`${HTML.length} páginas + ${HOJAS.length} hojas: nada se carga de fuera (${FORMAS.length} formas, ${CASOS.length} casos de contra-prueba)`);

// ── 2) Cada ruta local de vendor/ apunta a un fichero que existe ─────────────
// Una ruta mal escrita no da error: da una app sin estilos, y eso se descubre
// con la clase delante. Se recogen del MISMO texto ya leído: los HTML apuntan a
// `vendor/…` y las hojas con `../../vendor/…` (así llega la fuente al tema).
const rutas = new Set();
for (const src of FUENTES.values()) {
  for (const m of src.matchAll(/(?:href|src)\s*=\s*["'](vendor\/[^"'?]+)/g)) rutas.add(m[1]);
  for (const m of src.matchAll(/url\(\s*["']?(?:\.\.\/)*(vendor\/[^"')?]+)/g)) rutas.add(m[1]);
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
  const src = leer(`tools/${h}`);
  return /route\([^)]*bootstrap[^)]*\)|route\([^)]*vendor\/[^)]*\)/i.test(src);
});
assert.deepStrictEqual(anulan, [],
  `estas herramientas interceptan Bootstrap y por tanto NO miden la pantalla real: ${anulan.join(', ')}`);
ok(`las ${HERRAMIENTAS.length} herramientas del arnés cargan el Bootstrap de verdad`);

console.log(`\nvendor.test: ${passed} checks passed`);
