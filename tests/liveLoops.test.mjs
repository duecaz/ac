// D7 · EL CATÁLOGO DE BUCLES EN VIVO ESTÁ CONGELADO.
//
// un concurso tiene UN solo bucle de juego y por eso puede añadir tipos de pregunta sin
// tocar el motor de la partida. Nosotros tenemos CUATRO (rondas · carrera ·
// tablero · pedir la palabra) repartidos entre dos vistas de 840 y 714 líneas,
// y las tres regresiones en vivo de este mes cayeron justo donde se cruzan
// (ver docs/estudio-bucles-live.md).
//
// Mientras se decide el rediseño (declarar el catálogo completo y que cada
// plantilla declare los bucles que soporta), este test CONGELA lo que hay: un
// quinto bucle, o una plantilla que se invente una política, rompe CI. No
// prohíbe crecer — obliga a que crecer sea una decisión escrita, no un `if`
// más en una vista.
//
// Run: node tests/liveLoops.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import '../core/registerTemplates.js';
import { listTemplates } from '../core/registry.js';
import { LIVE_LOOPS, loopsOf } from '../core/liveLoops.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const read = (p) => readFileSync(new URL(p, new URL('..', import.meta.url)), 'utf8');

// El catálogo CONGELADO, con su fase de sala y quién lo elige. Cambiar esta
// tabla es la decisión; el test solo impide que cambie sin querer.
const LOOPS = {
  rounds: { phase: 'question', chosenBy: 'plantilla' },
  board:  { phase: 'race',     chosenBy: 'plantilla' },
  race:   { phase: 'race',     chosenBy: 'plantilla (+ elección del profe en el lobby)' },
  claim:  { phase: 'question-live', chosenBy: 'plantilla' },
};

// ── 1. Las 13 plantillas solo declaran políticas del catálogo ──────────────
{
  const DECLARABLE = LIVE_LOOPS;   // el catálogo completo (core/liveLoops.js)
  // Solo las plantillas REALES: el registro es global y otras suites del runner
  // dejan plantillas de prueba registradas (t_solo, qlocal…). El punto único de
  // registro es core/registerTemplates.js, así que la lista sale de ahí.
  const registered = new Set([...read('core/registerTemplates.js').matchAll(/templates\/([\w-]+)\/index\.js/g)].map(m => m[1]));
  assert.ok(registered.size >= 12, `se esperaban ≥12 plantillas registradas, se leyeron ${registered.size}`);
  const seen = {};
  for (const T of listTemplates().filter(t => registered.has(t.meta?.name))) {
    const declared = T.meta?.play?.live;
    assert.ok(Array.isArray(declared),
      `${T.meta.name}: play.live debe ser una LISTA de bucles (§26), vale ${JSON.stringify(declared)}`);
    for (const v of declared) {
      assert.ok(DECLARABLE.includes(v),
        `${T.meta.name}: play.live incluye "${v}", que no está en el catálogo ${DECLARABLE.join(' | ')}. `
        + 'Si es un bucle NUEVO, no basta con declararlo: pasa por docs/leyes.md y por docs/estudio-bucles-live.md.');
    }
    // Y la declaración tiene que coincidir con lo que devuelve el módulo dueño.
    assert.deepStrictEqual(loopsOf(T), declared.filter(v => DECLARABLE.includes(v)),
      `${T.meta.name}: loopsOf() no coincide con lo declarado`);
    for (const v of (declared.length ? declared : ['(ninguno)'])) seen[v] = (seen[v] || 0) + 1;
  }
  assert.ok(seen.rounds >= 1 && seen.board >= 1 && seen.race >= 1 && seen.claim >= 1,
    `el catálogo debe seguir cubierto por plantillas reales (visto: ${JSON.stringify(seen)})`);
  ok(`${Object.values(seen).reduce((a, b) => a + b, 0)} plantillas: ninguna se inventa una política de vivo (${Object.entries(seen).map(([k, n]) => `${k}:${n}`).join(' ')})`);
}

