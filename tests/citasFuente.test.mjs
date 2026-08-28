// CUÁNTOS TESTS VIGILAN LA REDACCIÓN EN VEZ DEL COMPORTAMIENTO — y que no crezcan.
//
// Descubierto trabajando, no auditando: al mover los relojes de live a la hora
// común (§22-5) —un refactor correcto— una suite falló porque exigía la línea
// literal `lastQuestionShownAt = openAtMs || clock.now()`. No había ningún fallo
// en el producto; había una cita desactualizada. Eso enseña dos cosas:
//
//   1. Una cita de fuente da TRABAJO cuando cambias algo bien hecho.
//   2. Y da SILENCIO cuando rompes el comportamiento por otro camino: la línea
//      sigue ahí, el test sigue verde, y la clase se entera antes que CI.
//
// No se pueden eliminar todas: hay invariantes de ESTRUCTURA («abrir pregunta es
// UNA función», «esta vista no reimplementa el conteo») que solo se ven leyendo
// el código. Lo que sí se puede es **medirlas y que no crezcan**: cada cita
// nueva tiene que justificar por qué no es un test de comportamiento.
//
// Es un ratchet, como el de estilos: el número SOLO BAJA.
//
// Run: node tests/citasFuente.test.mjs
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

/** Cuenta, por suite, las aserciones cuyo sujeto es el TEXTO de un fichero. */
function citasPorSuite() {
  const out = {};
  for (const f of readdirSync(AQUI).filter(n => n.endsWith('.test.mjs'))) {
    const src = readFileSync(join(AQUI, f), 'utf8');
    // Variables que contienen código fuente leído del repo.
    const vars = new Set();
    for (const m of src.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:readFileSync|leer|read)\s*\(/g)) vars.add(m[1]);
    for (const m of src.matchAll(/(?:const|let)\s*\{\s*([^}]+)\}\s*=\s*\{[^}]*readFileSync/g)) {
      for (const n of m[1].split(',')) vars.add(n.trim());
    }
    if (!vars.size) continue;
    // Y también la fuente leída EN LÍNEA: la lectura del fichero metida dentro
    // del propio `assert`, sin pasar por una variable. Es la misma cita con otra
    // forma, y el contador no la veía — así el ratchet podía bajar por cambiar de
    // forma en vez de por medir mejor, que es justo lo que este fichero impide.
    const alt = [...vars].map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const enVariable = new RegExp(`assert\\.(?:match|doesNotMatch|ok)\\(\\s*(?:!?\\s*)?(?:${alt})\\b`, 'g');
    const enLinea = /assert\.(?:match|doesNotMatch|ok)\(\s*(?:!?\s*)?(?:read|leer|readFileSync)\s*\(/g;
    const n = (src.match(enVariable) || []).length + (src.match(enLinea) || []).length;
    if (n) out[f.replace('.test.mjs', '')] = n;
  }
  return out;
}

