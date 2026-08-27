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
import { fileURLToPath } from 'node:url';
import '../core/registerTemplates.js';
import { getTemplate } from '../core/registry.js';
import { revisarActividad } from '../core/activityCheck.js';

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

// ── 4) La puerta está cableada de verdad en el editor ────────────────────────
// Los puntos 1-3 verifican el guardián; esto verifica que la VISTA lo llama en
// el camino de publicar. Sin esta línea, el guardián podría ser perfecto y la
// puerta seguir abierta — que es justo como estaba.
{
  const src = readFileSync(fileURLToPath(new URL('../views/editView.js', import.meta.url)), 'utf8');
  const doSave = src.slice(src.indexOf('async function doSave'), src.indexOf('const { remote, persisted }'));
  assert.ok(/revisarActividad/.test(doSave),
    'el camino de guardar de editView.js tiene que consultar revisarActividad');
  // LA PREGUNTA ES «¿VA A QUEDAR PÚBLICA?», NO «¿QUÉ BOTÓN SE PULSÓ?». Con la
  // guarda escrita como `setVis === 'public'` a secas, una actividad YA publicada
  // que se vacía en el editor la volvía a guardar pública el AUTOSAVE (que pasa
  // `setVis` nulo): el mismo agujero, entrando por la otra puerta.
  assert.ok(/\(setVis \|\| activity\.visibility\) === 'public'/.test(doSave),
    'la guarda tiene que mirar la visibilidad RESULTANTE (setVis || la que ya tiene), no solo el botón');
  assert.ok(/return;/.test(doSave.slice(doSave.indexOf('revisarActividad'))),
    'y tiene que PARAR al PUBLICAR: avisar y seguir publicando sería peor que no avisar');
  // …pero el autosave NO puede parar: perder lo que el profe acaba de escribir
  // por una guarda sería mucho peor que el fallo original. Baja a borrador y lo
  // dice (R6).
  const tramo = doSave.slice(doSave.indexOf('revisarActividad'));
  assert.ok(/activity\.visibility = 'unlisted'/.test(tramo) && /toast\(/.test(tramo),
    'el autosave de algo ya público que deja de ser jugable debe GUARDAR igual, bajar a borrador y decirlo');
  ok('editView.js gatea por la visibilidad resultante: publicar para, y el autosave baja a borrador sin perder trabajo');
}

console.log(`\npublicarListo.test: ${passed} checks passed`);
