// QUITAR COMENTARIOS SIN TRAGARSE EL FICHERO.
//
// La regex de siempre (`/\/\*[\s\S]*?\*\//`) tomaba un `/*` dentro de un
// comentario de línea como apertura de bloque y se comía hasta el siguiente
// `*/` del fichero: core/selftest.js quedó invisible para las reglas del
// proyecto desde su línea 4. Esta suite fija el dueño único y, sobre todo,
// la CONTRA-PRUEBA de que ese caso ya no engaña.
// Run: node tests/sinComentarios.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { sinComentarios } from '../core/sinComentarios.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

{
  const src = `const a = 1; // los tests (tests/*.mjs) van aparte\nconst b = lsGet('ww.x');\n/* bloque */ const c = 3;`;
  const out = sinComentarios(src);
  assert.ok(/lsGet\('ww\.x'\)/.test(out), 'la línea SIGUIENTE a un // con /* dentro sigue visible');
  assert.ok(!/bloque/.test(out) && /const c = 3/.test(out), 'el bloque real se quita y lo de después se queda');
  assert.strictEqual(out.split('\n').length, src.split('\n').length, 'mismos saltos de línea');
  assert.strictEqual(out.length, src.length, 'misma longitud: los números de columna no se corren');
  ok('un `/*` dentro de un comentario de línea NO abre un bloque (el caso de core/selftest.js)');
}
{
  const src = `const u = 'https://pb.lanube.uno/api'; const t = \`a // no es comentario\`; const q = "x /* tampoco */ y";`;
  assert.strictEqual(sinComentarios(src), src, 'las cadenas se dejan intactas: un // o /* dentro es texto');
  ok('cadenas, plantillas y URLs intactas');
}
{
  // CONTRA-PRUEBA de verdad, sobre el fichero real: selftest.js tiene código
  // más allá de la línea 4 y ahora se ve.
  const real = sinComentarios(readFileSync(new URL('../core/selftest.js', import.meta.url), 'utf8'));
  const visibles = real.split('\n').slice(10).filter(l => /\S/.test(l)).length;
  assert.ok(visibles > 100, `core/selftest.js debe quedar visible más allá de sus comentarios (líneas con código: ${visibles})`);
  ok('core/selftest.js ya no desaparece al quitar comentarios');
}
console.log(`\nsinComentarios.test: ${passed} checks passed`);
