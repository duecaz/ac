// UN TOKEN QUE NADIE LEE ES UN MANDO QUE NO MANDA.
//
// Es la misma ley que `tests/ajusteConectado.test.mjs`, aplicada a la OTRA
// interfaz de la app. Allí el mando lo mueve el profe en el panel; aquí lo mueve
// un tema en su hoja. Los dos prometen lo mismo —«cambia esto y cambiará
// aquello»— y los dos pueden mentir exactamente igual.
//
// La ley §3 dice: «el skin cambia TOKENS, la actividad consume TOKENS». Eso
// convierte a los tokens en un CONTRATO, y un contrato tiene dos formas de
// romperse:
//
//   1. DECLARADO Y NUNCA CONSUMIDO — alguien define `--x` y ningún `var(--x)`
//      lo lee. El tema cree que pinta; no pinta nada. Al escribir esta red había
//      tres así: `--ww-primary` (el color «primario» de la app, que no coloreaba
//      nada desde hacía versiones), `--cw-frame-2` (el degradado de una cabecera
//      del crucigrama que ya no existe) y `--cw-num` (la numeración, que acabó
//      leyendo `--ww-card-fg` y dejó su token atrás). Los tres borrados.
//   2. CONSUMIDO SIN DECLARAR NI RESPALDO — `var(--x)` sin fallback y sin nadie
//      que le dé valor. No es un color pálido: es la nada, y la propiedad
//      entera se cae. Un `var(--x, #333)` sí vale: el respaldo ES la promesa.
//
// Es un ESCANEO, no una lista: un token nuevo queda cubierto el día que se
// escribe, sin que nadie se acuerde de venir aquí. El mapa legible de todo el
// contrato lo genera `node tools/tokens.mjs` en `docs/tokens.md`.
//
// Run: node tests/tokenConectado.test.mjs
import assert from 'node:assert';
import { escanear, familiaDe } from '../tools/tokens.mjs';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// EXENCIONES, cada una con su motivo. Un token exento sigue en el índice.
//
// `--bs-*` los declara `styles/theme.css` para que los LEA BOOTSTRAP, que entra
// por CDN y no está en el repo. El consumidor existe y es real; simplemente no
// se puede escanear. (El día que Bootstrap se vendorice o se sustituya por CSS
// propio —deuda declarada en §3— esta exención cae sola y la red los mirará.)
const DECLARADO_SIN_LEER = [
  { prefijo: '--bs-', motivo: 'los consume Bootstrap, que llega por CDN y no se puede escanear' },
];
const exento = (t) => DECLARADO_SIN_LEER.some(e => t.startsWith(e.prefijo));

const { declara, consume, conRespaldo, todos } = escanear();

// ── 1) Ningún token declarado se queda sin lector ────────────────────────────
const muertos = todos.filter(t => declara.has(t) && !consume.has(t) && !exento(t));
if (muertos.length) {
  console.log('\n  Tokens DECLARADOS que nadie consume (un mando que no manda):');
  for (const t of muertos) console.log(`    ✗ ${t} — lo declara ${[...declara.get(t)].join(', ')}`);
  console.log('\n  Bórralo, o conéctalo con un var() de verdad. Si su consumidor');
  console.log('  está fuera del repo, decláralo en DECLARADO_SIN_LEER con su motivo.\n');
}
assert.strictEqual(muertos.length, 0, `${muertos.length} token(s) declarados y nunca consumidos`);
ok(`${todos.length} tokens: ninguno declarado sin que alguien lo consuma (${DECLARADO_SIN_LEER.length} exención declarada)`);

// ── 2) Ningún var() se lee sobre la nada ─────────────────────────────────────
const huerfanos = todos.filter(t => !declara.has(t) && !conRespaldo.has(t));
if (huerfanos.length) {
  console.log('\n  Tokens CONSUMIDOS que nadie declara y sin respaldo (la propiedad se cae entera):');
  for (const t of huerfanos) console.log(`    ✗ ${t} — lo lee ${[...consume.get(t)].join(', ')}`);
}
assert.strictEqual(huerfanos.length, 0, `${huerfanos.length} token(s) leídos sobre la nada`);
ok('ningún var() se lee sobre la nada: o hay quien lo declare, o hay respaldo');

// ── 3) El índice generado está al día ────────────────────────────────────────
// Un mapa viejo es peor que no tenerlo: se consulta creyéndolo verdad. Mismo
// trato que `docs/arquitectura-modulos.md` y `docs/piezas-por-actividad.md`.
const { generar } = await import('../tools/tokens.mjs');
const { readFileSync } = await import('node:fs');
const { fileURLToPath } = await import('node:url');
const doc = fileURLToPath(new URL('../docs/tokens.md', import.meta.url));
let previo = '';
try { previo = readFileSync(doc, 'utf8'); } catch { previo = '(no existe)'; }
assert.strictEqual(previo, generar(), 'docs/tokens.md desactualizado — corre `node tools/tokens.mjs`');
ok('docs/tokens.md al día con las hojas y el JS');

// ── CONTRA-PRUEBAS: la red tiene que saber decir que NO ──────────────────────
// Sin esto, un escáner que no encontrase nada nunca —por un regex roto o un
// directorio mal excluido— pasaría por verde para siempre.
assert.ok(todos.length > 100, 'el escaneo encuentra la paleta entera, no cuatro tokens sueltos');
assert.ok(declara.size > 50 && consume.size > 50, 'las dos mitades del contrato tienen contenido');
ok(`CONTRA-PRUEBA: el escáner ve de verdad (${declara.size} declarados · ${consume.size} consumidos)`);

// Y que las dos leyes distinguen el caso legítimo del roto, sobre casos reales:
const conFallback = todos.filter(t => conRespaldo.has(t));
assert.ok(conFallback.length > 20,
  'CONTRA-PRUEBA: el respaldo se detecta — si no, `var(--x, #333)` saldría como huérfano y la red gritaría por todo');
const familias = new Set(todos.map(familiaDe));
assert.ok(familias.has('ww') && familias.size > 5,
  'CONTRA-PRUEBA: las familias se separan (la global y las de plantilla), que es como se lee el índice');
ok(`CONTRA-PRUEBA: ${conFallback.length} tokens con respaldo y ${familias.size} familias reconocidas`);

console.log(`\ntokenConectado.test: ${passed} checks passed`);
