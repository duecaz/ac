// LA FRONTERA DEL SKIN — un tema RECOLOREA, no reforma (§3 · §0).
//
// Por qué existe (dueño, 2026-08-21): «el sistema de nombres es para que los
// skins puedan identificar pocas partes y ser más transparentes». Hoy no lo es:
// `arcade` y `tv-show` nacieron ANTES de la ley de tokens y llegan con
// selectores como
//     .vs-skin-tv-show .vs-panel.vs-left .vs-body .ww-keypad-q { background: … }
// — el tema metiendo la mano hasta la chapa del enunciado de Operaciones, a
// cuatro niveles de profundidad. Cada arreglo de esta semana (columnas,
// contraste, marcos) fue pelearse con una de esas reglas.
//
// Ya hay una ley que vigila que un tema no MIDA (tests/temaSinMedidas.test.mjs).
// Esta vigila lo otro: que no PINTE dentro de la anatomía de una plantilla.
// La vía legítima existe y está probada: los tokens se pueden redefinir POR
// CONTENEDOR, que es lo que resuelve el azul/rojo por lado sin conocer el DOM:
//     .vs-skin-tv-show .vs-left  { --key-bg: linear-gradient(…); }
// Donde falte un gancho, se AÑADE el token a la plantilla con su fallback:
// ampliar el vocabulario público es legal; abrir la anatomía, no.
//
// RATCHET, no big-bang: las reglas invasoras de HOY quedan congeladas con su
// número. No puede entrar una nueva, y el número solo baja — cada tanda de la
// migración lo baja y actualiza el tope. Migrar 470 líneas de identidad visual
// de un tirón, sin valla y sin capturas, es como se rompió la barra del
// marcador (256k píxeles de diferencia).
//
// LÍMITE DECLARADO: la anatomía se reconoce por NOMBRE DE CLASE, así que un
// tema que escriba `.vs-body > *` o `.vs-body :is(button, input)` invade sin
// que este barrido lo cuente. No se cierra hoy porque la heurística que haría
// falta («desciende de un contenedor de plantilla y pinta») da falsos positivos
// sobre el chrome propio del tema, que sí usa `> *`. Queda dicho aquí en vez de
// ser un agujero silencioso, y se revisa al cerrar la migración (TANDA 4).
//
// Run: node tests/temaPorTokens.test.mjs
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { reglas, clasesDe, sujetoDe, selectoresDe } from './helpers/css.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── QUÉ ES «ANATOMÍA DE PLANTILLA», por DESCUBRIMIENTO ──────────────────────
// No una lista de prefijos a mano (envejece y deja fuera la plantilla nueva).
// Se declara lo contrario —las hojas de CHROME, que son pocas y estables— y
// TODO lo demás en styles/ es anatomía de juego. Así una plantilla nueva nace
// protegida sin que nadie se acuerde de apuntarla.
// OJO: esta partición es la MISMA pregunta que el `EXCLUDED` de
// tests/styles.test.mjs («¿esta hoja es el juego?»), y no puede contradecirla.
// Aquí son sus nueve entradas MÁS `vs`/`teams`, que son la arena del duelo y de
// eso el tema SÍ es dueño. `live.css` estuvo un rato en esta lista y era un
// agujero: dentro vive `.ww-opt-grid` —las opciones que lee la clase—, así
// que un tema habría podido pintarlas sin subir el ratchet. Es la misma lección
// que ya está escrita en styles.test.mjs: una lista de exclusiones es una lista
// de sitios donde la ley no mira.
const CHROME = {
  'home.css':        'la barra y «Mis actividades»: chrome del profe, no juego',
  'editor.css':      'el editor es un formulario, no el juego',
  'teams.css':       'el montaje de equipos',
  'vs.css':          'la arena del duelo: marcador, escenario, paneles — de esto SÍ es dueño el tema',
  'backgrounds.css': 'las texturas de fondo (otro eje)',
  'theme.css':       'los tokens base',
  'skins.css':       'el selector de temas',
  'touch.css':       'afinado táctil',
  'soloAnim.css':    'la animación de progreso',
  'player.css':      'el marco y el HUD: superposición de plataforma, con su velo neutro',
  'scaffold.css':    'el andamio de regiones (maquetación pura: ya lo vigila temaSinMedidas)',
};

