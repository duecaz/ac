// NINGUNA LEY OPINA SOBRE CÓDIGO QUE NO ES NUESTRO.
//
// Al vendorizar Bootstrap (v1.51.594) hubo que escribir «`vendor/` fuera» en
// CINCO escáneres, con el mismo motivo copiado a mano en tres comentarios. Y aun
// así quedó uno sin enterarse: `tests/huerfanos.test.mjs`, escrita antes de que
// el concepto existiera, llevaba tres versiones aplicando la ley §30 —«ni CSS
// que nadie cargue»— a la hoja de Bootstrap. Estaba verde POR SUERTE: las dos
// `.min.css` resultan estar `<link>`eadas y el bundle acaba en `.min.js`, que su
// filtro ya saltaba por un motivo de hace un año. Una librería con un `.js` sin
// minificar la habría puesto roja acusando a un tercero de no tener importadores.
//
// Sacar la frontera a `tests/helpers/inventario.mjs` no bastaba: un módulo
// compartido que nadie está obligado a importar es solo una sexta copia que el
// séptimo escáner tampoco usará. Esta suite es la FUERZA que lo impide — le
// pregunta a cada escáner por su lista de ficheros y comprueba que ahí no hay
// nada de terceros. Es la misma forma que el resto del proyecto: no se enumeran
// las listas correctas, se ejecuta cada escáner y se mira lo que MIRA.
//
// Run: node tests/inventario.test.mjs
import assert from 'node:assert';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TERCEROS, esDeTerceros, ficheros, hojasDelRepo, paginasDelRepo, ROOT }
  from './helpers/inventario.mjs';
import { appFiles } from './helpers/importGraph.mjs';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── 1) Ningún escáner del repo ve un fichero de terceros ─────────────────────
// Cada entrada EJECUTA el escáner de verdad y mira su lista. Si mañana alguien
// escribe uno nuevo y se olvida del inventario, se añade aquí y sale rojo el
// primer día, no tres versiones después y por suerte.
const ESCANERES = [
  { que: 'importGraph.appFiles (grafo de capas §0)',
    lista: () => appFiles().map(p => p.split(`${ROOT}`).pop().split('\\').join('/')) },
  { que: 'inventario.ficheros (raíz)', lista: () => ficheros('.', () => true) },
  { que: 'inventario.hojasDelRepo', lista: hojasDelRepo },
];
for (const e of ESCANERES) {
  const intrusos = e.lista().filter(f => esDeTerceros(f.replace(/^\.?\//, '')));
  assert.deepStrictEqual(intrusos, [],
    `${e.que} está mirando código de terceros: ${intrusos.slice(0, 3).join(', ')}`);
}
ok(`${ESCANERES.length} escáneres del repo: ninguno mira dentro de ${TERCEROS.join('/')}`);

// ── 2) CONTRA-PRUEBA: el predicado sabe decir que sí ─────────────────────────
// Sin esto, un `esDeTerceros` que devolviera siempre `false` dejaría el punto 1
// en verde para siempre — que es justo el modo en que esta clase de red falla.
assert.ok(esDeTerceros('vendor/bootstrap-5.3.3/css/bootstrap.min.css'), 'vendor/ es de terceros');
assert.ok(esDeTerceros('node_modules/x/index.js'), 'node_modules también');
assert.ok(!esDeTerceros('core/azar.js'), 'y el código nuestro NO lo es');
assert.ok(!esDeTerceros('templates/vendorcito/player.js'),
  'ni una carpeta que solo EMPIECE igual: la frontera es el segmento entero');
ok('CONTRA-PRUEBA: el predicado distingue de verdad (y no por prefijo de cadena)');

// ── 3) El inventario ve lo que hay, no una lista escrita a mano ──────────────
// La lista de las cuatro páginas estaba copiada a mano en tres sitios mientras
// `tools/stamp-assets.mjs` ya la derivaba: una quinta página se sellaría pero
// quedaría invisible para el índice de tokens y para la red de recursos externos.
const paginas = paginasDelRepo();
const enDisco = readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();
assert.deepStrictEqual(paginas, enDisco, 'las páginas se DERIVAN del disco');
assert.ok(paginas.length >= 4, `y hay al menos las cuatro conocidas (${paginas.join(' · ')})`);
const hojas = hojasDelRepo();
assert.ok(hojas.length > 20 && hojas.every(h => h.endsWith('.css')),
  `las hojas propias se recorren enteras (${hojas.length})`);
assert.ok(hojas.some(h => h.startsWith('themes/')) && hojas.some(h => h.startsWith('styles/')),
  'y cubren los DOS orígenes: las del juego y las de los temas');
ok(`inventario derivado del disco: ${paginas.length} páginas · ${hojas.length} hojas`);

console.log(`\ninventario.test: ${passed} checks passed`);
