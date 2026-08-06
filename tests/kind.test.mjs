// LAS DOS FAMILIAS (norte §4c) — ejercicios y juegos, EJECUTABLE.
//
// La distinción estuvo semanas decidida y sin aplicar, y mientras tanto Ordena
// las Pelotas entraba en informes y se ofrecía como Tarea sin nada que evaluar.
// "Decidido pero no en el código" es donde este proyecto se hace daño: esta
// suite convierte §4c en algo que no se puede des-decidir en silencio.
//
// Run: node tests/kind.test.mjs
import assert from 'node:assert';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import '../core/registerTemplates.js';
import { listTemplates } from '../core/registry.js';
import { gameTemplates } from '../views/juegos.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
// Solo las plantillas REALES (con carpeta): en run.mjs las suites comparten
// proceso y registry.test registra plantillas de juguete (t_solo…) que no
// tienen por qué cumplir §4c.
const TDIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const reales = new Set(readdirSync(TDIR).filter(n => { try { return statSync(join(TDIR, n)).isDirectory(); } catch { return false; } }));
const all = listTemplates().filter(T => reales.has(T.meta.name));

// ── 1. Las 13 declaran su familia (no se adivina, se declara) ───────────────
{
  for (const T of all) {
    assert.ok(['ejercicio', 'juego'].includes(T.meta.kind),
      `${T.meta.name}: meta.kind inválido (${JSON.stringify(T.meta.kind)})`);
  }
  const juegos = all.filter(T => T.meta.kind === 'juego').map(T => T.meta.name);
  assert.deepStrictEqual(juegos, ['ballsort'],
    'hoy el único juego es Ordena las Pelotas; uno nuevo se añade AQUÍ a conciencia');
  ok(`${all.length} plantillas declaran familia · juegos: ${juegos.join(' · ')}`);
}

// ── 2. El catálogo de juegos está ACOTADO EN OCHO (§4c) ────────────────────
// Como §26 congeló los bucles: sin techo, la familia barata de construir (sin
// editor, sin contenido) se come el catálogo y acabamos siendo un sitio de
// juegos con actividades al lado — lo contrario del norte. El noveno entra
// SUSTITUYENDO, no sumando, y esa conversación se tiene aquí.
{
  const n = all.filter(T => T.meta.kind === 'juego').length;
  assert.ok(n <= 8, `hay ${n} juegos y el techo del norte §4c es 8: uno debe salir para que otro entre`);
  ok(`plazas de juego ocupadas: ${n} de 8`);
}

// ── 3. Un JUEGO no se ofrece como Tarea, y declara su HABILIDAD ────────────
// Las derivaciones de §4c que el contrato exige: sin contenido del docente no
// hay nada que evaluar en una tarea (y mandarlo a casa empuja al uso sin
// profe, §4d); y la habilidad es el eje del catálogo — es lo que le sirve al
// profe para elegir y para justificarlo ante su coordinación.
{
  for (const T of all.filter(x => x.meta.kind === 'juego')) {
    assert.strictEqual(!!T.meta.modes?.async, false, `${T.meta.name}: un juego no puede ofrecerse como Tarea`);
    assert.ok(String(T.meta.skill || '').trim(), `${T.meta.name}: un juego declara la habilidad que entrena`);
  }
  ok('los juegos no se ofrecen como Tarea y declaran su habilidad');
}

// ── 4. La estantería lista los juegos DEL REGISTRO, no una lista a mano ────
{
  const shelf = gameTemplates().map(T => T.meta.name).filter(n => reales.has(n));
  const declared = all.filter(T => T.meta.kind === 'juego').map(T => T.meta.name);
  assert.deepStrictEqual(shelf.sort(), declared.sort(),
    'la estantería y el registro divergen: un juego declarado no aparece (o al revés)');
  ok('la estantería #/juegos sale del registro: un juego nuevo aparece solo');
}

// ── 5. CONTRA-PRUEBA: un ejercicio no pierde nada por serlo ────────────────
// La familia no puede convertirse en una excusa para recortar ejercicios:
// Sopa de Letras y Crucigrama PARECEN juego y siguen siendo ejercicios con
// todos sus modos (las palabras las pone el profe — regla de las 3 preguntas).
{
  const sopa = all.find(T => T.meta.name === 'wordsearch');
  const cruci = all.find(T => T.meta.name === 'crossword');
  assert.strictEqual(sopa.meta.kind, 'ejercicio', 'la Sopa es EJERCICIO aunque parezca juego');
  assert.strictEqual(cruci.meta.kind, 'ejercicio', 'el Crucigrama también');
  assert.ok(sopa.meta.modes.async, 'y conserva la Tarea (encaja mejor como tarea, dice el inventario)');
  ok('CONTRA-PRUEBA: Sopa y Crucigrama siguen siendo ejercicios con Tarea');
}

console.log(`\n  ${passed} kind checks passed`);