// BASELINE congelado (v1.51.425). Cada número es "cuántas veces esta suite mira
// CÓMO está escrito el código". Solo puede bajar: al convertir una cita en un
// test de comportamiento, baja el número aquí.
const BASELINE = {
  activityCard: 1, citasFuente: 2, docs: 1, idempotency: 2, journeys: 9,
  liveEnd: 6, liveLoops: 2, liveSnapshot: 6, menu: 3, modeAuth: 7,
  newTemplate: 2, pbRules: 1, pbSchema: 3, persistPolicy: 6, quizAnswer: 2,
  quotas: 5, raceResume: 3, realtimePort: 1, roundsLoop: 8,
  unscorable: 8, vocabulario: 2,
};
// `tcTools` salió de la lista en v1.51.488 (bajó de 4 a 0): las dos afirmaciones
// que eran de PÍXELES —«el marco ya no es una segunda tarjeta», «el botón de
// pantalla completa cae dentro de la caja de la barra»— pasaron a medirse con
// estilos computados en `tools/matrix-smoke.mjs`, y las tres que quedan
// (estructura del markup y el cable a `setEraser`) van marcadas con
// `citaDeFuente()`. Motivo para preferir el navegador: la regla que aquieta el
// marco usa `:has()` y ya perdió una vez por especificidad — un escaneo del CSS
// la habría dado por buena.
// `menu` (2→3) y `quotas` (4→5) SUBEN en v1.51.623 sin que nadie haya escrito
// una cita nueva: el contador aprendió a ver la fuente leída EN LÍNEA
// —la lectura metida dentro del propio assert—, que llevaba ahí desde siempre y
// no medía. Un
// ratchet que no ve una forma de la cosa que vigila invita a usar esa forma.
// `activityCard` baja otra vez (2→1) al pintar la tira en vez de leerla.
// `modeAuth` bajó de 8 a 7 en v1.51.621: las tres citas a views/home.js («pasa
// authed», «intercepta el clic bloqueado», «abre el login con motivo») eran una
// LISTA de una vista, y desde que la tarjeta ofrece los modos de profe en toda la
// biblioteca la afirmación es sobre TODAS: ahora se descubren escaneando views/ y
// la intercepción se comprueba en su dueño único.
// `activityCard` bajó de 4 a 2 en v1.51.621: «el componente exporta X» y «la tira
// define la clase act-*» se leían del fichero y ahora se PINTAN — un `act-vs`
// dentro de un comentario pasaba el escaneo igual de bien. Las 2 que quedan son
// estructurales: «Explorar no volvió a Bootstrap» y «el dueño de los clics los
// cablea todos».
// 86 en total. `roundsLoop` bajó de 12 a 8 en v1.51.425: su cálculo de
// puesto y distancia se extrajo a `core/liveRank.js standingOf` (§21, el dueño
// del ranking) y ahora el test comprueba NÚMEROS. Ese es el patrón a repetir:
// no borrar la cita, sino mover el cálculo a donde se pueda ejecutar.

// ── 1. Nadie AÑADE citas de fuente sin darse cuenta ────────────────────────
{
  const hoy = citasPorSuite();
  const subidas = Object.entries(hoy)
    .filter(([s, n]) => n > (BASELINE[s] ?? 0))
    .map(([s, n]) => `${s}: ${BASELINE[s] ?? 0} → ${n}`);
  assert.deepStrictEqual(subidas, [],
    `suites que vigilan MÁS la redacción que antes: ${subidas.join(' · ')}\n` +
    '   → si puedes comprobarlo EJECUTANDO, hazlo; si es un invariante de estructura,\n' +
    '     úsalo con `citaDeFuente()` (tests/helpers/fuente.mjs) y sube el baseline con motivo.');
  const total = Object.values(hoy).reduce((a, b) => a + b, 0);
  ok(`${total} citas de fuente en ${Object.keys(hoy).length} suites: ninguna suite vigila más redacción que antes`);
}

// ── 2. El baseline no puede quedarse inflado ───────────────────────────────
// Si una suite mejora (convierte citas en comportamiento) y nadie baja el
// número, el ratchet deja de apretar en silencio.
{
  const hoy = citasPorSuite();
  const infladas = Object.entries(BASELINE)
    .filter(([s, n]) => (hoy[s] ?? 0) < n)
    .map(([s, n]) => `${s}: baseline ${n}, real ${hoy[s] ?? 0}`);
  assert.deepStrictEqual(infladas, [],
    `el baseline va por detrás de la realidad (bájalo, el ratchet solo aprieta): ${infladas.join(' · ')}`);
  ok('el baseline refleja la realidad de hoy: el ratchet aprieta de verdad');
}

// ── 3. CONTRA-PRUEBA: una cita nueva sería cazada ──────────────────────────
{
  const falso = `const src = readFileSync('x'); assert.match(src, /algo/); assert.match(src, /otra/);`;
  const vars = new Set();
  for (const m of falso.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:readFileSync|leer|read)\s*\(/g)) vars.add(m[1]);
  const re = new RegExp(`assert\\.(?:match|doesNotMatch|ok)\\(\\s*(?:${[...vars].join('|')})\\b`, 'g');
  assert.strictEqual((falso.match(re) || []).length, 2, 'el contador reconoce las citas de fuente');
  ok('CONTRA-PRUEBA: el contador ve las citas (si el parser se rompiera, daría 0 y todo pasaría)');
}

console.log(`\n  ${passed} citasFuente checks passed`);
