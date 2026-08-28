// Guardarraíl: la tarjeta de actividad es ÚNICA (core/activityCard.js). TODA vista
// que lista actividades (Mis actividades, Portada, Explorar, Perfil) debe pintar con
// `activityCardHtml` — prohibido volver a escribir markup de tarjeta a mano. Antes
// había 4 renderizadores divergentes: home/landing con un diseño, author sin la tira
// de modos, y explore con tarjetas Bootstrap (`card h-100`) que se veían "horribles".
// Este test impide que vuelva a divergir. Si es norma, es test.
//
// Run: node tests/activityCard.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
let n = 0;
const ok = (m) => { console.log('  ✓', m); n++; };

// ── DESCUBRIMIENTO, no enumeración ──────────────────────────────────────────
// Este guardarraíl era una LISTA de vistas ("estas 4 usan el componente") y por
// eso NO cazó a views/juegos.js cuando nació pintando tarjeta propia (la "gota"
// que reportó el usuario, v1.51.387): una vista nueva no estaba en la lista,
// así que nacía fuera de la ley sin que nadie lo dijera. Una lista enumerada
// vigila el pasado; la norma es sobre el futuro. Ahora el test ESCANEA views/
// entero: quien escriba markup de tarjeta a mano aparece aquí, exista hoy o se
// cree mañana.
import { readdirSync } from 'node:fs';

// Tarjetas escritas A MANO fuera del componente, con su motivo (ratchet: esta
// lista solo puede ENCOGER, y cada entrada dice por qué existe).
const EXCEPCIONES_ACARD = {
  // (vacío — la última excepción, listCard de home.js, se absorbió como
  // variante 'list' del componente en v1.51.392. Si necesitas añadir una,
  // declara el MOTIVO y la deuda; el ratchet solo debe ENCOGER.)
};

/** Vistas con `<article class="acard…` escrito a mano (no vía el componente). */
export function tarjetasAMano(files) {
  return files.filter(([, src]) => /<article class="acard/.test(src));
}

const ALL_VIEWS = readdirSync(join(ROOT, 'views')).filter(f => f.endsWith('.js')).map(f => `views/${f}`);
const fuentes = ALL_VIEWS.map(v => [v, read(v)]);

{
  const aMano = tarjetasAMano(fuentes).map(([v]) => v);
  const sinPermiso = aMano.filter(v => !EXCEPCIONES_ACARD[v]);
  assert.deepStrictEqual(sinPermiso, [],
    `TARJETA ESCRITA A MANO fuera de core/activityCard.js:\n  ${sinPermiso.join('\n  ')}\n`
    + '  La tarjeta es ÚNICA: usa activityCardHtml con su variante. Si de verdad es\n'
    + '  otro objeto, decláralo en EXCEPCIONES_ACARD con su motivo.');
  const muertas = Object.keys(EXCEPCIONES_ACARD).filter(v => !aMano.includes(v));
  assert.deepStrictEqual(muertas, [], `excepciones muertas (ya no hay tarjeta a mano ahí): ${muertas.join(', ')}`);
  ok(`escaneadas ${ALL_VIEWS.length} vistas: 0 tarjetas a mano sin declarar (${aMano.length} excepción con motivo)`);
}

// Las vistas que usan el componente se DESCUBREN igual (y no pueden bajar de 5:
// si una migra fuera del componente en silencio, este número lo dice).
const VIEWS = fuentes.filter(([, src]) => /activityCardHtml\(/.test(src)).map(([v]) => v);
assert.ok(VIEWS.length >= 5, `solo ${VIEWS.length} vistas usan activityCardHtml (antes 5+): ¿alguna volvió al markup a mano?`);
ok(`${VIEWS.length} vistas usan el componente (descubiertas escaneando, no listadas): ${VIEWS.join(' · ')}`);

// CONTRA-PRUEBA del escáner: una vista nueva con tarjeta a mano NO pasaría.
{
  const falsa = ['views/__nueva.js', '<div><article class="acard"><h3>a mano</h3></article></div>'];
  assert.deepStrictEqual(tarjetasAMano([falsa]).map(([v]) => v), ['views/__nueva.js'],
    'el escáner debe cazar una vista nueva con markup de tarjeta propio');
  ok('CONTRA-PRUEBA: una vista futura con tarjeta a mano rompe CI (el agujero de juegos.js, cerrado)');
}

// Explorar ya NO usa tarjetas Bootstrap (era la vista "horrible").
const explore = read('views/explore.js');
assert.ok(!/card h-100/.test(explore), 'explore.js no debe usar `card h-100` (Bootstrap)');
assert.ok(!/col-md-\d+ col-lg-\d+/.test(explore), 'explore.js no debe maquetar con la rejilla col-md/col-lg');
assert.match(explore, /class="home-grid"/, 'explore.js debe usar la rejilla compartida .home-grid');
ok('Explorar migrada a .acard + .home-grid (sin Bootstrap card)');

// El componente expone lo esperado y la tira de modos comparte las clases que
// esperan los handlers de la tarjeta (act-play/act-vs/act-teams/act-pin/act-task).
// EJECUTÁNDOLO, no leyendo el fichero: esto eran tres citas de fuente y la tira
// se puede PINTAR, que es la prueba de verdad — un `act-vs` dentro de un
// comentario habría pasado el escaneo igual de bien.
{
  const { activityCardHtml, modeStripHtml } = await import('../core/activityCard.js');
  await import('../core/registerTemplates.js');
  assert.strictEqual(typeof activityCardHtml, 'function', 'activityCardHtml exportada');
  assert.strictEqual(typeof modeStripHtml, 'function', 'modeStripHtml exportada');
  const tira = modeStripHtml(
    { id: 'x', template: 'quiz', content: { items: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }] } },
    { includeManage: true });
  for (const cls of ['act-play', 'act-vs', 'act-teams', 'act-pin', 'act-task']) {
    assert.ok(tira.includes(cls), `la tira de modos no pinta ${cls}`);
  }
  ok('la tira PINTADA lleva las cinco clases que esperan los handlers (medido, no citado)');
}

