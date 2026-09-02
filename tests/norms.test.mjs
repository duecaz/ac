// Normas transversales — corre core/normsCheck.js (el MISMO escáner que usa el
// self-test del panel #/admin) sobre TODO el JS del repo (fs walk = autoridad;
// el admin solo alcanza por fetch los ficheros de su manifest + plantillas).
// Convierte en CI las reglas de CLAUDE.md: nunca `new ResizeObserver` directo,
// nunca `filter=` de PB con encodeURIComponent, kernel/ sin Date.now().
// Run: node tests/norms.test.mjs
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { scanNormsSource, BROWSER_SCAN_FILES } from '../core/normsCheck.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['core', 'kernel', 'views', 'templates', 'adapters'];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (name.endsWith('.js')) yield p;
  }
}

const violations = [];
let scanned = 0;
for (const d of DIRS) {
  for (const file of walk(join(ROOT, d))) {
    const rel = relative(ROOT, file).replaceAll('\\', '/');
    violations.push(...scanNormsSource(rel, readFileSync(file, 'utf8')));
    scanned++;
  }
}
// main.*.js de la raíz también son código de la app.
for (const name of readdirSync(ROOT)) {
  if (/^main\..*\.js$/.test(name)) {
    violations.push(...scanNormsSource(name, readFileSync(join(ROOT, name), 'utf8')));
    scanned++;
  }
}

if (violations.length) {
  console.error('\n✗ Violaciones de normas transversales:');
  for (const v of violations) console.error(`  - [${v.rule}] ${v.path}:${v.line} → ${v.text}`);
  console.error('\n  Normas (CLAUDE.md + docs/leyes.md): observeResize() en vez de RO directo · pbEscape/');
  console.error('  pbFilterParam para filtros PB · kernel/ determinista (sin Date.now()) · pb-dueno:');
  console.error('  solo el módulo DUEÑO nombra su colección PB — pide un método al dueño (leyes.md §21).');
}
assert.strictEqual(violations.length, 0, `${violations.length} violación(es) de normas — ver arriba`);
ok(`${scanned} ficheros JS escaneados, 0 violaciones (RO directo / filtro PB a pelo / Date.now en kernel)`);

// El manifest del admin no puede apuntar a ficheros inexistentes (rotaría el
// self-test del deploy con 404s silenciosos).
for (const f of BROWSER_SCAN_FILES) {
  assert.ok(statSync(join(ROOT, f), { throwIfNoEntry: false }), `BROWSER_SCAN_FILES apunta a un fichero inexistente: ${f}`);
}
ok(`manifest del admin válido (${BROWSER_SCAN_FILES.length} ficheros existen)`);

// El escáner DETECTA de verdad cada norma (no es un stub).
const bad = scanNormsSource('views/x.js',
  `const ro = new ResizeObserver(cb);\nfetch(\`?filter=(code='\${encodeURIComponent(c)}')\`);`);
assert.strictEqual(bad.length, 2, 'detecta RO directo y filtro PB a pelo');
assert.strictEqual(scanNormsSource('kernel/x.js', 'const t = Date.now();').length, 1, 'detecta Date.now en kernel');
assert.strictEqual(scanNormsSource('kernel/x.js', '// comentario con Date.now()').length, 0, 'ignora comentarios');
assert.strictEqual(scanNormsSource('core/observeResize.js', 'new ResizeObserver(cb)').length, 0, 'allowlist del helper');
// pb-dueno (ley de datos §21): un módulo cualquiera nombrando una colección → violación;
// el dueño y el literal exacto dentro de otra palabra → limpios.
assert.strictEqual(scanNormsSource('views/x.js', `fetch('/api/collections/results/records')`).length, 1, 'caza fetch a colección ajena');
assert.strictEqual(scanNormsSource('views/x.js', `const c = 'live_answers';`).length, 1, 'caza el literal de colección');
assert.strictEqual(scanNormsSource('adapters/pocketbase/remoteStore.js', `fetch('/api/collections/results/records')`).length, 0, 'el dueño puede');
assert.strictEqual(scanNormsSource('core/storage.js', `ls('ww.activities.' + uid)`).length, 0, 'no confunde substrings (ww.activities.)');
// ls-dueno (ley §21 aplicada al ALMACÉN): cada clave `ww.*` tiene UN dueño
// declarado en LS_OWNERS. Sin esta regla, `ww.nick` acabó declarada en DOS
// vistas y `ww.skin` se leía sin que nadie la escribiera nunca.
assert.strictEqual(scanNormsSource('views/studentTask.js', `const K = 'ww.nick';`).length, 1, 'una vista no puede poseer el apodo');
assert.strictEqual(scanNormsSource('core/identity.js', `const K = 'ww.nick';`).length, 0, 'su dueño sí');
assert.strictEqual(scanNormsSource('views/x.js', `lsGet('ww.inventada')`).length, 1, 'una clave nueva sin declarar se caza');
assert.strictEqual(scanNormsSource('core/soloPlayer.js', `lsDel('ww.solo.progress.' + id)`).length, 0, 'el prefijo dinámico del dueño es legítimo');
// fallo-mudo (R6 del norte: fallar en silencio está prohibido): un catch VACÍO
// que se traga una operación que el usuario PIDIÓ. El best-effort no se
// prohíbe — se exige DECIR el motivo, que es cuando uno ve si de verdad lo era.
assert.strictEqual(scanNormsSource('views/x.js', `try { await remove(id); } catch {}`).length, 1, 'caza un borrado tragado');
assert.strictEqual(scanNormsSource('views/x.js', `try { await saveActivity(a); } catch {}`).length, 1, 'y un guardado tragado');
assert.strictEqual(scanNormsSource('views/x.js', `try { await remove(id); } catch {}   // best-effort: la fila ya no estaba`).length, 0, 'con el motivo escrito, pasa');
assert.strictEqual(scanNormsSource('views/x.js', `try { el.dispose(); } catch {}`).length, 0, 'un teardown no es una operación del usuario');
assert.ok(!scanNormsSource('views/x.js', `try { localStorage.removeItem(k); } catch {}`).some(v => v.rule === 'fallo-mudo'),
  'limpiar el almacén tiene su propio aviso (ww:storage-full) — no cuenta como fallo mudo');