// ── 2. El contrato no ha ampliado el catálogo por su cuenta ────────────────
{
  const src = read('core/templateContract.js');
  const m = src.match(/LIVE_POLICIES\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, 'core/templateContract.js debe declarar LIVE_POLICIES');
  assert.match(src, /LIVE_POLICIES\s*=\s*\[\.\.\.LIVE_LOOPS/,
    'el contrato debe VALIDAR contra core/liveLoops.js, no llevar su propia lista');
  assert.deepStrictEqual([...LIVE_LOOPS].sort(), ['board', 'claim', 'race', 'rounds'],
    `el catálogo cambió a ${JSON.stringify(LIVE_LOOPS)}. Es una DECISIÓN (§26): actualiza `
    + 'docs/estudio-bucles-live.md y su ficha a la vez.');
  ok('el catálogo es rounds | race | board | claim y el contrato lo lee del módulo');
}

// ── 3. Las FASES de sala en vivo también están congeladas ─────────────────
// Un bucle nuevo casi siempre llega como una fase nueva en las vistas: es la
// puerta de atrás que este check cierra.
{
  const PHASES = new Set(['lobby', 'question', 'reveal', 'leaderboard', 'race', 'question-live', 'ended', 'idle']);
  for (const f of ['views/hostLive.js', 'views/studentLive.js']) {
    const src = read(f);
    for (const m of src.matchAll(/phase\s*[=!]==\s*'([\w-]+)'/g)) {
      assert.ok(PHASES.has(m[1]),
        `${f}: fase de sala "${m[1]}" fuera del catálogo congelado (${[...PHASES].join(', ')}). `
        + 'Una fase nueva = un bucle nuevo: pasa por la decisión D7 antes.');
    }
  }
  ok('las fases de sala usadas por host y alumno están dentro del catálogo');
}

// ── 4. La deuda §0 medida: cuántos sitios eligen por NOMBRE de plantilla ──
// No se prohíbe (arreglarlo es el rediseño), pero se fija el número: si crece,
// el test avisa. Así la deuda no se hace más grande en silencio.
{
  const KNOWN = 0;   // §0 SALDADA: ninguna vista elige bucle por nombre de plantilla
  let n = 0;
  for (const f of ['views/hostLive.js', 'views/studentLive.js']) {
    n += [...read(f).matchAll(/activity\.template\s*===\s*'[\w-]+'/g)].length;
  }
  assert.ok(n <= KNOWN,
    `las vistas de vivo eligen por NOMBRE de plantilla en ${n} sitios (antes ${KNOWN}). `
    + 'La ley §0 dice que un modo no conoce plantillas concretas: el bucle debe DECLARARSE, no adivinarse. '
    + 'Ver docs/estudio-bucles-live.md §4.');
  ok(`deuda §0 acotada: ${n} elecciones por nombre de plantilla (tope ${KNOWN}, no puede crecer)`);
}

// ── 4b. POLÍTICA DE EXPOSICIÓN: durante el juego, AVANCE y no RANKING ─────
// Decisión (docs/estudio-bucles-live.md fichas 2 C-2 y 3 B-1): en los bucles a
// ritmo del alumno la pizarra está puesta VARIOS MINUTOS. Ordenarla por
// puntuación deja al que menos sabe el último de una lista proyectada todo ese
// rato — mucho más exposición que la revelación de una pregunta. La
// clasificación existe, pero en el PODIO. (En RONDAS el marcador entre
// preguntas sí es un ranking: dura segundos y es el bucle del concurso.)
{
  const host = read('views/hostLive.js');
  const fn = (name, end) => host.slice(host.indexOf(name), host.indexOf(end));
  const race = fn('async function paintRace(', 'async function paintLiveBoardHost(');
  assert.ok(!/\.sort\(/.test(race),
    'la lista de la CARRERA no puede ordenarse durante el juego (avance, no ranking): '
    + 'el orden es el de entrada a la sala. La clasificación va en el podio.');
  assert.match(race, /players\.map\(p => prog\[p\.id\]\)/, 'y sale del orden estable de jugadores');
  const board = fn('async function paintLiveBoardHost(', 'async function paintPodium(');
  assert.ok(!/cells\.sort\(/.test(board),
    'la rejilla del TABLERO tampoco se reordena en vivo (además hace saltar las celdas bajo el dedo)');
  // Contra-prueba: en RONDAS el marcador SÍ ordena (es su momento, y dura poco).
  const lb = fn('async function paintLeaderboard(', 'async function loadRaceAnswers(');   // rondas
  assert.match(lb, /leaderboard\(sessionId/, 'rondas conserva su clasificación entre preguntas');
  ok('exposición: carrera y tablero muestran avance; rondas conserva su ranking');
}

// ── 5. El estudio existe y describe los mismos bucles que el código ───────
{
  const doc = read('docs/estudio-bucles-live.md');
  for (const loop of Object.keys(LOOPS)) {
    const label = { rounds: 'Rondas', board: 'Tablero', race: 'Carrera', claim: 'Pedir la palabra' }[loop];
    assert.ok(doc.includes(label), `el estudio debe describir el bucle "${label}"`);
  }
  ok('docs/estudio-bucles-live.md describe los 4 bucles que el código ejecuta');
}

console.log(`\nliveLoops.test: ${passed} checks passed`);
