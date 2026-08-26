// UN AJUSTE QUE EL PANEL ESCRIBE, ALGUIEN TIENE QUE LEERLO.
//
// El dueño (2026-08-14): «revisa dónde más pasa, no podemos tener errores tan
// básicos». Pasaba en SIETE sitios. Un mando que no manda es la peor clase de
// fallo de esta app: el profe prepara la clase creyendo que lo dejó configurado
// y se entera con los críos delante — o no se entera nunca.
//
// LO QUE SE ESCANEA. Cada campo que un editor ESCRIBE (`a.scoring.X = …`,
// `a.rules.X = …`, `a.live.X = …`, `a.presentation.X = …`) tiene que aparecer
// LEÍDO en algún fichero que no sea un editor ni un test: el juego, el motor,
// una vista. Si no, el mando está desconectado.
//
// Es un escaneo, NO una lista: un interruptor nuevo queda cubierto el día que
// se escribe, sin que nadie se acuerde de añadirlo aquí. Esa es justo la
// diferencia que dejó pasar los siete.
// Run: node tests/ajusteConectado.test.mjs
import assert from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TERCEROS } from './helpers/inventario.mjs';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const ficheros = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    if ([...TERCEROS, 'docs', 'sounds', 'themes'].includes(f)) continue;
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.js') || f.endsWith('.mjs')) ficheros.push(p);
  }
})(ROOT);

const rel = (p) => relative(ROOT, p);
const esEditor = (p) => /editor\.js$|editorPanels\.js$|editorModes\.js$|editorShell\.js$|editorPrimitives\.js$/.test(p);
// Los tests y las herramientas no cuentan como lectores: un ajuste que solo lee
// su propia prueba sigue sin llegar al juego.
// OJO con el ancla: `\/tests\//` NO encaja con «tests/x.js» (la ruta relativa
// no empieza por barra), así que este mismo fichero se contaba como LECTOR de
// los ajustes que nombra en su lista de excepciones — un escáner que se
// justifica a sí mismo.
const esPrueba = (p) => /^tests?\/|^tools\/|selftest|stressTest|raceE2e/.test(rel(p));

// EXCEPCIONES DECLARADAS, con su motivo. Vacía es lo correcto; cada línea que
// se añada aquí es un mando que el profe ve y que no hace nada todavía.
const PERMITIDOS = {
  // El crédito de la imagen buscada se GUARDA con la actividad (§24) y se
  // muestra en el editor; pintarlo también en el player está pendiente y
  // escrito en docs/handoff-editor-general.md (F6).
  'presentation.backgroundImageCredit': 'se guarda y se muestra en el editor; falta pintarlo en el player (F6)',
};

const ESCRIBE = /\ba(?:ctivity)?\.(scoring|rules|live|presentation|review)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g;

const escritos = new Map();
for (const p of ficheros.filter(esEditor)) {
  for (const m of readFileSync(p, 'utf8').matchAll(ESCRIBE)) {
    const k = `${m[1]}.${m[2]}`;
    if (!escritos.has(k)) escritos.set(k, new Set());
    escritos.get(k).add(rel(p));
  }
}

function lectoresDe(grupo, campo) {
  const re = new RegExp(`\\.${grupo}\\??\\.${campo}\\b|\\b${grupo}\\??\\.${campo}\\b|['"\`]${campo}['"\`]`);
  return ficheros.filter(p => !esEditor(p) && !esPrueba(p) && re.test(readFileSync(p, 'utf8'))).map(rel);
}

// ── Ningún mando desconectado ────────────────────────────────────────────────
{
  assert.ok(escritos.size >= 20, `el escáner debería ver decenas de ajustes, vio ${escritos.size}`);
  const sueltos = [];
  for (const [k] of escritos) {
    const [g, c] = k.split('.');
    if (PERMITIDOS[k]) continue;
    if (!lectoresDe(g, c).length) sueltos.push(k);
  }
  assert.deepStrictEqual(sueltos, [],
    `ajustes que el editor escribe y NADIE lee (el profe los mueve y no pasa nada): ${sueltos.join(', ')}`);
  ok(`los ${escritos.size} ajustes que escriben los editores tienen quien los lea (${Object.keys(PERMITIDOS).length} excepción declarada)`);
}

// ── CONTRA-PRUEBA: el escáner sabe cazar uno ─────────────────────────────────
// Sin esto, un escáner roto (una expresión que no encaja con nada) pasaría
// siempre y daría la falsa sensación de estar vigilando.
{
  const inventado = lectoresDe('live', 'ajusteQueNadieLeeJamas_' + 'zz');
  assert.deepStrictEqual(inventado, [], 'un campo inventado no tiene lectores');
  const conocidos = lectoresDe('scoring', 'pointsPerCorrect');
  assert.ok(conocidos.length >= 2, `«Puntos por acierto» debe tener lectores reales, encontró ${conocidos.length}`);
  ok('CONTRA-PRUEBA: el escáner distingue un ajuste leído de uno inventado');
}

// ── Las excepciones declaradas siguen siendo NECESARIAS ──────────────────────
// Una excepción que ya no hace falta es deuda fantasma: al arreglarse el
// pendiente, esta línea obliga a borrarla de la lista.
{
  const sobrantes = Object.keys(PERMITIDOS).filter(k => {
    const [g, c] = k.split('.');
    return lectoresDe(g, c).length > 0;
  });
  assert.deepStrictEqual(sobrantes, [],
    `excepciones que ya NO hacen falta (el ajuste sí se lee): ${sobrantes.join(', ')}`);
  ok('ninguna excepción declarada sobra');
}

console.log(`\n  ${passed} ajusteConectado checks passed`);