// confianza-alumno (ley §22): el lado alumno no nombra verbos del host; el host sí puede.
assert.strictEqual(scanNormsSource('views/studentLive.js', `import { settleItem } from '../core/liveTransport.js';`).length, 1, 'alumno no liquida');
assert.strictEqual(scanNormsSource('views/hostLive.js', `await settleItem(sessionId, i);`).length, 0, 'el host sí liquida');
assert.strictEqual(scanNormsSource('views/studentLive.js', `await setSessionState(id, patch);`).length, 1, 'el alumno tampoco controla la sala');
assert.strictEqual(scanNormsSource('views/studentLive.js', `await claimQuestion(id, claim);`).length, 0, 'pedir la palabra sí (campo ql)');
// reloj-primitivo (ley §23): interval crudo → violación; ctx.setInterval y el primitivo, no.
assert.strictEqual(scanNormsSource('views/x.js', `const t = setInterval(paint, 500);`).length, 1, 'caza setInterval crudo');
assert.strictEqual(scanNormsSource('views/x.js', `ctx.setInterval(paint, 500);`).length, 0, 'ctx.setInterval es la vía');
assert.strictEqual(scanNormsSource('core/soloTimer.js', `setInterval(tick, 1000)`).length, 0, 'el primitivo puede');
// reloj-sala (ley §22-5): un instante de la SALA medido con el reloj de ESTE
// aparato → violación. Es el fallo que se comió preguntas en clase: con el
// Android 25 s atrasado, al alumno no se le abrían las respuestas nunca.
assert.strictEqual(scanNormsSource('views/studentLive.js', `const reading = openAtMs > clock.now();`).length, 1,
  'caza la comparación de un instante de la sala contra el reloj del aparato');
assert.strictEqual(scanNormsSource('views/hostLive.js', `answers_open_at: new Date(clock.now() + 3000).toISOString(),`).length, 1,
  'y también SELLAR un instante de la sala con el reloj del profe (su reloj torcido rompe a toda la clase)');
assert.strictEqual(scanNormsSource('views/studentLive.js', `const reading = openAtMs > serverNow();`).length, 0,
  'con la hora común, bien');
assert.strictEqual(scanNormsSource('core/soloPlayer.js', `const timeUsed = Math.round((clock.now() - startedAt) / 1000);`).length, 0,
  'CONTRA-PRUEBA: un aparato midiendo SU propia duración (modo Individual) no es tiempo de sala — el reloj del cacharro es el correcto');
assert.strictEqual(scanNormsSource('core/serverNow.js', `return clock.now() + offsetMs;`).length, 0,
  'y la propia hora común puede usar el reloj crudo: es su implementación');
// id-rid (ley §24): base36 a mano → violación; rid() y la implementación, no.
// (en una plantilla el mismo renglón rompe DOS leyes: el id a mano y el azar
//  llamado en su sitio — por eso se comprueba la REGLA, no cuántas saltan)
assert.ok(scanNormsSource('templates/x/editor.js', `const id = 'q_' + Math.random().toString(36).slice(2, 8);`)
  .some(v => v.rule === 'id-rid'), 'caza el id a mano');
