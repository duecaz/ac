// D7 · EL CATÁLOGO DE BUCLES EN VIVO ESTÁ CONGELADO.
//
// Kahoot tiene UN bucle de juego y por eso puede añadir tipos de pregunta sin
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

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const read = (p) => readFileSync(new URL(p, new URL('..', import.meta.url)), 'utf8');

// El catálogo CONGELADO, con su fase de sala y quién lo elige. Cambiar esta
// tabla es la decisión; el test solo impide que cambie sin querer.
const LOOPS = {
  rounds: { phase: 'question', chosenBy: 'plantilla' },
  board:  { phase: 'race',     chosenBy: 'plantilla' },
  race:   { phase: 'race',     chosenBy: 'profe (select del lobby)' },
  claim:  { phase: 'question-live', chosenBy: 'vista (por nombre de plantilla) — deuda §0' },
};

// ── 1. Las 13 plantillas solo declaran políticas del catálogo ──────────────
{
  const DECLARABLE = ['rounds', 'board', 'none'];   // lo que hoy admite el contrato
  // Solo las plantillas REALES: el registro es global y otras suites del runner
  // dejan plantillas de prueba registradas (t_solo, qlocal…). El punto único de
  // registro es core/registerTemplates.js, así que la lista sale de ahí.
  const registered = new Set([...read('core/registerTemplates.js').matchAll(/templates\/([\w-]+)\/index\.js/g)].map(m => m[1]));
  assert.ok(registered.size >= 12, `se esperaban ≥12 plantillas registradas, se leyeron ${registered.size}`);
  const seen = {};
  for (const T of listTemplates().filter(t => registered.has(t.meta?.name))) {
    const v = T.meta?.play?.live;
    assert.ok(DECLARABLE.includes(v),
      `${T.meta.name}: play.live=${JSON.stringify(v)} no está en el catálogo ${DECLARABLE.join(' | ')}. `
      + 'Si es un bucle NUEVO, no basta con declararlo: pasa por docs/leyes.md y por docs/estudio-bucles-live.md.');
    seen[v] = (seen[v] || 0) + 1;
  }
  assert.ok(seen.rounds >= 1 && seen.board >= 1, 'siguen existiendo plantillas de rondas y de tablero');
  ok(`${Object.values(seen).reduce((a, b) => a + b, 0)} plantillas: ninguna se inventa una política de vivo (${Object.entries(seen).map(([k, n]) => `${k}:${n}`).join(' ')})`);
}

// ── 2. El contrato no ha ampliado el catálogo por su cuenta ────────────────
{
  const src = read('core/templateContract.js');
  const m = src.match(/LIVE_POLICIES\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, 'core/templateContract.js debe declarar LIVE_POLICIES');
  const got = m[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
  assert.deepStrictEqual(got.sort(), ['board', 'none', 'rounds'],
    `el catálogo declarable cambió a ${JSON.stringify(got)}. Es una DECISIÓN de diseño (D7): `
    + 'actualiza docs/estudio-bucles-live.md y esta lista a la vez.');
  ok('el catálogo declarable sigue siendo rounds | board | none');
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
  const KNOWN = 4;   // hostLive:200 (×2 en la misma línea), 669 · studentLive:243
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
