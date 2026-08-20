// LOS GUIONES QUE EL USUARIO PEGA EN SU PI TIENEN QUE ARRANCAR.
//
// Nació de repetir el mismo fallo dos veces: escribir un comentario con `//`
// —costumbre de JavaScript— dentro de un script de bash. Bash no tiene esa
// sintaxis: intenta EJECUTAR el directorio raíz y el guion muere en la primera
// línea rara, delante del usuario, en su máquina, donde yo no puedo verlo.
//
// El coste de ese fallo no es un test rojo: es una ronda entera de ida y vuelta
// («pégame la salida») gastada en un error de tecleo mío.
//
// DESCUBRE por barrido: cualquier `.sh` nuevo de `tools/` queda cubierto solo.
// Y la contra-prueba: los guiones legítimos (que SÍ usan `#`) siguen pasando —
// el test no prohíbe comentar, prohíbe comentar en el idioma equivocado.
//
// Run: node tests/guiones.test.mjs
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(RAIZ, 'tools');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const guiones = readdirSync(DIR).filter((f) => f.endsWith('.sh')).sort();
assert.ok(guiones.length >= 1, 'debería haber al menos un guion en tools/');

// 1. Sintaxis real, con el propio bash: es la única prueba que no se puede
//    falsear leyendo el fichero con expresiones regulares.
for (const g of guiones) {
  const ruta = join(DIR, g);
  try {
    execFileSync('bash', ['-n', ruta], { stdio: 'pipe' });
  } catch (e) {
    const salida = String(e.stderr || e.stdout || e.message).trim();
    assert.fail(`tools/${g} no es bash válido:\n${salida}`);
  }
}
ok(`bash -n pasa en los ${guiones.length} guiones de tools/`);

// 2. El error concreto que ya se cometió dos veces: comentario de JavaScript.
//    `bash -n` NO lo caza siempre (una línea `// texto` es sintaxis válida: un
//    comando llamado `//`), así que hace falta mirarlo aparte.
for (const g of guiones) {
  const lineas = readFileSync(join(DIR, g), 'utf8').split('\n');
  lineas.forEach((l, i) => {
    assert.ok(!/^\s*\/\//.test(l),
      `tools/${g}:${i + 1} comenta con «//» (sintaxis de JavaScript). En bash es «#»:\n    ${l.trim()}`);
  });
}
ok('ningún guion comenta con «//» (en bash eso intenta ejecutar «/»)');

// 3. Contra-prueba: los guiones SÍ están comentados con `#`. Si este test se
//    «cumpliera» borrando los comentarios, esto lo delata.
const conComentario = guiones.filter((g) =>
  readFileSync(join(DIR, g), 'utf8').split('\n').some((l) => /^\s*#(?!!)/.test(l)));
assert.ok(conComentario.length === guiones.length,
  `estos guiones se quedaron sin explicación: ${guiones.filter((g) => !conComentario.includes(g)).join(', ')}`);
ok('y todos siguen explicados con comentarios «#» (la regla no invita a borrarlos)');

console.log(`\n✅ guiones: ${passed} comprobaciones (${guiones.length} guiones)`);
