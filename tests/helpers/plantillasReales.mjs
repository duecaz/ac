// QUIÉNES SON «LAS PLANTILLAS DE VERDAD» — un dueño, no cinco copias.
//
// El registro (`core/registry.js`) es GLOBAL y el runner corre todas las suites
// en el MISMO proceso: para cuando llega la quinta, media docena de tests ha
// dejado registradas plantillas de mentira (`t_solo`, `qlocal`, sintéticas de
// contra-prueba…). Así que `listTemplates()` no responde «cuáles son las
// plantillas del producto» — responde «qué hay registrado ahora mismo».
//
// Cinco sitios resolvían eso por su cuenta y de DOS maneras distintas: leyendo
// las carpetas de `templates/` (editorPanels, homePreview, kind,
// templateContract, check-template) o leyendo los imports de
// `core/registerTemplates.js` (liveLoops). Las dos son correctas hoy porque
// coinciden, y esa coincidencia no la comprobaba nadie: el día que una carpeta
// exista sin registrarse (o al revés), cada test diría una cosa.
//
// Aquí viven las dos, y `comprobarParidad()` obliga a que sigan diciendo lo
// mismo — que es justo la costura que se quería cerrar.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TDIR = join(ROOT, 'templates');

/** Las CARPETAS de `templates/` que son una plantilla (tienen `template.js`). */
export function carpetas() {
  return readdirSync(TDIR)
    .filter(n => { try { return statSync(join(TDIR, n)).isDirectory(); } catch { return false; } })
    .filter(n => { try { return statSync(join(TDIR, n, 'template.js')).isFile(); } catch { return false; } })
    .sort();
}

/** Los nombres que el PUNTO ÚNICO de registro importa (`core/registerTemplates.js`). */
export function registradas() {
  const src = readFileSync(join(ROOT, 'core', 'registerTemplates.js'), 'utf8');
  return [...src.matchAll(/templates\/([\w-]+)\/index\.js/g)].map(m => m[1]).sort();
}

/** Carpeta y registro dicen lo mismo. Lo llama quien use cualquiera de las dos:
 *  si divergen, el fallo sale AQUÍ con su nombre, no como un recuento raro tres
 *  suites más allá. */
export function comprobarParidad(assert) {
  assert.deepStrictEqual(carpetas(), registradas(),
    'las carpetas de templates/ y los imports de core/registerTemplates.js no coinciden: '
    + 'una plantilla sin registrar (o un registro sin carpeta) hace que cada test cuente una cosa distinta');
}

/** Cuántas plantillas tiene el producto. La cifra que ninguna suite debe
 *  escribir a mano (lo vigila `tools/costuras-cifras.mjs`). */
export const cuantas = () => carpetas().length;

/** Las plantillas REALES ya registradas, sin las sintéticas que otras suites
 *  dejaron en el registro global. */
export function reales(listTemplates) {
  const nombres = new Set(carpetas());
  return listTemplates().filter(T => nombres.has(T?.meta?.name));
}
