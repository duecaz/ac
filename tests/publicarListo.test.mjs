// NO SE PUBLICA LO QUE NO SE PUEDE JUGAR.
//
// Un BORRADOR a medias es legítimo: se guarda y se sigue mañana. PUBLICAR es
// otra cosa — mete la actividad en la biblioteca, donde otro profe se la lleva a
// su clase. El guardián de «¿esto se puede jugar?» (`core/activityCheck.js`)
// existía desde hacía versiones y lo consultaban el jugador y el lanzador de
// salas… pero NO la puerta de publicar. Se podía publicar una actividad SIN NADA
// dentro, y el siguiente que la abriera se encontraba el cartel de «todavía está
// vacía» — que es exactamente como lo encontró el dueño (una Ruleta sin
// casillas, 2026-08-26).
//
// Esta suite comprueba las DOS mitades, porque una sola no sirve de nada:
//   · que la puerta esté cerrada para lo que no se puede jugar;
//   · y que siga ABIERTA para lo que sí — una guardia demasiado celosa se
//     descubre con el profe delante, y es igual de cara.
//
// Run: node tests/publicarListo.test.mjs
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../core/registerTemplates.js';
import { getTemplate } from '../core/registry.js';
import { revisarActividad, decidirVisibilidad } from '../core/activityCheck.js';

