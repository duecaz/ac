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
  assert.deepStrictEqual(juegos, ['ballsort', 'colorear', 'tangram', 'puzzle'],
    'los juegos se añaden AQUÍ a conciencia: Pelotas + los tres de inicial (docs/handoff-juegos-inicial.md)');
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

// ── 6. La tarjeta de un juego la pinta EL COMPONENTE, con su habilidad ─────
// "Una gota no dice qué juego es" (reporte real): la estantería llegó a pintar
// tarjeta propia con el icono de la plantilla en vez del preview del tablero.
// La regla es la de siempre: la tarjeta es ÚNICA, y cómo se presenta un juego
// (preview real + pastilla de HABILIDAD) lo decide core/activityCard.js.
{
  const { activityCardHtml } = await import('../core/activityCard.js');
  const T = all.find(x => x.meta.kind === 'juego');
  const a = { id: 'g1', title: T.meta.label, template: T.meta.name,
    content: T.meta.defaultContent() };
  const htmlCard = activityCardHtml(a, { variant: 'library' });
  assert.ok(htmlCard.includes(T.meta.skill), 'la pastilla dice la HABILIDAD, no el nombre de la plantilla');
  assert.ok(htmlCard.includes('bi-controller'), 'con el icono de juego');
  assert.ok(!/juego-card__icon/.test(htmlCard), 'sin markup propio de la estantería');
  ok('la tarjeta de un juego sale del componente único: preview real + habilidad');
}

// ── 7. Las OTRAS derivaciones de §4c, como assert y no como motivación ─────
// El norte deriva CUATRO consecuencias de "un juego no lleva contenido del
// profe"; este test solo comprobaba una (no es Tarea). Las otras tres estaban
// escritas en la cabecera —"Pelotas entraba en informes"— y NO como
// comprobación, así que una de ellas seguía viva: los informes listaban el
// juego (auditoría v1.51.400).
{
  const { readFileSync } = await import('node:fs');
  const raiz = join(TDIR, '..');
  const lee = (p) => readFileSync(join(raiz, p), 'utf8');

  // (a) No se PUBLICA en la biblioteca: la tarjeta no ofrece el control.
  assert.match(lee('views/home.js'), /esJuego \? '' :[\s\S]{0,120}data-pub/,
    'la tarjeta de un juego no puede ofrecer publicar (§4c)');

  // (b) No aparece en INFORMES de aprendizaje: no hay contenido del profe del
  //     que informar (y un ranking de sudokus no dice nada de nadie).
  assert.match(lee('views/reports.js'), /kind\s*!==\s*'juego'/,
    'los informes deben excluir los juegos (§4c)');

  // (c) No se PUBLICA tampoco desde la biblioteca: Explorar los filtra.
  assert.match(lee('views/explore.js'), /kind\s*!==\s*'juego'/,
    'la biblioteca pública no lista juegos (§4c)');

  // (d) Y su contenido no se indexa por tema (lo genera la plantilla, no el profe).
  assert.match(lee('core/search.js'), /kind\s*!==\s*'juego'/,
    'el buscador no indexa las tripas generadas de un juego (§4c)');
  ok('las 4 derivaciones de §4c son assert: ni Tarea, ni publicar, ni informes, ni indexar contenido');
}

// ── 8. R7 · el docente NO ve el aparato del alumno ─────────────────────────
// "Son MENORES: lo que se guarda es lo MÍNIMO" (norte §3 R7) — y en particular
// "el docente NO ve marca ni modelo del aparato". Estaba comprobado SOLO en el
// reporte de fallos (`tests/bugReport.test.mjs`); cualquier otra superficie
// (tabla de jugadores, informe de sesión, CSV del podio) podía pintar el
// user-agent y nadie se enteraba. Se escanea el repo, no una lista.
{
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const raiz = join(TDIR, '..');
  // `core/perf.js` es la excepción LEGÍTIMA y declarada: mide el aparato para
  // encender `ww-lite` (R1, pizarras de gama baja). Nadie más lo necesita, y
  // sobre todo: ese dato no viaja ni se enseña.
  const EXCEPCIONES_APARATO = { 'core/perf.js': 'mide el dispositivo para el modo lite (R1); no lo guarda ni lo enseña' };
  const HUELLA = /navigator\.(userAgent|platform|vendor|userAgentData)/;
  const fuera = [];
  const walk = (dir, base) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { walk(p, `${base}${n}/`); continue; }
      if (!n.endsWith('.js')) continue;
      const rel = `${base}${n}`;
      if (HUELLA.test(readFileSync(p, 'utf8')) && !EXCEPCIONES_APARATO[rel]) fuera.push(rel);
    }
  };
  for (const d of ['core', 'views', 'adapters', 'kernel', 'templates']) walk(join(raiz, d), `${d}/`);
  assert.deepStrictEqual(fuera, [],
    `R7: estos módulos leen la huella del aparato sin ser la excepción declarada: ${fuera.join(' · ')}`);
  // CONTRA-PRUEBA: el escaneo tiene dientes (si no, pasaría mirando a nada).
  assert.ok(HUELLA.test('const ua = navigator.userAgent;'), 'el escáner detecta la huella del aparato');
  ok('R7: nadie lee la huella del aparato salvo core/perf.js (modo lite), y se comprueba escaneando');
}

console.log(`\n  ${passed} kind checks passed`);
