// SELLA LA VERSIÓN EN LOS <link> DE ESTILO — para que el CSS llegue cuando el
// JS llega, y no diez minutos después.
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
// Uso: node tools/stamp-assets.mjs [--check]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { VERSION } from '../core/constants.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const soloComprobar = process.argv.includes('--check');

// Hojas PROPIAS: las que empiezan por `styles/` o `themes/`. Una URL absoluta
// (CDN) ya viene versionada en su propia ruta.
const LINK = /(<link\b[^>]*\bhref=")((?:styles|themes)\/[^"?]+\.css)(\?v=[^"]*)?(")/g;

export function sellarHtml(src, version = VERSION) {
  return src.replace(LINK, (_, ini, ruta, __, fin) => `${ini}${ruta}?v=${version}${fin}`);
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
