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
import { ficheros, leer } from './helpers/inventario.mjs';

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

// ── 4. §0 MEDIDA: cuántos sitios eligen por NOMBRE de plantilla ───────────
// Esto miraba DOS ficheros (`hostLive`, `studentLive`) y UNA forma sintáctica
// (`activity.template === '…'`), y anunciaba «0 elecciones por nombre de
// plantilla» sin decir dónde. Sonaba a todo el repo. No lo era: fuera de su
// campo de visión había DOCE, y la peor estaba copiada en CINCO vistas —
//   navigate(`#/${b.dataset.tpl === 'memory' ? 'memory' : 'teams'}/${id}`)
// — o sea la plataforma preguntándole a un botón si la plantilla se llama
// «memory» para elegir a qué pantalla mandar al profe. Una red que dice «0»
// mirando el 15 % del sitio no protege: enseña a creerse el número.
//
// Ahora se escanea TODO el código de la app y se aceptan las tres formas de
// preguntar (`activity.template`, `a?.template`, `T?.meta?.name`). El tope es 0 y
// se llegó a 0 declarando lo que antes se adivinaba: `play.teams:'propio'`
// (Memoria trae su mecánica), `seMarcaConLapiz` (Tildes/Comas) y
// `iaPalabrasComoTexto` (Sopa).
{
  const NOMBRES = listTemplates().map(T => T.meta.name);
  const RE = new RegExp(
    String.raw`([\w.?\[\]']*(?:template|tpl|name)[\w.?\[\]']*)\s*[=!]==\s*'(${NOMBRES.join('|')})'`, 'g');
  const sinComentarios = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, pre) => pre);
  const hallados = [];
  for (const f of ficheros('.', (x) => /\.(js|mjs)$/.test(x) && !/^(tests|tools|docs)\//.test(x))) {
    sinComentarios(leer(f)).split('\n').forEach((ln, i) => {
      for (const m of ln.matchAll(RE)) hallados.push(`${f}:${i + 1} → ${m[0].trim()}`);
    });
  }
  if (hallados.length) {
    console.log('\n  Sitios que eligen por NOMBRE de plantilla (§0):');
    for (const h of hallados) console.log(`    ✗ ${h}`);
    console.log('\n  DECLÁRALO en meta y pregunta por la capacidad, no por la identidad.\n');
  }
  assert.strictEqual(hallados.length, 0,
    `${hallados.length} sitio(s) eligen por NOMBRE de plantilla. La ley §0 dice que un modo `
    + 'no conoce plantillas concretas: la capacidad se DECLARA en meta y se pregunta por ella.');
  // CONTRA-PRUEBA: el escáner tiene que saber cazar las tres formas. Sin esto,
  // un regex roto dejaría el cero en verde para siempre — que es exactamente
  // como esta comprobación estuvo pasando mientras había doce.
  const CASOS = [
    `if (activity.template === 'memory') mount();`,
    `const t = a?.template === 'tildes';`,
    `supportsTemplate: (T) => T?.meta?.name === 'memory',`,
  ];
  for (const caso of CASOS) {
    RE.lastIndex = 0;
    assert.ok(RE.test(caso), `CONTRA-PRUEBA: el escáner no ve «${caso}»`);
  }
  ok(`§0 SALDADA: 0 elecciones por nombre de plantilla en TODO el código de la app (${CASOS.length} formas vigiladas)`);
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
