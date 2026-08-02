// ⚖️ LEY §0 — LAS CUATRO CAPAS, EJECUTABLE.
//
// Hasta ahora el modelo de capas vivía en prosa (`docs/leyes.md` §0) y NADA
// impedía cruzarlo: bastaba un `import` en la dirección equivocada. El caso que
// lo destapó es de esta misma semana — `views/sessionTable.js` contiene
// `buildSessionTable`, que DECIDE QUIÉN GANA (dominio puro), y vive en la capa
// de plataforma; se notó porque los tests de core tenían que importarlo desde
// `views/`. Ninguna ley lo cazó porque ninguna miraba el grafo de imports.
//
// Aquí la dirección de las dependencias es una NORMA con test: cada capa declara
// a quién PUEDE importar, y las excepciones están listadas una a una, con su
// fichero y su motivo. Es un RATCHET: una excepción nueva rompe CI hasta que se
// escriba por qué. La lista solo debería encoger.
//
// El mismo grafo alimenta `tools/module-map.mjs`, que dibuja el diagrama de
// `docs/arquitectura-modulos.md` → el diagrama no puede mentir sobre el código.
//
// Run: node tests/layers.test.mjs
import assert from 'node:assert';
import { buildGraph, layerOf } from './helpers/importGraph.mjs';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// A QUIÉN PUEDE IMPORTAR CADA CAPA (además de a sí misma).
//
//   contenido   modelos y conversión del JSON del usuario (kernel/content)
//   plantillas  UNA mecánica: scorer + render + meta.play
//   kernel      el motor de sesión (live/teams/vs): cuándo se liquida
//   core        el arreglo social (modos, shells) + utilidades compartidas
//   adaptadores el transporte (PocketBase | local)
//   vistas      el chrome: navegación, setup, informes
//   config      solo datos (pocketbase.config.js)
//   arranque    el cableado por página (main.*.js, sw.js)
//
// La dirección legítima es SIEMPRE hacia abajo en esa lista. Lo de arriba no
// puede saber de lo de abajo: una plantilla que importara una vista sabría en
// qué modo corre, y eso es justo lo que §0 prohíbe.
const ALLOWED = {
  contenido:   ['core', 'kernel'],          // utilidades puras (ids, clock) + contratos
  plantillas:  ['core', 'contenido', 'kernel'],
  kernel:      ['core', 'contenido', 'config'],
  core:        ['kernel', 'contenido', 'config'],
  adaptadores: ['core', 'kernel', 'contenido', 'config'],
  vistas:      ['core', 'kernel', 'contenido', 'plantillas', 'adaptadores', 'config'],
  config:      [],                          // datos: no importa nada
  arranque:    ['core', 'kernel', 'contenido', 'plantillas', 'adaptadores', 'vistas', 'config'],
};

// EXCEPCIONES SANCIONADAS — `fichero → destino`, con su motivo. Cada una es una
// deuda declarada o una decisión consciente; nada entra aquí sin explicación.
const EXCEPTIONS = new Map(Object.entries({
  // El MODO monta su vista con `import()` DINÁMICO dentro de runMode(): la capa
  // de modo no conoce la vista al cargarse (sigue siendo pura y testeable en
  // Node), solo sabe montarla cuando el usuario elige ese modo. Si algún día
  // esto se hiciera con import estático, el módulo dejaría de ser puro.
  'core/modes.js→views/vsView.js': 'runMode(): import() dinámico al montar el modo',
  'core/modes.js→views/memoryView.js': 'runMode(): import() dinámico al montar el modo',
  'core/modes.js→views/teamsView.js': 'runMode(): import() dinámico al montar el modo',
  'core/authWidget.js→views/loginModal.js': 'import() dinámico al abrir el modal de acceso',
  // La fachada de transporte: core habla con `adapters/index.js`, NUNCA con un
  // adaptador concreto (eso es lo que permitió retirar Supabase sin tocar core).
  'core/assignmentsTransport.js→adapters/index.js': 'fachada de transporte',
  'core/authGate.js→adapters/index.js': 'fachada de transporte',
  'core/dbDiag.js→adapters/index.js': 'fachada de transporte',
  'core/liveTransport.js→adapters/index.js': 'fachada de transporte',
  'core/results.js→adapters/index.js': 'fachada de transporte',
  'core/storage.js→adapters/index.js': 'fachada de transporte',
  // El auto-test del panel usa un scorer real como banco de pruebas.
  'core/selftest.js→templates/quiz/scorer.js': 'banco de pruebas del panel #/admin',
  // DEUDA: una plantilla no debería necesitar el motor de sesión. Aquí es solo
  // `sessionItems` (leer los ítems), que es utilidad de contenido mal ubicada.
  'templates/question-live/player.js→kernel/session/engine.js': 'DEUDA: sessionItems debería vivir en contenido',
}));

