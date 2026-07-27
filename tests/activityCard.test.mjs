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

console.log(`\nactivityCard.test: ${n} checks passed`);
