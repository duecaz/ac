#!/usr/bin/env node
// LOS CUADROS DE LA DOCUMENTACIÓN, GENERADOS DEL CÓDIGO.
//
//   node tools/docgen.mjs            → reescribe los bloques GENERADO de los MD
//   node tools/docgen.mjs --check    → falla si algún bloque no está al día (CI)
//
// POR QUÉ. El cuadro de los bucles en vivo estaba copiado a mano en CLAUDE.md,
// docs/leyes.md §26 y docs/modos-de-juego.md §9.4 — y divergió: los tres decían
// que el TABLERO puntúa plano cuando en realidad Ordena las Pelotas tiene su
// propia escala 0-1000. Hubo que corregirlo en tres sitios. Predicamos "si es
// norma, es test" y luego manteníamos las normas a mano.
//
// Ahora cada cuadro sale de su MÓDULO DUEÑO (`core/liveLoops.js`,
// `core/modes.js`, `core/persistPolicy.js`, el registro de plantillas) y se
// escribe entre marcadores:
//
//   <!-- GENERADO:bucles --> … <!-- /GENERADO:bucles -->
//
// Fuera de los marcadores el texto es tuyo y no se toca.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
await import(join(ROOT, 'core/registerTemplates.js'));
const { listTemplates } = await import(join(ROOT, 'core/registry.js'));
const { LIVE_LOOPS, LOOP_LABELS, LOOP_POINTS, LOOP_PHASE, loopsOf, pointsModeFor } =
  await import(join(ROOT, 'core/liveLoops.js'));
const { MODE_DEFS } = await import(join(ROOT, 'core/modes.js'));
const { PERSIST } = await import(join(ROOT, 'core/persistPolicy.js'));
const { docTable, anchorOf } = await import(join(ROOT, 'tools/docmap.mjs'));

const templates = listTemplates();
const nameOf = (t) => t?.meta?.label || t?.meta?.name;

// ── Bloque `bucles`: los cuatro bucles en vivo (ley §26) ───────────────────
function bucles() {
  const rows = LIVE_LOOPS.map(l => {
    const L = LOOP_LABELS[l];
    const who = templates.filter(t => loopsOf(t).includes(l)).map(nameOf).sort();
    return `| \`${l}\` · ${L.label} | \`${LOOP_PHASE[l]}\` | ${L.advance} | ${L.win} | ${LOOP_POINTS[l]} | ${L.ends} | ${who.join(' · ') || '—'} |`;
  });
  return [
    '| Bucle | Fase | Quién avanza | **Cómo se gana** | Puntos | Fin | Plantillas que lo declaran |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
    `> Generado de \`core/liveLoops.js\` + \`meta.play.live\` de las ${templates.length} plantillas.`,
    `> El modelo de puntos lo decide \`pointsModeFor(loop)\`: `
      + LIVE_LOOPS.map(l => `\`${l}\`→\`${pointsModeFor(l)}\``).join(' · ') + '.',
  ].join('\n');
}

// ── Bloque `modos`: los cinco modos y qué persiste cada uno ────────────────
function modos() {
  const PERSIST_TXT = {
    solo: '`results`', 'async-tracked': '`assignment_attempts`', 'live-student': '`live_answers`',
    vs: 'nada (por diseño)', teams: 'nada (por diseño)',
  };
  // El id del modo en MODE_DEFS y la clave de la política no siempre coinciden:
  // la política habla del ESCRITOR (el alumno en live, el contenedor en tarea).
  const KEY = { solo: 'solo', vs: 'vs', teams: 'teams', live: 'live-student', task: 'async-tracked' };
  // Un id de modo sin política declarada es un fallo de datos, no una celda vacía.
  for (const m of MODE_DEFS) {
    if (!PERSIST[KEY[m.id] || m.id]) {
      console.error(`❌ el modo '${m.id}' no tiene política en core/persistPolicy.js`);
      process.exit(1);
    }
  }
  const rows = MODE_DEFS.map(m => {
    const k = KEY[m.id] || m.id;
    const p = PERSIST[k] || {};
    return `| **${m.label}** | ${m.embed ? 'esta pantalla (embebido)' : 'página propia'} `
      + `| ${PERSIST_TXT[k] || '—'} | ${m.writes ? `sí — ${m.hostAction}` : 'no'} |`;
  });
  return [
    '| Modo | Pantalla | Persiste | ¿Necesita sesión de profe? |',
    '|---|---|---|---|',
    ...rows,
    '',
    '> Generado de `core/modes.js` (`MODE_DEFS`) + `core/persistPolicy.js`.',
    '> Ningún modo escribe en dos sitios a la vez: lo vigila `tests/persistPolicy.test.mjs`.',
  ].join('\n');
}

// ── Bloque `nav`: el índice DEL PROPIO documento + el mapa de docs ─────────
// Depende del archivo donde se inserta, así que se calcula por destino. En un
// documento de 400 líneas leído en el móvil, sin índice no se encuentra nada.

// El mapa de documentos y el algoritmo de anclas viven en `tools/docmap.mjs`
// porque los comparte el generador del diagrama (`tools/module-map.mjs`).

function nav(file, src) {
  // Índice: los ## y ### del propio documento. Se leen SIN los bloques
  // generados: si no, el propio "### Ir a otro documento" entraría en el índice
  // y cada pasada añadiría una línea más (el generador dejaría de ser idempotente
  // y `--check` fallaría eternamente).
  const clean = src.replace(/<!-- GENERADO:[\w-]+ -->[\s\S]*?<!-- \/GENERADO:[\w-]+ -->/g, '');
  const heads = [...clean.matchAll(/^(##{1,2}) +(.+)$/gm)]
    .map(m => ({ depth: m[1].length, text: m[2].trim() }))
    .filter(h => !/^Índice/i.test(h.text));
  const toc = heads.map(h => `${'  '.repeat(h.depth - 2)}- [${h.text.replace(/\*\*/g, '')}](#${anchorOf(h.text)})`).join('\n');
  return [
    '### Índice de este documento', '', toc, '',
    '### Ir a otro documento', '', docTable(file),
  ].join('\n');
}

const BLOCKS = { bucles: bucles(), modos: modos() };
const TARGETS = ['CLAUDE.md', 'docs/leyes.md', 'docs/modos-de-juego.md', 'docs/norte.md',
  'docs/decisiones-pendientes.md', 'docs/testing.md', 'docs/estudio-bucles-live.md'];

let stale = [];
for (const rel of TARGETS) {
  const file = join(ROOT, rel);
  const src = readFileSync(file, 'utf8');
  let out = src;
  for (const [name, body] of Object.entries({ ...BLOCKS, nav: nav(rel, src) })) {
    const re = new RegExp(`(<!-- GENERADO:${name} -->)[\\s\\S]*?(<!-- /GENERADO:${name} -->)`, 'g');
    out = out.replace(re, `$1\n${body}\n$2`);
  }
  if (out === src) continue;
  if (process.argv.includes('--check')) stale.push(rel);
  else { writeFileSync(file, out); console.log(`✅ actualizado ${rel}`); }
}

if (process.argv.includes('--check')) {
  if (stale.length) {
    console.error(`❌ cuadros desactualizados en: ${stale.join(', ')}\n   Corre: node tools/docgen.mjs`);
    process.exit(1);
  }
  console.log('✅ los cuadros generados coinciden con el código');
} else if (!process.argv.includes('--check')) {
  console.log('Listo. Los bloques fuera de los marcadores no se han tocado.');
}