const g = buildGraph();

// ── 1. Ningún import cruza una capa en la dirección prohibida ───────────────
{
  const bad = [];
  for (const e of g.edges) {
    if (e.fromLayer === e.toLayer) continue;
    if ((ALLOWED[e.fromLayer] || []).includes(e.toLayer)) continue;
    if (EXCEPTIONS.has(`${e.from}→${e.to}`)) continue;
    bad.push(`[${e.fromLayer} → ${e.toLayer}] ${e.from} → ${e.to}`);
  }
  assert.deepStrictEqual(bad, [],
    `IMPORTS QUE CRUZAN UNA CAPA (docs/leyes.md §0):\n  ${bad.join('\n  ')}\n\n`
    + '  Cada capa solo puede importar hacia abajo. Si el import es legítimo,\n'
    + '  añádelo a EXCEPTIONS con su motivo (y que sea un motivo, no un "por ahora").');
  ok(`${g.files.length} módulos · ${g.edges.length} imports: ninguno cruza una capa (${EXCEPTIONS.size} excepciones declaradas)`);
}

// ── 2. Las excepciones son un RATCHET: solo encogen ─────────────────────────
{
  const live = new Set(g.edges.map(e => `${e.from}→${e.to}`));
  const stale = [...EXCEPTIONS.keys()].filter(k => !live.has(k));
  assert.deepStrictEqual(stale, [],
    `EXCEPCIONES MUERTAS (el import ya no existe → bórralas de la lista):\n  ${stale.join('\n  ')}`);
  ok('sin excepciones muertas: la lista refleja el código de hoy');
}

// ── 3. El contenido del usuario no sabe de mecánicas ni de modos ────────────
// La prohibición literal de §0 para la capa CONTENIDO. Se comprueba aparte
// porque es la frontera que más caro sale cruzar: si el modelo de contenido
// supiera de plantillas, una migración tocaría las 13.
{
  const leaks = g.edges.filter(e => e.fromLayer === 'contenido'
    && ['plantillas', 'vistas', 'adaptadores'].includes(e.toLayer));
  assert.deepStrictEqual(leaks.map(e => `${e.from} → ${e.to}`), [],
    'kernel/content NO puede saber de plantillas, vistas ni adaptadores (§0)');
  ok('la capa CONTENIDO no conoce plantillas, vistas ni adaptadores');
}

// ── 4. Una plantilla no sabe en qué modo corre ──────────────────────────────
// La otra prohibición de §0: la plantilla DECLARA sus políticas (`meta.play`) y
// el modo las consume. Si una plantilla importara una vista de modo o el
// transporte, estaría decidiendo el arreglo social desde dentro de la mecánica.
{
  const leaks = g.edges.filter(e => e.fromLayer === 'plantillas'
    && ['vistas', 'adaptadores'].includes(e.toLayer));
  assert.deepStrictEqual(leaks.map(e => `${e.from} → ${e.to}`), [],
    'una plantilla NO puede importar una vista ni el transporte (§0)');
  ok('las 13 plantillas no conocen vistas ni adaptadores');
}

// ── 5. El motor no conoce el transporte ni la pantalla ──────────────────────
// `kernel/` es puro por contrato (se simula entero en Node). Un import a
// adaptadores o vistas lo rompería y con él toda la suite del motor.
{
  const leaks = g.edges.filter(e => e.fromLayer === 'kernel'
    && ['vistas', 'adaptadores', 'plantillas'].includes(e.toLayer));
  assert.deepStrictEqual(leaks.map(e => `${e.from} → ${e.to}`), [],
    'kernel/ debe seguir siendo puro: sin vistas, sin adaptadores, sin plantillas concretas');
  ok('el motor (kernel/) no conoce transporte, pantalla ni plantillas concretas');
}

// ── 6. El DIAGRAMA está al día con el código ───────────────────────────────
// Un diagrama a mano envejece en silencio y acaba mintiendo, que es peor que no
// tenerlo. `docs/arquitectura-modulos.md` se GENERA de este mismo grafo, y aquí
// se comprueba que nadie lo editó a mano ni se olvidó de regenerarlo.
{
  const { execFileSync } = await import('node:child_process');
  let out = '';
  try {
    out = execFileSync(process.execPath, ['tools/module-map.mjs', '--check'],
      { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' });
  } catch (e) {
    assert.fail(`docs/arquitectura-modulos.md desactualizado — corre \`node tools/module-map.mjs\`\n${e.stdout || ''}${e.stderr || ''}`);
  }
  assert.match(out, /coincide con el código/);
  ok('docs/arquitectura-modulos.md coincide con el grafo real (se regenera, no se dibuja)');
}

console.log(`\n  ${passed} layer checks passed`);
