// ⚖️ LEY §27 — SI ES UN TRAMO DEL NORTE, TIENE SU RECORRIDO.
//
// La ley que faltaba, y la que explica los cinco fallos que la clase encontró en
// una semana con 87 suites verdes: ninguno estaba en una pieza, los cinco vivían
// en la COSTURA entre piezas correctas. Un test de unidad no puede verlos —
// hacen falta recorridos que caminen el viaje con el navegador.
//
// Esta suite no camina nada (eso lo hacen los smokes, que necesitan Chromium):
// vigila que las redes EXISTAN, que cubran los tramos declarados y que nadie las
// desconecte del preflight. Un smoke que nadie corre es documentación.
//
// Run: node tests/journeys.test.mjs
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TRACK_ORDER } from './helpers/journeyTracks.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Qué recorrido cubre cada TRAMO del viaje del profesor (docs/norte.md §1).
// `manual` = existe pero no entra en el preflight, y por qué.
const RECORRIDOS = {
  'buscar/crear':      { tool: 'tools/find-smoke.mjs' },
  'jugar en pizarra':  { tool: 'tools/matrix-smoke.mjs' },
  'jugar en vivo':     { tool: 'tools/live-smoke.mjs' },
  'informes/tareas':   { tool: null, motivo: 'sin recorrido todavía — deuda declarada, no olvido' },
};

// ── 1. Cada tramo JUGABLE del norte tiene su recorrido, y existe ────────────
{
  const sinCubrir = [];
  for (const [tramo, r] of Object.entries(RECORRIDOS)) {
    if (!r.tool) { sinCubrir.push(`${tramo} (${r.motivo})`); continue; }
    assert.ok(existsSync(join(ROOT, r.tool)), `${tramo}: falta ${r.tool}`);
  }
  const cubiertos = Object.values(RECORRIDOS).filter(r => r.tool).length;
  assert.ok(cubiertos >= 3, `solo ${cubiertos} tramos con recorrido`);
  ok(`${cubiertos} tramos del viaje tienen recorrido · sin cubrir: ${sinCubrir.join(' · ') || 'ninguno'}`);
}

// ── 2. Los tramos del test y los de la radiografía son LOS MISMOS ───────────
// Si alguien añade un tramo a `journeyTracks` y no a esta tabla, el tramo nuevo
// nacería sin recorrido y sin que nadie lo dijera.
{
  const medidos = TRACK_ORDER.filter(t => !['plantillas (mecánicas)', 'infra/común'].includes(t));
  assert.deepStrictEqual(medidos.sort(), Object.keys(RECORRIDOS).sort(),
    'los tramos de journeyTracks.mjs y los de esta tabla han divergido: uno de los dos miente');
  ok('los tramos que mide la radiografía son exactamente los que esta ley cubre');
}

// ── 3. El preflight los corre TODOS (un smoke que nadie corre es un MD) ─────
{
  const pre = read('tools/preflight.mjs');
  for (const r of Object.values(RECORRIDOS)) {
    if (!r.tool) continue;
    assert.ok(pre.includes(r.tool.replace('tools/', '')),
      `tools/preflight.mjs no corre ${r.tool} — desconectado, no protege de nada`);
  }
  assert.ok(pre.includes('tests/run.mjs'), 'el preflight debe correr también la suite');
  ok('el preflight encadena la suite + los 3 recorridos (nadie queda desconectado)');
}

