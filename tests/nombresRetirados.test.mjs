// NOMBRES QUE NO PUEDEN ESTAR EN EL CÓDIGO (dueño, 2026-08-22).
//
// «No puede estar ese nombre en ninguna parte del código, no lo sigas
// poniendo». Es la marca de un producto de la competencia y estaba en 197
// sitios: como identificador (el skin, el modelo de puntos, una clase CSS) y
// como muletilla en comentarios y documentación —«estilo X», «fórmula X»—, que
// es como se cuela una y otra vez: describiendo nuestro producto por parecido
// con otro en vez de por lo que hace.
//
// Un buscar-y-reemplazar no cierra esto: la próxima vez que alguien escriba
// «como en X» vuelve. Por eso es un BARRIDO, no una lista de sitios ya
// limpiados.
//
// La ÚNICA excepción es `core/migrate.js`, y es lo contrario de una excepción:
// ahí vive la tabla que BORRA el nombre de las actividades ya guardadas (corre
// en cada lectura). Cuando no queden datos viejos, esa línea se va y el nombre
// no estará en ningún sitio — ni en el código ni en la base de datos.
//
// Run: node tests/nombresRetirados.test.mjs
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Marcas de terceros que no describen NUESTRO producto. Wordwall NO está aquí a
// propósito: es la referencia declarada del norte y se cita como tal, no como
// forma de nombrar nuestras piezas.
const RETIRADOS = ['kahoot'];

// Dueño declarado de la erradicación: mientras queden actividades guardadas con
// el nombre viejo, alguien tiene que reconocerlo para reescribirlo.
const ERRADICADOR = join('core', 'migrate.js');

const EXTS = ['.js', '.mjs', '.css', '.html', '.json', '.md', '.sh', '.ps1'];
const SALTAR = ['node_modules', '.git', '.shots', 'docs/historico'];

const ficheros = [];
{
  const pila = [ROOT];
  while (pila.length) {
    for (const e of readdirSync(pila.pop(), { withFileTypes: true })) {
      const p = join(e.parentPath || e.path, e.name);
      const rel = relative(ROOT, p);
      if (SALTAR.some(x => rel.split('\\').join('/').startsWith(x) || rel.includes(x))) continue;
      if (e.isDirectory()) { pila.push(p); continue; }
      if (EXTS.some(x => e.name.endsWith(x))) ficheros.push(p);
    }
  }
}
assert.ok(ficheros.length > 100, `se esperaba barrer el repo entero, solo se vieron ${ficheros.length} ficheros`);

const culpables = [];
for (const p of ficheros) {
  const rel = relative(ROOT, p);
  if (rel === ERRADICADOR || rel === relative(ROOT, fileURLToPath(import.meta.url))) continue;
  const lineas = readFileSync(p, 'utf8').split('\n');
  lineas.forEach((linea, i) => {
    for (const marca of RETIRADOS) {
      if (linea.toLowerCase().includes(marca)) culpables.push(`${rel}:${i + 1}  ${linea.trim().slice(0, 70)}`);
    }
  });
}
assert.deepStrictEqual(culpables, [],
  `marcas de terceros en el código (${RETIRADOS.join(', ')}).\n`
  + 'Describe lo que la pieza HACE, no a qué producto se parece:\n  ' + culpables.join('\n  '));
ok(`${ficheros.length} ficheros barridos: ninguna marca de terceros (${RETIRADOS.join(', ')})`);

// ── El erradicador SIGUE haciendo su trabajo ────────────────────────────────
// Si alguien borra la tabla creyendo que «ya no hace falta», las actividades
// guardadas pierden su tema y su bonus en silencio. La excepción solo se
// sostiene mientras la tabla exista y reescriba de verdad.
{
  const { migrate } = await import('../core/migrate.js');
  const vieja = {
    schemaVersion: 4, template: 'quiz', content: { items: [] },
    presentation: { skin: RETIRADOS[0] },
    scoring: { mode: RETIRADOS[0] },
    live: { pointsModel: RETIRADOS[0] },
  };
  const r = migrate(vieja);
  assert.strictEqual(r.presentation.skin, 'vibrante', 'el tema viejo debe reescribirse');
  assert.strictEqual(r.scoring.mode, 'velocidad', 'el modelo de puntos de Individual debe reescribirse');
  assert.strictEqual(r.live.pointsModel, 'velocidad', 'el modelo de puntos de En vivo debe reescribirse');
  ok('la tabla de core/migrate.js reescribe de verdad: una actividad vieja sale limpia (tema y bonus intactos)');

  // CONTRA-PRUEBA: no toca lo que no es suyo.
  const nueva = {
    schemaVersion: 4, template: 'quiz', content: { items: [] },
    presentation: { skin: 'arcade' }, scoring: { mode: 'flat' }, live: { pointsModel: 'flat' },
  };
  const n = migrate(nueva);
  assert.strictEqual(n.presentation.skin, 'arcade');
  assert.strictEqual(n.scoring.mode, 'flat');
  assert.strictEqual(n.live.pointsModel, 'flat');
  ok('CONTRA-PRUEBA: una actividad que ya está bien pasa intacta');
}

console.log(`\nnombresRetirados.test: ${passed} checks passed`);