// (desde que `azar-primitivo` mira TODO el repo, este renglón rompe las dos
//  leyes en cualquier fichero: el id a mano y el azar fuera del primitivo)
assert.ok(scanNormsSource('views/x.js', `const id = 'q_' + Math.random().toString(36).slice(2, 8);`)
  .some(v => v.rule === 'azar-primitivo'), 'y el azar salta también fuera de una plantilla');
assert.strictEqual(scanNormsSource('core/ids.js', `return prefix + Math.random().toString(36).slice(2, 8);`).length, 0, 'ids.js es la implementación');
// azar-primitivo (ley §23, gemela de reloj-primitivo): en las superficies de
// juego el azar se INYECTA. Nació de una red que mentía: `tools/shots.mjs`
// comparaba dos capturas del MISMO árbol y cantaba 2.500 píxeles porque Quiz
// baraja al montar; el apaño conocía el `rules` de UNA plantilla.
assert.strictEqual(scanNormsSource('templates/quiz/player.js', `const i = Math.floor(Math.random() * opts.length);`).length, 1,
  'caza el azar llamado en su sitio dentro de una plantilla');
assert.strictEqual(scanNormsSource('kernel/session/engine.js', `if (Math.random() < 0.5) return null;`).length, 1,
  'y también en el cerebro del juego');
assert.strictEqual(scanNormsSource('templates/ballsort/game/board.js', `[balls[i], balls[j]] = [balls[j], balls[i]];`).length, 1,
  'caza el Fisher-Yates a mano: el dueño del barajado es uno');
// El hueco que duró tres versiones: `= Math.random` en la firma parecía
// «inyectable» y por eso se dejaba pasar. Ningún llamador inyectaba jamás, así
// que el defecto era el que corría siempre y `semilla()` no llegaba ni a la
// ruleta ni al tablero. Un parámetro cuyo defecto esquiva el primitivo ES el
// primitivo sin usar.
assert.strictEqual(scanNormsSource('templates/wheel/logic.js', `export function pickIndex(count, rnd = Math.random) {`).length, 1,
  'caza el defecto que esquiva el primitivo, aunque el parámetro parezca inyectable');
assert.strictEqual(scanNormsSource('templates/wheel/logic.js', `export function pickIndex(count, rnd = azar.random) {`).length, 0,
  'CONTRA-PRUEBA: con el primitivo de defecto, el parámetro sigue siendo inyectable y la ley pasa');
assert.strictEqual(scanNormsSource('templates/quiz/player.js', `if (activity.rules?.shuffleOptions) shuffle(opts2);`).length, 0,
  'CONTRA-PRUEBA: el camino legítimo —barajar por el primitivo— pasa limpio');
assert.strictEqual(scanNormsSource('core/azar.js', `const j = Math.floor(dado() * (i + 1));\n[a[i], a[j]] = [a[j], a[i]];`).length, 0,
  'y core/azar.js es la implementación');
assert.strictEqual(scanNormsSource('core/effects.js', `const v = startVelocity * (0.5 + Math.random());`).length, 0,
  'CONTRA-PRUEBA: el confeti está DECLARADO en ALLOW con su motivo — no es contenido jugable');
assert.strictEqual(scanNormsSource('adapters/pocketbase/assignments.js', `s += LETTERS[Math.floor(Math.random() * LETTERS.length)];`).length, 0,
  'ni el PIN de una tarea, que debe ser IMPREDECIBLE (reproducirlo sería el fallo)');
// Y el cambio de altitud, comprobado: la ley ya no mira solo donde se le dijo.
// Con el alcance viejo (kernel/ + templates/ + tres ficheros de core NOMBRADOS)
// un módulo nuevo de core que ordenase lo que ve la clase pasaba invisible.
assert.strictEqual(scanNormsSource('core/moduloNuevo.js', `const i = Math.floor(Math.random() * items.length);`).length, 1,
  'un módulo de core NUEVO que sortea contenido salta sin que nadie amplíe una lista de rutas');
assert.strictEqual(scanNormsSource('views/hostLive.js', `const orden = Math.random() - 0.5;`).length, 1,
  'y una vista, también: el modo de fallar de esta ley ya es ruidoso, como el de las otras diez');
// imagen-buscable (F6): pedir una imagen sin ofrecer BUSCARLA. El bug que lo
// creó: «Etiqueta el diagrama» solo dejaba subir, y quien quería un corazón
// humano no tenía ninguno en el móvil — la actividad no se podía ni empezar.
assert.strictEqual(scanNormsSource('templates/x/editor.js', `a.content.image = await uploadMedia(f);`).length, 1,
  'caza el editor que solo deja subir');
