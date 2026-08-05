// Tests for pure routing (core/routing.js). Run: node tests/routing.test.mjs
import assert from 'node:assert';
import { compileRoute, matchRoute, parseQuery } from '../core/routing.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Build a routes table like the real app registers (order matters).
const R = (pattern, handler) => ({ ...compileRoute(pattern), handler });
const routes = [
  R('#/', () => 'home-root'),
  R('#/home', () => 'home'),
  R('#/edit/:id', (p) => `edit:${p.id}`),
  R('#/play/:id', (p) => `play:${p.id}`),
  R('#/reports/session/:id', (p) => `rsession:${p.id}`),
  R('#/reports/:id', (p) => `report:${p.id}`),
  R('#/task/:id/attempts', (p) => `attempts:${p.id}`),
];

function run(hash) {
  const hit = matchRoute(hash, routes);
  return hit ? hit.handler(hit.params) : null;
}

assert.strictEqual(run('#/home'), 'home');
assert.strictEqual(run('#/edit/abc'), 'edit:abc', 'captures :id param');
assert.strictEqual(run('#/edit/abc/'), 'edit:abc', 'trailing slash optional');
ok('matches static and single-param routes (trailing slash optional)');

// param values are decoded
assert.strictEqual(run('#/play/a%20b'), 'play:a b', 'decodeURIComponent on params');
ok('URL-decodes captured params');

// :id is a single segment — does NOT swallow slashes, so more specific routes win
assert.strictEqual(run('#/reports/session/x'), 'rsession:x', 'specific multi-segment route wins');
assert.strictEqual(run('#/reports/x'), 'report:x', 'single-segment report route');
assert.strictEqual(run('#/task/7/attempts'), 'attempts:7', 'param between static segments');
ok('single-segment params keep specific routes reachable (no slash swallowing)');

// empty hash falls back to '#/'
assert.strictEqual(run(''), 'home-root', "empty hash → '#/'");
assert.strictEqual(matchRoute('#/nope/nope', routes), null, 'no match → null (caller shows notFound)');
ok("empty hash defaults to '#/'; unknown route returns null");

// first registration wins on overlap
const dup = [R('#/x', () => 'first'), R('#/x', () => 'second')];
assert.strictEqual(matchRoute('#/x', dup).handler(), 'first', 'first registered route wins');
ok('registration order is respected (first match wins)');

// ── CONSULTA EN EL HASH (`?q=…`) ────────────────────────────────────────────
// El buscador de la portada navegaba a `#/explore?q=comas` desde el primer día
// (commit de la biblioteca pública) y el router NUNCA soportó la `?`: el patrón
// compilado es `^#?#/explore/?$`, así que ese enlace —generado por la propia
// app— no casaba con ninguna ruta y el profe acababa en "Ruta no encontrada" al
// buscar. Verificado en navegador antes de arreglarlo.
{
  const routes = [
    { ...compileRoute('#/explore'), handler: () => 'explore' },
    { ...compileRoute('#/edit/:id'), handler: () => 'edit' },
  ];
  const hit = matchRoute('#/explore?q=comas', routes);
  assert.ok(hit, 'una ruta con consulta DEBE casar: el `?` no es parte del camino');
  assert.strictEqual(hit.handler(), 'explore');
  assert.deepStrictEqual(hit.query, { q: 'comas' });
  ok('`#/explore?q=comas` casa con `#/explore` y entrega el término (el bug de la portada)');

  // Y la consulta convive con los parámetros de camino.
  const h2 = matchRoute('#/edit/abc123?tab=contenido&foco=1', routes);
  assert.deepStrictEqual(h2.params, { id: 'abc123' }, 'el :id no se lleva la consulta pegada');
  assert.deepStrictEqual(h2.query, { tab: 'contenido', foco: '1' });
  ok('camino y consulta no se pisan: `#/edit/abc123?tab=…` da id limpio + query');
}

// ── parseQuery: lo que llega de una URL nunca es de fiar ────────────────────
{
  assert.deepStrictEqual(parseQuery('#/explore'), {}, 'sin `?` → objeto vacío, no null');
  assert.deepStrictEqual(parseQuery('#/explore?'), {});
  assert.deepStrictEqual(parseQuery('#/x?q=puntos+notables'), { q: 'puntos notables' }, '+ es espacio');
  assert.deepStrictEqual(parseQuery('#/x?q=matem%C3%A1ticas'), { q: 'matemáticas' }, 'acentos');
  assert.deepStrictEqual(parseQuery('#/x?solo&q=1'), { solo: '', q: '1' }, 'clave sin valor');
  assert.doesNotThrow(() => parseQuery('#/x?q=%E0%A4%A'), 'un % suelto no puede tumbar el enrutado');
  ok('parseQuery aguanta lo que llega de una URL escrita a mano (+, acentos, % roto)');
}

// ── CONTRA-PRUEBA: la consulta no abre rutas que no existen ────────────────
// El arreglo no puede convertirse en "todo casa": `#/nada?q=x` sigue siendo 404.
{
  const routes = [{ ...compileRoute('#/explore'), handler: () => 'explore' }];
  assert.strictEqual(matchRoute('#/nada?q=x', routes), null,
    'una ruta inexistente sigue sin casar aunque lleve consulta');
  assert.strictEqual(matchRoute('#/explore/otro?q=x', routes), null,
    'y el camino se sigue comparando entero');
  ok('CONTRA-PRUEBA: la consulta no convierte cualquier hash en una ruta válida');
}

console.log(`\nrouting.test: ${passed} checks passed`);