const clasesDeHoja = (css) => new Set(clasesDe(css.replace(/\/\*[\s\S]*?\*\//g, '')));

const HOJAS_DE_JUEGO = readdirSync(join(ROOT, 'styles'))
  .filter(f => f.endsWith('.css') && !CHROME[f]);
// LA ANATOMÍA SON LAS CLASES QUE LA PLANTILLA PINTA, no las que menciona.
// Antes valía con que la clase apareciera en cualquier sitio de la hoja, y eso
// metía en el saco a clases de PLATAFORMA que las plantillas solo usan como
// ancestro para acotarse: `.ww-player-frame …` (styles/live.css) o `.ww-lite …`
// (styles/globos.css). Resultado: el tema pintando SU PROPIO marco
// (`.ww-player-frame.skin-tv-show`, que es justo donde `applySkin()` cuelga la
// clase) contaba como invadir una plantilla. Se mira el SUJETO de cada regla —
// la parte que recibe la pintura—, que es exactamente la misma pregunta que le
// hacemos a los temas. Una ley que se mide a sí misma con otra vara no vale.
const anatomia = new Set();
for (const f of HOJAS_DE_JUEGO) {
  const css = readFileSync(join(ROOT, 'styles', f), 'utf8');
  for (const r of reglas(css)) {
    for (const sel of selectoresDe(r.selector)) {
      for (const c of clasesDe(sujetoDe(sel))) anatomia.add(c);
    }
  }
}
assert.ok(anatomia.size > 50, `se esperaba descubrir la anatomía de las plantillas, hay ${anatomia.size} clases`);
ok(`anatomía descubierta: ${anatomia.size} clases de juego en ${HOJAS_DE_JUEGO.length} hojas de plantilla (las de chrome se declaran aparte, con motivo)`);

// ── LAS REGLAS DE CADA TEMA ─────────────────────────────────────────────────

/** ¿Esta regla pinta DENTRO de una plantilla? UN solo sitio lo decide: estaba
 *  escrito tres veces (escaneo + las dos contra-pruebas) y con eso la
 *  contra-prueba podía acabar validando un criterio distinto del vigilado. */

/** ¿Esta regla pinta DENTRO de una plantilla? UN solo sitio lo decide: estaba
 *  escrito tres veces (escaneo + las dos contra-pruebas) y con eso la
 *  contra-prueba podía acabar validando un criterio distinto del vigilado.
 *
 *  MIRA EL SUJETO, NO EL SELECTOR ENTERO (afinado 2026-08-25). Antes bastaba con
 *  que CUALQUIER parte del selector nombrara una clase de plantilla, y eso contaba
 *  como deuda cosas que no lo son: `.ww-lite .vs-arena.vs-skin-arcade::before`
 *  pinta la MARQUESINA del tema (chrome suyo) y solo mencionaba `ww-lite` —una
 *  clase que aparece en `globos.css`— como ancestro. Igual
 *  `.ww-player-frame.skin-tv-show .card`, que pinta una tarjeta del marco.
 *  Siete de las veinticuatro «invasiones» eran esto: ruido que hacía el ratchet
 *  menos creíble, y un ratchet en el que no se confía deja de frenar.
 *  Un tema puede ESCUCHAR por un ancestro; lo que no puede es PINTAR la pieza.
 *
 *  Y SI EL SUJETO LLEVA LA CLASE DEL PROPIO TEMA Y NINGUNA DE PLANTILLA, tampoco
 *  invade: es la SUPERFICIE donde el tema está montado
 *  (`.ww-player-frame.skin-tv-show` = el fondo de estudio sobre su propio marco).
 *  Pintar donde te han puesto no es meter la mano dentro de una plantilla.
 *
 *  LO DE «Y NINGUNA DE PLANTILLA» NO ES ADORNO. La primera versión eximía a
 *  cualquier sujeto cuyo texto contuviera `skin-`, y con eso
 *  `.ww-key.skin-arcade { background: red }` pasaba el ratchet: bastaba pegarle
 *  al selector la clase del propio tema para desaparecer del recuento. Hoy no
 *  hay ningún elemento de plantilla que lleve clase de tema —`applySkin()` la
 *  pone en el body, el marco o la arena, que son chrome— pero eso es una
 *  casualidad de los cinco sitios que llaman, no una regla escrita. Un número
 *  que se puede maquillar no vigila (lo dice este mismo fichero doce líneas más
 *  arriba, sobre contar por selector suelto). */
const esTema = (c) => /^(vs-)?skin-/.test(c);
const esRelevante = (c) => anatomia.has(c) || esTema(c);

// DÓNDE SE MONTA UN TEMA. `applySkin(nombre, destino)` cuelga la clase en un
// puñado de sitios y solo en esos: el `body`, el marco del juego
// (`core/gameFrame.js`, `views/playerView.js`), la arena del duelo y la previsión
// del editor (`core/editorShell.js`). Pintar AHÍ es pintar la superficie que te
// han dado; pintar cualquier otra cosa que lleve la clase pegada, no.
// Es una lista DECLARADA a propósito, con su origen escrito: la alternativa —
// «cualquier sujeto que mencione `skin-`»— dejaba pasar
// `.ww-key.skin-arcade { background: red }`, que es colarse pegándole al
// selector la clase del propio tema.
const SUPERFICIES = ['ww-player-frame', 'vs-arena', 'ww-play-page'];

const esInvasora = (r) => {
  if (!r.props.some(p => !p.startsWith('--'))) return false;   // solo tokens: vía legítima
  const sujeto = sujetoDe(r.selector, esRelevante);
  const cls = clasesDe(sujeto);
  const enSuSuperficie = cls.some(esTema) &&
    (/^body\b/.test(sujeto) || cls.some(c => SUPERFICIES.includes(c)));
  if (enSuSuperficie) return false;
  return cls.some(c => anatomia.has(c));
};

const invasoras = {};
const temas = readdirSync(join(ROOT, 'themes'), { withFileTypes: true })
  .filter(e => e.isDirectory()).map(e => e.name);
for (const tema of temas) {
  const ruta = join(ROOT, 'themes', tema, 'skin.css');
  let css; try { css = readFileSync(ruta, 'utf8'); } catch { continue; }
  invasoras[tema] = [];
  for (const r of reglas(css)) {
    const pintadas = r.props.filter(p => !p.startsWith('--'));
    if (!pintadas.length) continue;                       // solo tokens: la vía legítima
    // Se cuenta por SELECTOR SUELTO, no por regla: con `a, b, c { … }` seis
    // invasiones se disfrazan de una y el tope bajaría cinco puntos sin haber
    // migrado nada — el ratchet dejaría entrar cinco gratis en la tanda
    // siguiente. Un número que se puede maquillar no vigila.
    for (const sel of selectoresDe(r.selector)) {
      if (esInvasora({ selector: sel, props: r.props })) invasoras[tema].push({ sel, props: pintadas });
    }
  }
}

// ── EL RATCHET ──────────────────────────────────────────────────────────────
// La deuda de HOY, congelada. Cada tanda de la migración baja estos números y
// los actualiza aquí; el test falla si SUBEN (una regla invasora nueva) y
// también si BAJAN sin actualizar el tope (para que el ratchet no se quede
// mintiendo hacia arriba y deje entrar reglas gratis).
const TOPE = {
  // TANDA 2 (v1.51.573) bajó tv-show de 28 a 7: todo Operaciones migrado a tokens.
  // TANDA 3 (v1.51.588) deja ARCADE EN CERO: su calculadora entera pasó a tokens
  // (11 reglas → declaraciones, incluida la tipografía por `--math-font` y el
  // rótulo «SOLVE!» por `--math-q-rotulo`), y se borraron 5 reglas MUERTAS que
  // pintaban `.vs-body .ww-opt`/`.ww-shape-N`, clases que en el duelo no existen.
  // Verificado con `node tools/shots.mjs`: 24/24 capturas idénticas.
  // Lo que queda en tv-show son las OPCIONES de Quiz (4 selectores), y el motivo
  // de aplazarlas es más hondo de lo que parecía: la opción NO TIENE UNA REGLA
  // DUEÑA. Se pinta en cinco sitios bajo dos nombres — `.ww-opt`
  // (styles/player.css, styles/quiz.css) y `.ww-opt-grid .btn` (styles/live.css,
  // styles/vs.css, styles/player.css) —, y encima player.css está en la lista
  // CHROME de aquí arriba: media pieza es anatomía y media no, así que este mismo
  // test la clasifica de forma incoherente. Sin regla dueña, ningún token puede
  // tener un respaldo con sentido. La TANDA 4 es consolidarla igual que
  // `styles/math.css` hizo con el teclado, no perseguir cuatro selectores.
  'tv-show': 4,
  'arcade':  0,   // ← nace limpio a partir de aquí: cualquier regla nueva rompe CI
};
const filas = temas.map(t => ({ tema: t, n: (invasoras[t] || []).length, tope: TOPE[t] }));
console.log('\n  reglas de tema que PINTAN dentro de la anatomía de una plantilla:');
for (const f of filas) console.log(`    ${f.tema.padEnd(9)} ${String(f.n).padStart(3)}  (tope ${f.tope ?? '0 — tema nuevo, nace limpio'})`);

const subidas = filas.filter(f => f.n > (f.tope ?? 0));
assert.deepStrictEqual(subidas.map(f => `${f.tema}: ${f.n} > tope ${f.tope ?? 0}`), [],
  'un tema pinta DENTRO de una plantilla más que antes.\n'
  + 'La vía es el TOKEN (se puede redefinir por contenedor: `.vs-skin-x .vs-left { --key-bg: … }`);\n'
  + 'si falta el gancho, se añade a la plantilla con fallback.\n'
  + subidas.flatMap(f => (invasoras[f.tema] || []).slice(0, 6)
      .map(r => `  ${f.tema}: ${r.sel.slice(0, 70)} → ${r.props.join(', ')}`)).join('\n'));
ok('ningún tema pinta dentro de una plantilla MÁS que la deuda congelada (ratchet)');

const bajadas = filas.filter(f => f.tope != null && f.n < f.tope);
assert.deepStrictEqual(bajadas.map(f => `${f.tema}: ${f.n} < tope ${f.tope}`), [],
  'la deuda BAJÓ (bien) pero el tope quedó viejo: bájalo en TOPE para que el trecho ganado no se pueda perder');
ok('el tope refleja la deuda real de hoy (un ratchet suelto deja entrar reglas gratis)');

// ── CONTRA-PRUEBA: la vía legítima pasa, y una invasión nueva NO ────────────
// Sin esto el test podría estar prohibiéndolo todo —incluido lo correcto— y
// nadie lo notaría hasta intentar escribir un tema.
{
  const anatomico = 'ww-key';
  assert.ok(anatomia.has(anatomico), 'la anatomía debe incluir .ww-key (la tecla de Operaciones)');
  const legitimas = reglas(`
    .vs-skin-x .vs-left { --key-bg: red; --key-fg: white; }
    .vs-skin-x .vss-bar { height: 46px; background: navy; }
    .vs-skin-x .${anatomico} { --algo: 2px; }
    .ww-lite .vs-arena.vs-skin-x::before { animation: none; }
    .ww-player-frame.skin-x { background: navy; }
    .ww-player-frame.skin-x .card { background: navy; }
    body.skin-x { background: navy; }
  `);
  for (const r of legitimas) {
    assert.ok(!esInvasora(r), `esta regla es legítima y el test la acusa: ${r.selector}`);
  }
  // Y las tres formas de invadir que SÍ tienen que caer.
  for (const invasora of [
    `.vs-skin-x .${anatomico} { background: red; }`,
    `.skin-x .${anatomico}:hover { transform: none; }`,
    `.ww-player-frame.skin-x .${anatomico} { color: red; }`,
    `.vs-skin-x .${anatomico} i { color: red; }`,
    `.${anatomico}.skin-x { background: red; }`,
    `.skin-x .${anatomico} span.brillo { color: red; }`,
  ]) {
    assert.ok(esInvasora(reglas(invasora)[0]), `el test debe cazar esta invasión: ${invasora}`);
  }
  ok(`CONTRA-PRUEBA: escuchar por un ancestro y pintar la propia superficie pasan; pintar «.${anatomico}» se caza (6 formas: icono interior, y colarse pegándole la clase del tema al sujeto)`);
}

console.log(`\ntemaPorTokens.test: ${passed} checks passed`);
