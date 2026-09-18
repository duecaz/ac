// SELLA LA VERSIÓN EN LO QUE EL NAVEGADOR CACHEA: las hojas de estilo y los
// MÓDULOS — para que todo llegue a la vez, y no diez minutos después.
//
// El caso (dueño, 2026-08-15): tras publicar un arreglo que era CASI TODO CSS,
// el chip de la barra ya decía `v1.51.495` y la pantalla seguía con el fallo
// anterior. No era el arreglo: era que el chip solo prueba que llegó el JS. Las
// hojas de estilo son ficheros aparte, GitHub Pages las sirve con
// `max-age=600`, y el navegador puede seguir usando la vieja un buen rato — así
// que la app queda MEZCLADA: módulos nuevos con estilos viejos. Eso convierte
// cualquier reporte visual en una adivinanza («¿está mal, o es la caché?»), que
// es exactamente lo que le pasó al dueño dos veces seguidas.
//
// La cura es la de siempre en la web: que la URL cambie cuando cambia el
// contenido. Aquí se sella `?v=<VERSION>` en cada hoja PROPIA (las de CDN no se
// tocan: son inmutables por versión). Se ejecuta con el resto de regenerados —
// `node tools/stamp-assets.mjs` — y lo vigila `tests/cacheBusting.test.mjs`: si
// se sube la versión y se olvida sellar, CI lo dice antes que la clase.
//
// Y PASÓ OTRA VEZ, UNA CAPA MÁS ABAJO (dueño, 2026-09-18). Se arregló una
// figura del tangram, el chip decía `v1.51.715` y la figura seguía rota: el
// chip sale de `core/constants.js`, que SÍ había llegado nuevo, mientras
// `templates/tangram/game/siluetas.js` venía del caché. Los módulos se piden
// por su ruta pelada —solo el de ENTRADA lleva `?_=`, y su query no se hereda—
// así que cada fichero caduca por su cuenta y la app corre MEZCLADA. El dueño
// perdió media mañana creando actividades que nacían mal.
//
// La cura es la misma, pero un `?v=` por import es imposible sin build (y este
// proyecto no tiene build, a propósito): se genera un IMPORT MAP con todos los
// módulos propios apuntando a su URL sellada. El navegador resuelve cada
// import por el mapa y pide la versión de hoy. Si un navegador viejo no
// entendiera el mapa, lo IGNORA y todo sigue como antes: no puede romper nada.
//
// Uso: node tools/stamp-assets.mjs [--check]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { VERSION } from '../core/constants.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const soloComprobar = process.argv.includes('--check');

// Hojas PROPIAS: las que empiezan por `styles/` o `themes/`. Una URL absoluta
// (CDN) ya viene versionada en su propia ruta.
const LINK = /(<link\b[^>]*\bhref=")((?:styles|themes)\/[^"?]+\.css)(\?v=[^"]*)?(")/g;

// EL MÓDULO DE ENTRADA cargado con `src`: el import map NO se aplica al `src`
// de una etiqueta (solo a los specifiers de dentro de un módulo), así que ese
// fichero se sella en el atributo o se queda sin versión — y es justamente el
// que arrastra a todos los demás.
const ENTRADA = /(<script\b[^>]*\btype="module"[^>]*\bsrc=")([\w.-]+\.js)(\?v=[^"]*)?(")/g;

// Los módulos PROPIOS de la app: los que un import puede alcanzar desde una
// página. `tools/` y `tests/` no se sirven; `vendor/` ya viene versionado en su
// ruta.
const CARPETAS_MODULOS = ['core', 'kernel', 'adapters', 'templates', 'views', 'themes'];
/** Módulos sueltos en la raíz que un import alcanza (las entradas `main.*` y la
 *  configuración del backend). Se listan porque la raíz tiene además ficheros
 *  que NO se importan nunca. */
const RAIZ_RE = /^(main\.[\w-]+|pocketbase\.config)\.js$/;

/** Todas las rutas de módulo del proyecto, relativas a la raíz y ordenadas
 *  (el orden hace que el mapa generado sea estable entre corridas).
 *  @param {string} [raiz] @returns {string[]} */
export function modulosDelProyecto(raiz = ROOT) {
  /** @param {string} dir @returns {string[]} */
  const bajar = (dir) => readdirSync(join(raiz, dir)).flatMap((e) => {
    const rel = `${dir}/${e}`;
    return statSync(join(raiz, rel)).isDirectory() ? bajar(rel) : (e.endsWith('.js') ? [rel] : []);
  });
  const sueltos = readdirSync(raiz).filter(f => RAIZ_RE.test(f));
  return [...sueltos, ...CARPETAS_MODULOS.flatMap(bajar)].sort();
}

/** El import map, tal cual se inserta. Las claves son ABSOLUTAS desde la raíz
 *  del sitio, que es como resuelve el navegador un `./x.js` de un módulo que
 *  vive en `/core/`: la clave tiene que ser la URL RESUELTA, no la escrita. */
/** @param {string[]} modulos @param {string} version @returns {string} */
export function importMapHtml(modulos, version = VERSION) {
  const imports = modulos.map(m => `    "/${m}": "/${m}?v=${version}"`).join(',\n');
  return `<script type="importmap">\n{\n  "imports": {\n${imports}\n  }\n}\n</script>`;
}

const MAPA_RE = /<script type="importmap">[\s\S]*?<\/script>\n?/;
// El primer <script type="module"> de la página, lo cargue en línea o con
// `src` (student.html y embed.html usan `src`: sin contemplarlos se quedaban
// sin mapa, que es justo la página del ALUMNO).
const ANCLA_RE = /<script\b[^>]*\btype="module"/;

export function sellarHtml(src, version = VERSION, modulos = modulosDelProyecto()) {
  const conCss = src
    .replace(LINK, (_, ini, ruta, __, fin) => `${ini}${ruta}?v=${version}${fin}`)
    .replace(ENTRADA, (_, ini, ruta, __, fin) => `${ini}${ruta}?v=${version}${fin}`);
  // El mapa va ANTES del primer módulo (si no, el navegador lo ignora) y solo
  // puede haber uno por documento.
  const mapa = `${importMapHtml(modulos, version)}\n`;
  if (MAPA_RE.test(conCss)) return conCss.replace(MAPA_RE, mapa);
  const i = conCss.search(ANCLA_RE);
  return i < 0 ? conCss : conCss.slice(0, i) + mapa + conCss.slice(i);
}

export function htmlsDelProyecto() {
  return readdirSync(ROOT).filter(f => f.endsWith('.html'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const desfasados = [];
  for (const f of htmlsDelProyecto()) {
    const p = join(ROOT, f);
    const antes = readFileSync(p, 'utf8');
    const despues = sellarHtml(antes);
    if (antes === despues) continue;
    desfasados.push(f);
    if (!soloComprobar) writeFileSync(p, despues);
  }
  if (soloComprobar && desfasados.length) {
    console.error(`❌ HTML sin sellar con v${VERSION}: ${desfasados.join(', ')}\n   Corre: node tools/stamp-assets.mjs`);
    process.exit(1);
  }
  console.log(desfasados.length
    ? `✅ sellado v${VERSION} en ${desfasados.join(', ')}`
    : `✅ ya estaban sellados con v${VERSION}`);
}
