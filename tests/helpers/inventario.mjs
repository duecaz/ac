// EL INVENTARIO DEL REPO — qué ficheros hay, y cuáles NO son nuestros.
//
// POR QUÉ EXISTE. Al vendorizar Bootstrap (v1.51.594) hubo que escribir
// «`vendor/` fuera» en CINCO listas distintas, con el mismo motivo copiado a
// mano en tres comentarios. Y aun así quedó una sexta sin enterarse:
// `tests/huerfanos.test.mjs`, escrita antes de que el concepto existiera,
// seguía aplicando la ley §30 («ni CSS que nadie cargue») a la hoja de
// Bootstrap. Estaba verde POR SUERTE — las dos `.min.css` resultan estar
// `<link>`eadas y el bundle acaba en `.min.js`, que su filtro ya saltaba por
// otro motivo de hace un año. Una librería con un `.js` sin minificar la habría
// puesto roja acusando a un tercero de no tener importadores.
//
// Ese es el fallo que una lista repetida garantiza: la frontera se vuelve a
// decidir en cada escáner, así que el escáner escrito ANTES nunca se entera.
//
// LO QUE VIVE AQUÍ Y LO QUE NO. Solo el eje que es igual para todos: «esto no
// es código nuestro». El otro eje —qué mira CADA ley (producto · observadores ·
// docs · assets)— es legítimamente distinto en cada suite y se queda en ella:
// `importGraph` salta `themes/styles/assets`, `moduleRefs` los quiere,
// `nombresRetirados` mira hasta los tests. Unificar los dos ejes ensancharía o
// estrecharía en silencio el alcance de cuatro leyes a la vez.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const rel = (p) => relative(ROOT, p).split('\\').join('/');

/** Carpetas que NO contienen código nuestro. Ni una ley del proyecto opina
 *  sobre lo que hay dentro: son dependencias copiadas (vendor/, ver
 *  vendor/README.md), ruido de herramientas o salidas de una ejecución. */
export const TERCEROS = ['node_modules', '.git', 'vendor', '.shots', 'scratchpad'];

/** ¿Esta ruta (relativa a la raíz, con `/`) es de terceros? */
export const esDeTerceros = (ruta) =>
  TERCEROS.some(d => ruta === d || ruta.startsWith(`${d}/`) || ruta.includes(`/${d}/`));

/** Recorre desde `desde` (relativo a la raíz) y devuelve rutas relativas con
 *  `/`, saltando siempre lo de terceros. `filtro` decide qué ficheros entran. */
export function ficheros(desde = '.', filtro = () => true) {
  const out = [];
  (function paseo(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      const r = rel(p);
      if (esDeTerceros(r)) continue;
      if (e.isDirectory()) paseo(p);
      else if (filtro(r)) out.push(r);
    }
  })(join(ROOT, desde));
  return out.sort();
}

/** LAS HOJAS DE ESTILO PROPIAS. Estaba definida de CUATRO maneras distintas
 *  —y las cuatro discrepaban en mecanismo: una recursiva y otra no, una
 *  saltándose `sounds/` y otra nada, y `tests/styles.test.mjs` mirando solo
 *  `themes/*​/skin.css`, con lo que una segunda hoja dentro de un tema le era
 *  invisible—. Es exactamente lo que la cabecera de `tests/helpers/css.mjs`
 *  vino a impedir para los LECTORES; se había quedado a un paso, sin poseer
 *  también la LISTA. */
export const hojasDelRepo = () =>
  [...ficheros('styles', f => f.endsWith('.css')),
   ...ficheros('themes', f => f.endsWith('.css'))];

/** Las páginas del proyecto (las de la raíz). Se DERIVA, no se escribe: la
 *  lista literal de las cuatro estaba copiada en tres sitios mientras
 *  `tools/stamp-assets.mjs` ya la derivaba — o sea que una quinta página se
 *  sellaría pero quedaría invisible para el índice de tokens y para la red de
 *  recursos externos. */
export const paginasDelRepo = () =>
  readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();

/** El CSS que vive DENTRO de una página (`<style>…</style>`), ya unido. */
export const cssDeHtml = (html) =>
  [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');

/** Los ficheros de una carpeta de TERCEROS, pedidos a propósito y por su
 *  nombre. `ficheros()` los salta siempre —esa es su razón de ser—, así que
 *  quien de verdad necesita mirar dentro (el índice de tokens, para saber si
 *  Bootstrap LEE los `--bs-*` que le declaramos) tiene que decirlo en voz alta. */
export function ficherosDeTerceros(carpeta, filtro = () => true) {
  const out = [];
  (function paseo(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) paseo(p);
      else if (filtro(rel(p))) out.push(rel(p));
    }
  })(join(ROOT, carpeta));
  return out.sort();
}

/** Lee un fichero del repo por su ruta relativa. */
export const leer = (ruta) => readFileSync(join(ROOT, ruta), 'utf8');