// ── 4. Un recorrido NO se da el veredicto a sí mismo ────────────────────────
// La regla que race-e2e incumplía: llamaba a `submitRaceAttempt` con el
// `correct` ya calculado POR EL TEST, así que probaba el ranking fingiendo
// probar la carrera — y no vio que el móvil daba por fallada una hoja perfecta.
// Un recorrido tiene que TECLEAR y PULSAR; quien decide es la app.
{
  for (const [tramo, r] of Object.entries(RECORRIDOS)) {
    if (!r.tool) continue;
    const src = read(r.tool);
    assert.match(src, /page\.(click|type|fill|tap)|\.click\(|\.type\(|\.fill\(/,
      `${tramo}: ${r.tool} no pulsa ni teclea nada — no está caminando el viaje`);
  }
  ok('los 3 recorridos interactúan de verdad (teclean y pulsan, no llaman a funciones)');
}

// ── 5. Los controles críticos se comprueban con el DEDO, no con querySelector ─
// El botón de pantalla completa existía, se veía a medias y estaba DEBAJO del
// marcador del duelo. `querySelector` decía que sí; el dedo del profe, que no.
{
  const mx = read('tools/matrix-smoke.mjs');
  assert.match(mx, /elementFromPoint/, 'matrix-smoke debe hacer hit-testing real');
  for (const control of ['ww-fs-btn--corner', 'data-ww-submit', 'teams-reveal']) {
    assert.ok(mx.includes(control), `matrix-smoke no comprueba el control «${control}»`);
  }
  ok('los controles de los que depende una clase se verifican con elementFromPoint');

  // Ley §28 (R2b): el escaneo de controles de profe DENTRO del marco de juego
  // sigue conectado. Si alguien lo quita, "no debería tocarlo" vuelve a ser la
  // única defensa contra un dedo curioso con la clase mirando.
  for (const sel of ['.act-del', '.act-edit', '.pub-toggle']) {
    assert.ok(mx.includes(sel), `matrix-smoke perdió el escaneo R2b de «${sel}»`);
  }
  ok('LEY §28-R2b: el escaneo del marco (sin controles de profe) sigue conectado');

  // Cola #3 del norte: la matriz JUEGA una ronda (toque real → la app juzga y
  // el lado avanza), no solo comprueba que monta. Si el driver desaparece, la
  // cobertura de mecánicas vuelve a ser "arranca sin crash", que es lo que dejó
  // pasar los bugs de juego.
  const { MECANICAS } = await import('../tools/helpers/roundDrivers.mjs');
  assert.ok(MECANICAS.length >= 6, `solo ${MECANICAS.length} mecánicas con driver`);
  assert.ok(mx.includes('playRound'), 'matrix-smoke debe JUGAR la ronda, no solo montarla');
  // Los tres modos embebidos, no solo VS: Individual es el más usado de todos.
  for (const modo of ['solo', 'vs', 'teams']) {
    assert.ok(new RegExp(`${modo}:\\s*'#`).test(mx), `matrix-smoke no juega la ronda en «${modo}»`);
  }
  ok(`la matriz JUEGA la ronda en los 3 modos embebidos · ${MECANICAS.length} mecánicas: ${MECANICAS.join(' · ')}`);

  // El ratchet de deuda conocida no puede convertirse en un cajón: cada entrada
  // lleva su motivo, y al arreglar el fallo hay que quitarla o el ratchet tapa
  // el arreglo (misma disciplina que el ratchet de estilos).
  const conocidos = (mx.match(/const CONOCIDOS = \{([\s\S]*?)\};/) || [])[1] || '';
  const entradas = (conocidos.match(/'[^']+\|[^']+':/g) || []).length;
  assert.ok(entradas <= 3, `${entradas} combinaciones marcadas como deuda conocida — el ratchet solo debe ENCOGER`);
  if (entradas) assert.match(conocidos, /CLAUDE\.md|deuda/i, 'cada deuda conocida cita dónde está registrada');
  ok(`deuda de juego conocida y declarada: ${entradas} combinación(es), con su motivo`);
}

// ── 6. CONTRA-PRUEBA: la ley está escrita donde se busca ────────────────────
// Una ley que no se puede citar es una ley huérfana (§6b del norte).
{
  const leyes = read('docs/leyes.md');
  assert.match(leyes, /§27 · VIAJES/, 'la ley §27 debe estar en el índice único de normas');
  assert.match(leyes, /preflight/, 'la ley debe decir QUÉ orden hay que teclear');
  const claude = read('CLAUDE.md');
  assert.match(claude, /preflight/, 'CLAUDE.md debe mandar correr el preflight antes de main');
  ok('CONTRA-PRUEBA: la ley y su orden están escritas en leyes.md y en CLAUDE.md');
}

console.log(`\n  ${passed} journeys checks passed`);
