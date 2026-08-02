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
import { ALLOWED, EXCEPTIONS } from './helpers/layerRules.mjs';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Las reglas (qué capa puede importar a quién) y las excepciones sancionadas
// viven en `helpers/layerRules.mjs`, porque las comparte el generador del
// diagrama: una copia en cada sitio acabaría mintiendo.
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