assert.strictEqual(scanNormsSource('templates/x/editor.js',
  `a.content.image = await uploadMedia(f);\nconst r = await abrirBuscadorImagenes({});`).length, 0,
  'CONTRA-PRUEBA: con las DOS puertas, el camino legítimo pasa limpio');
assert.strictEqual(scanNormsSource('views/vsView.js', `const data = await uploadMedia(file, {});`).length, 0,
  'y el avatar del duelo está exento CON motivo: es la cara de una persona, no contenido (R7)');
// chrome-boton: UNA gramática de botón en el panel. Nació de una captura del
// dueño — «Crear actividad» con `btn btn-primary` salía en azul de Bootstrap,
// esquina afilada y otra altura, dentro de la barra crema/naranja del panel.
assert.strictEqual(scanNormsSource('views/home.js',
  `<a href="#/new" class="btn btn-sm btn-primary">Nueva</a>`).length, 1,
  'caza el botón de Bootstrap en una vista de chrome ya migrada');
assert.strictEqual(scanNormsSource('views/home.js',
  `<a href="#/new" class="btn-primary-solid">Nueva</a>`).length, 0,
  'CONTRA-PRUEBA: con la familia del panel, el camino legítimo pasa limpio');
assert.strictEqual(scanNormsSource('views/adminView.js',
  `<button class="btn btn-sm btn-danger">Borrar todo</button>`).length, 0,
  'y el ratchet NO tumba lo que aún no se ha migrado: el admin usa btn-danger, y la familia del panel todavía no tiene esa variante');
assert.strictEqual(scanNormsSource('views/hostLive.js',
  `<button class="btn btn-lg btn-success">Siguiente</button>`).length, 0,
  'CONTRA-PRUEBA: el JUEGO queda fuera — allí manda el skin, no el chrome del panel');
// comilla-en-comentario: un acento grave dentro de un comentario HTML CIERRA la
// plantilla de texto de la vista, el fichero deja de parsearse y la página entera
// muere con «missing ) after argument list» — apuntando al final del fichero, sin
// pista de dónde. Ha pasado TRES veces, siempre al documentar bien: citar código
// con acentos graves es correcto en Markdown y letal dentro de una plantilla.
// No lo caza `node --check` ni ningún test de unidad; solo el navegador, o esto.
assert.strictEqual(scanNormsSource('views/x.js',
  'const html = `<div>' + String.fromCharCode(10) + '  <!-- usa `fields=` para filtrar -->'
  + String.fromCharCode(10) + '</div>`;').length, 1,
  'caza el acento grave dentro de un comentario HTML');
assert.strictEqual(scanNormsSource('views/x.js',
  'const html = `<div>' + String.fromCharCode(10) + '  <!-- usa el parámetro fields para filtrar -->'
  + String.fromCharCode(10) + '</div>`;').length, 0,
  'CONTRA-PRUEBA: comentar el markup SIGUE siendo legal — lo que sobra son las comillas');
// almacen-crudo (ley §21 aplicada al ALMACÉN, gemela de ls-dueno): solo
// core/ls.js habla con localStorage/sessionStorage a pelo. Contra-prueba doble
// (mismo principio que las demás): un fuente sintético FUERA de la lista debe
// fallar, y core/ls.js —que ES la implementación— no.
assert.strictEqual(scanNormsSource('views/x.js', `const v = localStorage.getItem(k);`).length, 1,
  'caza el acceso directo a localStorage fuera de core/ls.js');
assert.strictEqual(scanNormsSource('views/x.js', `sessionStorage.setItem(k, v);`).length, 1,
  'y a sessionStorage');
assert.strictEqual(scanNormsSource('views/x.js', `const s = globalThis.localStorage?.getItem(k);`).length, 1,
  'y el acceso indirecto vía globalThis');
assert.strictEqual(scanNormsSource('core/ls.js', `localStorage.setItem(k, v);\nsessionStorage.getItem(k);`).length, 0,
  'core/ls.js ES la implementación');
assert.strictEqual(scanNormsSource('adapters/local/remoteStore.js', `const kv = globalThis.localStorage;`).length, 0,
  'CONTRA-PRUEBA: el KV inyectable de los drivers offline está declarado en ALLOW_ALMACEN_CRUDO con su motivo');
assert.strictEqual(scanNormsSource('qa/hoja.js', `localStorage.setItem(KEY, v);`).length, 0,
  'y el arnés de pruebas manual, que no es producto');

ok('el escáner caza cada norma (pb-dueno · ls-dueno · almacen-crudo · fallo-mudo · confianza-alumno · reloj-primitivo · reloj-sala · id-rid · imagen-buscable · chrome-boton · comilla-en-comentario) y respeta comentarios + allowlist');

console.log(`\nnorms.test: ${passed} checks passed`);