// LAS PLANTILLAS DE VERDAD, leídas del disco. `listTemplates()` no vale aquí: el
// registro es global y otras suites del runner meten arquetipos de prueba
// (`m_full`, `mm_propio`, `qrace`…) que no traen contenido de ejemplo. Corriendo
// sueltas pasaba y dentro de `tests/run.mjs` fallaba — un test cuyo veredicto
// depende de quién corrió antes no es un test.
const REALES = readdirSync(fileURLToPath(new URL('../templates', import.meta.url)), { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => getTemplate(d.name))
  .filter(Boolean);

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const act = (template, content, title = 'Prueba') =>
  ({ id: 'x', template, title, content, rules: {}, scoring: {} });

// ── 1) Sin contenido escrito = no publicable ─────────────────────────────────
// EXCEPCIÓN, y sale de lo que la plantilla DECLARA, no de su nombre: las que
// GENERAN su contenido (`meta.editor.generado`, hoy solo Ball Sort) no esperan
// que el profe escriba nada — su tablero lo hace la plantilla, así que «sin
// contenido» no significa «a medias». Preguntar por la capacidad y no por la
// identidad es la ley §0, y aquí ahorra una lista de nombres que envejecería.
{
  const escribeElProfe = (T) => !T.meta.editor?.generado;
  const publicables = REALES
    .filter(escribeElProfe)
    .map(T => T.meta.name)
    .filter(n => revisarActividad(act(n, {})).jugable);
  assert.deepStrictEqual(publicables, [],
    `estas plantillas dan por JUGABLE una actividad vacía: ${publicables.join(', ')}`);
  const generadas = REALES.filter(T => !escribeElProfe(T)).map(T => T.meta.name);
  ok(`una actividad vacía nunca es publicable (${REALES.length - generadas.length} plantillas; `
     + `exentas por generar su contenido: ${generadas.join(', ') || 'ninguna'})`);
}

// ── 2) CONTRA-PRUEBA: con su contenido de ejemplo, TODAS se publican ─────────
// Sin esto, un guardián que dijera «no» a todo pasaría el punto 1 y dejaría al
// profe sin poder publicar nada.
{
  const bloqueadas = REALES
    .filter(T => !revisarActividad(act(T.meta.name, T.meta.defaultContent?.() ?? {})).jugable)
    .map(T => T.meta.name);
  assert.deepStrictEqual(bloqueadas, [],
    `CONTRA-PRUEBA: con su propio contenido de ejemplo deberían poder publicarse, y no: ${bloqueadas.join(', ')}`);
  assert.ok(REALES.length >= 13, `el escaneo tiene que ver las plantillas reales, y vio ${REALES.length}`);
  ok(`CONTRA-PRUEBA: con contenido de verdad, las ${REALES.length} se publican sin estorbo`);
}

// ── 3) Y el motivo se DICE, no se calla ──────────────────────────────────────
// R6 del norte: fallar en silencio está prohibido. Si el botón no publica, tiene
// que decir qué falta y qué hacer — no quedarse quieto.
{
  const rev = revisarActividad(act('wheel', {}));
  assert.ok(rev.problemasDeJuego.length >= 1, 'la revisión trae al menos un problema que contar');
  assert.ok(rev.problemasDeJuego.every(p => String(p).trim().length > 10),
    'un problema telegráfico no le dice nada a quien prepara la clase');
  assert.ok(String(rev.primerPaso || '').trim().length > 20,
    'una actividad vacía tiene que decir POR DÓNDE empezar, no solo que está vacía');
  ok(`el aviso dice qué falta y por dónde empezar («${rev.primerPaso.slice(0, 46)}…»)`);
}

// ── 4) LA DECISIÓN, PROBADA POR LO QUE HACE ─────────────────────────────────
// Antes esto era un regex sobre el TEXTO de `editView.js` —hasta la expresión
// exacta `(setVis || activity.visibility) === 'public'`—. Un test así se rompe al
// renombrar una variable y se queda VERDE ante una versión que calcula lo mismo
// mal: comprueba una ortografía, no una regla. Ahora la decisión es una función
// pura y se le pregunta lo que de verdad importa.
{
  const vacia = act('wheel', {});
  const llena = act('wheel', getTemplate('wheel').meta.defaultContent());

  // a) Alguien PULSA publicar algo injugable: no se hace, y se dice por qué.
  const pulsa = decidirVisibilidad(vacia, 'public', 'accion');
  assert.strictEqual(pulsa.rechaza, true, 'pulsar publicar en algo injugable tiene que rechazarse');
  assert.notStrictEqual(pulsa.visibility, 'public', 'y desde luego no puede quedar pública');
  assert.match(pulsa.aviso, /No se puede publicar/, 'y tiene que decirlo (R6)');

  // b) AUTOSAVE de algo YA público que se ha quedado injugable: se guarda igual
  //    —perder lo escrito sería peor— pero baja a borrador, y lo dice.
  const auto = decidirVisibilidad({ ...vacia, visibility: 'public' }, null, 'guardado');
  assert.strictEqual(auto.rechaza, false, 'el autosave NUNCA puede negarse a guardar el trabajo del profe');
  assert.strictEqual(auto.visibility, 'unlisted', 'pero lo injugable no se queda en la biblioteca');
  assert.ok(auto.aviso.length > 20, 'y el profe se entera de que ha pasado a borrador');

  // c) CONTRA-PRUEBA, la que faltaba: con contenido de verdad no estorba en
  //    NINGUNA de las dos ramas. Una guarda que degrada lo sano es peor que la
  //    puerta abierta, y no había nada que lo comprobara.
  assert.deepStrictEqual(
    decidirVisibilidad(llena, 'public', 'accion'),
    { visibility: 'public', aviso: '', rechaza: false }, 'publicar algo jugable no puede estorbar');
  assert.strictEqual(decidirVisibilidad({ ...llena, visibility: 'public' }, null, 'guardado').visibility,
    'public', 'CONTRA-PRUEBA: el autosave de algo público y sano lo deja público');
  // d) Y guardar un BORRADOR a medias sigue siendo legítimo: ni avisa ni toca nada.
  assert.deepStrictEqual(decidirVisibilidad(vacia, 'unlisted', 'accion'),
    { visibility: 'unlisted', aviso: '', rechaza: false },
    'un borrador a medias se guarda sin ceremonia: es el caso NORMAL de trabajar');
  ok('decidirVisibilidad: rechaza al publicar · degrada en autosave · y no estorba a lo sano (4 contra-pruebas)');
}

// ── 5) Y TODA PUERTA PASA POR ESE DUEÑO ──────────────────────────────────────
// Esto sí es un escaneo, y DESCUBRE: cualquier módulo que escriba `visibility =
// 'public'` sin consultar al dueño rompe CI, incluida una tercera puerta que
// alguien añada mañana. Nació de una: la guarda se puso en el editor y el
// interruptor «Borrador → Pública» de la tarjeta del home publicaba sin
// preguntar nada — un clic, sin editor de por medio.
{
  const raiz = fileURLToPath(new URL('..', import.meta.url));
  const dirs = ['views', 'core', 'kernel', 'adapters'];
  const sueltas = [];
  const recorrer = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const f = join(d, e.name);
      if (e.isDirectory()) { recorrer(f); continue; }
      if (!e.name.endsWith('.js')) continue;
      const src = readFileSync(f, 'utf8');
      // El PUNTO importa: `a.visibility = 'public'` es ESCRIBIR, mientras que
      // `visibility = "public"` suelto es una regla de PocketBase o un filtro de
      // consulta —LEER lo ya publicado—, y `core/pbRules.js` y el adaptador están
      // llenos de esos. Sin el punto, el escaneo señalaba a los dos y la única
      // salida habría sido una lista de excepciones: un test que pide silencio.
      if (!/\.visibility\s*=\s*['"`]public['"`]/.test(src)) continue;
      if (/decidirVisibilidad/.test(src)) continue;
      sueltas.push(f.slice(raiz.length));
    }
  };
  for (const d of dirs) recorrer(join(raiz, d));
  assert.deepStrictEqual(sueltas, [],
    `estos módulos ponen visibility='public' sin pasar por decidirVisibilidad: ${sueltas.join(', ')}`);
  // CONTRA-PRUEBA: el escaneo tiene que estar MIRANDO de verdad. Si nadie
  // publicara en ningún sitio, la lista vacía de arriba no probaría nada.
  const puertas = [];
  for (const d of dirs) {
    const buscar = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const f = join(dir, e.name);
        if (e.isDirectory()) { buscar(f); continue; }
        if (e.name.endsWith('.js') && /decidirVisibilidad/.test(readFileSync(f, 'utf8'))) puertas.push(e.name);
      }
    };
    buscar(join(raiz, d));
  }
  assert.ok(puertas.length >= 3,
    `el escaneo debería ver al dueño y sus dos puertas, y ve ${puertas.length}: ${puertas.join(', ')}`);
  ok(`ninguna puerta publica por su cuenta (${puertas.length} módulos citan al dueño: ${puertas.join(' · ')})`);
}

console.log(`\npublicarListo.test: ${passed} checks passed`);