// ── LA CONFIGURACIÓN TAMBIÉN ES DUPLICACIÓN ─────────────────────────────────
// El markup era único desde la unificación… pero CADA VISTA decidía con
// banderitas sueltas qué enseñaba, y divergieron sin que nadie lo viera: el
// badge de páginas solo lo pedía "Mis actividades" (el profe preguntó por qué no
// salía en la portada), y el subtítulo y las etiquetas faltaban en la portada y
// en el perfil. Unificar el markup no sirve si "qué muestra una tarjeta" se
// decide en cuatro sitios. Ahora se decide en el componente, por VARIANTE.
{
  const { activityCardHtml } = await import('../core/activityCard.js');
  await import('../core/registerTemplates.js');
  const act = {
    id: 'a1', title: 'Puntos notables', subtitle: 'Triángulos', template: 'quiz',
    tags: ['geometría'], author: { id: 'u1', name: 'Ana' },
    content: { items: [{ id: '1' }, { id: '2' }, { id: '3' }] },
  };

  for (const variant of ['mine', 'library']) {
    const html = activityCardHtml(act, { variant });
    assert.match(html, /acard-pages/, `${variant}: falta el badge de nº de páginas`);
    assert.match(html, /Triángulos/, `${variant}: falta el subtítulo`);
    assert.match(html, /geometría/, `${variant}: faltan las etiquetas`);
  }
  ok('las variantes `mine` y `library` enseñan LO MISMO de la actividad (páginas · subtítulo · etiquetas)');

  // LOS CINCO MODOS SALEN EN LAS DOS VARIANTES (v1.51.621). Live/Tarea estaban
  // reservados a "Mis actividades" y el motivo escrito era falso: `#/launch` y
  // `#/tasks` resuelven la actividad en la nube, así que dirigir en clase algo de
  // la biblioteca funciona — y esconder el modo dejaba sin enterarse de que
  // existe justo a quien todavía no tiene cuenta.
  const mine = activityCardHtml(act, { variant: 'mine' });
  const lib  = activityCardHtml(act, { variant: 'library' });
  for (const [nombre, html] of [['mine', mine], ['library', lib]]) {
    assert.match(html, /act-pin/, `${nombre}: falta el modo En vivo`);
    assert.match(html, /act-task/, `${nombre}: falta el modo Tarea`);
  }
  assert.match(lib, /data-play=/, '"library" juega desde el preview');
  assert.match(lib, /por Ana|Ana/, '"library" acredita al autor');
  ok('los cinco modos salen en las dos variantes: la tarjeta no esconde lo que la app sabe hacer');

  // …y lo que gatea el modo de profe es la SESIÓN, con candado y frase (§22),
  // no la variante. Sin `authed`, Live/Tarea siguen ahí y dicen por qué.
  {
    const sinSesion = activityCardHtml(act, { variant: 'library', authed: false });
    assert.match(sinSesion, /act-pin[^>]*is-locked/, 'sin sesión, En vivo sale CON candado (no escondido)');
    assert.match(sinSesion, /data-locked="1"/, 'y marcado, para que el clic explique en vez de rebotar');
    // CONTRA-PRUEBA: los modos JUGABLES nunca se bloquean — el alumno no tiene cuenta.
    assert.ok(!/act-play[^>]*is-locked/.test(sinSesion), 'CONTRA-PRUEBA: Individual jamás lleva candado');
    ok('el candado lo pone la SESIÓN, no la variante (y Individual nunca se bloquea)');
  }

  // QUÉ MODOS OFRECE cada actividad lo declara SU PLANTILLA, y la tarjeta no
  // puede tener una segunda opinión. Aquí hubo un `!esJuego` que dejaba a Ordena
  // las Pelotas —el bucle `board` del modo en vivo (§26), el único que lo
  // declara— sin botón de En vivo hasta en "Mis actividades". Se comprueba
  // DESCUBRIENDO: para cada plantilla registrada, la tira ofrece exactamente lo
  // que su meta declara.
  {
    const { listTemplates } = await import('../core/registry.js');
    const desajustes = [];
    for (const T of listTemplates()) {
      const h = activityCardHtml({ id: 'x', title: T.meta.label, template: T.meta.name, content: {} },
        { variant: 'library' });
      if (/act-pin/.test(h) !== !!T.meta.modes?.live)  desajustes.push(`${T.meta.name}: En vivo`);
      if (/act-task/.test(h) !== !!T.meta.modes?.async) desajustes.push(`${T.meta.name}: Tarea`);
    }
    assert.deepStrictEqual(desajustes, [],
      `la tarjeta ofrece modos que la plantilla no declara (o esconde los que sí): ${desajustes.join(' · ')}`);
    // Y el caso concreto que se rompió: un JUEGO con live declarado LO ofrece,
    // y su Tarea la niega la plantilla (async:false), no la tarjeta.
    const juegos = listTemplates().filter(T => T?.meta?.kind === 'juego' && T.meta.modes?.live);
    assert.ok(juegos.length, 'debería haber un juego con modo en vivo (el bucle `board`, §26)');
    ok(`las ${listTemplates().length} plantillas ofrecen en la tarjeta EXACTAMENTE los modos que declaran (incl. ${juegos.length} juego con En vivo)`);
  }

  // El badge cuenta PÁGINAS, no elementos (corrección de v1.51.184): Emparejar
  // son 4 pares en UNA pantalla. Volver a contar ítems aquí sería reabrir ese bug.
  const match4 = { id: 'm', title: 'Pares', template: 'match', content: { pairs: [1, 2, 3, 4] } };
  assert.match(activityCardHtml(match4, { variant: 'library' }), /acard-pages[^>]*title="1 página"/,
    'Emparejar: 4 pares → UNA página (no 4)');
  ok('el badge sigue contando páginas y no elementos (no se reabre el bug de v1.51.184)');
}

