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

// Las 4 vistas de listado usan el componente compartido.
const VIEWS = ['views/home.js', 'views/landing.js', 'views/explore.js', 'views/author.js'];
for (const v of VIEWS) {
  const src = read(v);
  assert.match(src, /from '\.\.\/core\/activityCard\.js'/, `${v} debe importar activityCardHtml`);
  assert.match(src, /activityCardHtml\(/, `${v} debe pintar con activityCardHtml`);
}
ok('las 4 vistas de listado importan y usan activityCardHtml');

// Explorar ya NO usa tarjetas Bootstrap (era la vista "horrible").
const explore = read('views/explore.js');
assert.ok(!/card h-100/.test(explore), 'explore.js no debe usar `card h-100` (Bootstrap)');
assert.ok(!/col-md-\d+ col-lg-\d+/.test(explore), 'explore.js no debe maquetar con la rejilla col-md/col-lg');
assert.match(explore, /class="home-grid"/, 'explore.js debe usar la rejilla compartida .home-grid');
ok('Explorar migrada a .acard + .home-grid (sin Bootstrap card)');

// El componente expone lo esperado y la tira de modos comparte las clases que
// esperan los handlers de las vistas (act-play/act-vs/act-teams).
const card = read('core/activityCard.js');
assert.match(card, /export function activityCardHtml/, 'activityCardHtml exportada');
assert.match(card, /export function modeStripHtml/, 'modeStripHtml exportada');
for (const cls of ['act-play', 'act-vs', 'act-teams', 'act-pin', 'act-task']) {
  assert.ok(card.includes(cls), `la tira de modos define ${cls}`);
}
ok('activityCard.js expone el componente y la tira de modos con clases compartidas');

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

  // Lo que cambia entre variantes es lo que SÍ depende de la vista.
  const mine = activityCardHtml(act, { variant: 'mine' });
  const lib  = activityCardHtml(act, { variant: 'library' });
  assert.match(mine, /act-pin|mode-live|act-task/, '"mine" ofrece Live/Tarea: la actividad es tuya');
  assert.ok(!/act-pin|act-task/.test(lib), '"library" no ofrece gestionar lo de otro');
  assert.match(lib, /data-play=/, '"library" juega desde el preview');
  assert.match(lib, /por Ana|Ana/, '"library" acredita al autor');
  ok('y lo que cambia es lo que DEBE cambiar: gestionar lo tuyo vs jugar lo de otro');

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
  ok('las 4 vistas declaran variante y ninguna apaga un campo informativo');
}

console.log(`\nactivityCard.test: ${n} checks passed`);