// ── NINGUNA VISTA APAGA LOS CAMPOS INFORMATIVOS ─────────────────────────────
// Ratchet: si una vista vuelve a decidir por su cuenta, CI lo dice. Se permite
// sobrescribir (hay casos legítimos), pero no en silencio y no apagando.
{
  for (const v of VIEWS) {
    const src = read(v);
    const llamada = src.match(/activityCardHtml\(a,[\s\S]{0,320}?\}\s*\)/);
    assert.ok(llamada, `${v}: no se encontró la llamada a activityCardHtml`);
    assert.match(llamada[0], /variant:\s*'(mine|library|plain)'/,
      `${v} debe declarar su VARIANTE en vez de una lista de banderitas`);
    assert.ok(!/(pages|subtitle|tags|author):\s*false/.test(llamada[0]),
      `${v} apaga un campo informativo — eso es lo que hizo divergir las tarjetas`);
  }
  ok('las 5 vistas declaran variante y ninguna apaga un campo informativo');
}

// ── Y SUS CLICS TAMBIÉN TIENEN UN DUEÑO (§21b) ──────────────────────────────
// El markup era único y la configuración también; lo que seguía copiado eran las
// cuatro líneas de handlers en cada vista — y por eso Live/Tarea no podían salir
// de "Mis actividades": el botón existiría y no haría nada. Ahora las cablea
// views/activityCardWire.js. Este escaneo caza a la próxima vista que las repita.
{
  const RE_HANDLER = /on\([^,]+,\s*'click',\s*'(\.act-(?:play|vs|teams|pin|task|list)|\[data-play\])'/;
  const culpables = VIEWS.filter(v => RE_HANDLER.test(read(v)));
  assert.deepStrictEqual(culpables, [],
    `estas vistas vuelven a cablear los modos de la tarjeta a mano: ${culpables.join(', ')}\n`
    + '  Llama a wireActivityCard(rootSel) — es el dueño de los clics de la tarjeta.');
  const wire = read('views/activityCardWire.js');
  for (const cls of ['act-play', 'act-vs', 'act-teams', 'act-pin', 'act-task', 'act-list']) {
    assert.ok(wire.includes(cls), `el dueño de los clics no cablea ${cls}`);
  }
  // CONTRA-PRUEBA del escáner: una vista que los repita SÍ se caza.
  assert.ok(RE_HANDLER.test("on(rootSel, 'click', '.act-vs', () => {});"),
    'el escáner debe cazar a una vista futura que recable la tira de modos');
  ok(`${VIEWS.length} vistas y ni una recablea los modos: los clics de la tarjeta tienen un dueño`);
}

console.log(`\nactivityCard.test: ${n} checks passed`);
