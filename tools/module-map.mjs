#!/usr/bin/env node
// EL DIAGRAMA DE LA ARQUITECTURA, GENERADO DEL CÓDIGO.
//
//   node tools/module-map.mjs           → escribe docs/arquitectura-modulos.md
//   node tools/module-map.mjs --check   → falla si el doc no está al día (CI)
//
// Por qué generado y no dibujado: un diagrama a mano envejece en silencio y
// acaba mintiendo — que es peor que no tenerlo. Este sale del MISMO grafo de
// imports que valida `tests/layers.test.mjs`, así que si el dibujo y el código
// discrepan, CI lo dice.
import { writeFileSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildGraph, layerEdges, layerOf, ROOT } from '../tests/helpers/importGraph.mjs';
import { EXCEPTIONS } from '../tests/helpers/layerRules.mjs';
import { PB_OWNERS } from '../core/normsCheck.js';
import { RULES, AUTH } from '../core/pbRules.js';
import { trackOf, testTrackOf, TRACK_ORDER, TRACK_USE } from '../tests/helpers/journeyTracks.mjs';
import { docTable } from './docmap.mjs';
import { readdirSync } from 'node:fs';

const OUT = join(ROOT, 'docs', 'arquitectura-modulos.md');

// Orden de arriba (lo que sabe de todo) a abajo (lo que no sabe de nadie).
const ORDER = ['arranque', 'vistas', 'adaptadores', 'core', 'kernel', 'plantillas', 'contenido', 'config'];
const WHAT = {
  arranque:    'cablea cada página (main.*.js, sw.js)',
  vistas:      'el chrome: navegación, setup, informes',
  adaptadores: 'el transporte: PocketBase | local',
  core:        'el arreglo social (modos, shells) + utilidades',
  kernel:      'el motor de sesión: cuándo se liquida',
  plantillas:  'UNA mecánica: scorer + render + meta.play',
  contenido:   'modelos y migración del JSON del usuario',
  config:      'solo datos',
};
const ID = { arranque: 'A', vistas: 'V', adaptadores: 'AD', core: 'C', kernel: 'K', plantillas: 'T', contenido: 'CO', config: 'CF' };

const g = buildGraph();
const edges = layerEdges(g);

// Los módulos más grandes de cada capa: dónde se acumula el riesgo.
const byLayer = new Map(ORDER.map(l => [l, []]));
for (const f of g.files) {
  const lines = readFileSync(join(ROOT, f), 'utf8').split('\n').length;
  byLayer.get(layerOf(f))?.push({ f, lines });
}
const fanIn = new Map();
for (const e of g.edges) fanIn.set(e.to, (fanIn.get(e.to) || 0) + 1);

// Una arista puede existir SOLO por excepciones sancionadas (core→vistas es todo
// `import()` dinámico). Se dibujan punteadas: de un vistazo se ve qué está
// torcido a propósito y qué es la estructura de verdad.
const exceptional = new Map();
for (const e of g.edges) {
  if (e.fromLayer === e.toLayer) continue;
  const k = `${e.fromLayer}→${e.toLayer}`;
  const isExc = EXCEPTIONS.has(`${e.from}→${e.to}`);
  const prev = exceptional.get(k);
  exceptional.set(k, prev === undefined ? isExc : (prev && isExc));
}
const arrows = [...edges].sort((a, b) => b[1] - a[1]).map(([k, n]) => {
  const [from, to] = k.split('→');
  return exceptional.get(k)
    ? `  ${ID[from]} -.->|${n} · excepción| ${ID[to]}`
    : `  ${ID[from]} -->|${n}| ${ID[to]}`;
}).join('\n');

const nodes = ORDER.map(l => `  ${ID[l]}["<b>${l}</b><br/><small>${WHAT[l]}</small><br/><small>${byLayer.get(l).length} módulos</small>"]`).join('\n');

const top = (l, n = 5) => byLayer.get(l).sort((a, b) => b.lines - a.lines).slice(0, n)
  .map(x => `\`${x.f}\` (${x.lines})`).join(' · ') || '—';

const most = [...fanIn].sort((a, b) => b[1] - a[1]).slice(0, 10)
  .map(([f, n]) => `| \`${f}\` | ${n} |`).join('\n');

// ── Mapa de DATOS: cada colección, su dueño (§21) y quién puede escribirla (§22)
const dataRows = Object.entries(PB_OWNERS).map(([coll, owners]) => {
  const r = RULES[coll];
  const create = r?.createRule;
  const who = create == null ? '**nadie** (cerrado por API)'
    : create === '' ? 'cualquiera, sin cuenta'
    : create === AUTH ? 'solo con sesión de profe'
    : create.includes('live_claims') ? 'el alumno, **atado a su dispositivo** (§22-4)'
    : create.includes('owner') ? 'con sesión, y solo como dueño'
    : create.includes(AUTH) ? 'con sesión, o el alumno bajo condiciones'
    : 'regla propia (ver `core/pbRules.js`)';
  const dueño = owners.filter(o => o !== 'views/adminView.js');
  return `| \`${coll}\` | ${dueño.map(o => `\`${o}\``).join(' · ') || '—'} | ${who} |`;
}).join('\n');

// ── Los módulos MÁS GRANDES del repo. No es una métrica de calidad: es la lista
// de candidatos a partir, y donde han caído las regresiones (hostLive concentra
// lobby + 4 bucles + podio + tabla + CSV).
const hot = g.files.map(f => ({
  f, lines: readFileSync(join(ROOT, f), 'utf8').split('\n').length, fan: fanIn.get(f) || 0,
})).sort((a, b) => b.lines - a.lines).slice(0, 8)
  .map(x => `| \`${x.f}\` | ${x.lines} | ${x.fan} |`).join('\n');

// ── EL ESFUERZO POR TRAMO DEL VIAJE (docs/norte.md §1) ─────────────────────
// La foto que faltaba: tamaño y fan-in son neutros, y por eso no avisaban de que
// el modo MINORITARIO (en vivo) tenía ocho veces más cobertura que el tramo por
// el que pasa TODA clase (buscar/crear).
const lineCount = (f) => readFileSync(join(ROOT, f), 'utf8').split('\n').length;
const codeByTrack = {}, testByTrack = {};
for (const f of g.files) {
  const t = trackOf(f);
  (codeByTrack[t] ??= { n: 0, lines: 0 });
  codeByTrack[t].n++; codeByTrack[t].lines += lineCount(f);
}
for (const suite of readdirSync(join(ROOT, 'tests')).filter(x => x.endsWith('.test.mjs'))) {
  const t = testTrackOf(suite);
  (testByTrack[t] ??= { n: 0, lines: 0 });
  testByTrack[t].n++; testByTrack[t].lines += lineCount(join('tests', suite));
}
const trackRows = TRACK_ORDER.map(t => {
  const c = codeByTrack[t] || { n: 0, lines: 0 }, v = testByTrack[t] || { n: 0, lines: 0 };
  const ratio = c.lines ? (v.lines / c.lines) : 0;
  return `| **${t}** | ${TRACK_USE[t]} | ${c.n} · ${c.lines} | ${v.n} · ${v.lines} | ${ratio.toFixed(2)} |`;
}).join('\n');

const md = `# Mapa de módulos — GENERADO, no editar a mano

> Lo produce \`node tools/module-map.mjs\` del grafo de imports REAL del repo.
> Si editas este archivo a mano, el siguiente \`node tests/run.mjs\` lo revierte
> (la suite \`layers\` comprueba que está al día). Para cambiar el dibujo, cambia
> el código — que es justo el punto.
>
> **${g.files.length} módulos · ${g.edges.length} imports internos.**

### Ir a otro documento

${docTable('docs/arquitectura-modulos.md')}

## Dónde está el esfuerzo, y dónde pasa el profesor

La pregunta que ninguna métrica neutra puede responder: **¿el código y los tests
están donde el profe pasa?** El uso de cada tramo sale de la escena real
(\`docs/norte.md\` §1); el reparto, del repo.

| Tramo del viaje | Cuánto se usa | Módulos · líneas | Suites · líneas | Test/código |
|---|---|---|---|---|
${trackRows}

> Un ratio bajo en un tramo muy usado es deuda de PRIORIDAD, no de calidad: ese
> código funciona, pero si se rompe nadie se entera hasta que hay 33 críos
> delante. El mapeo módulo→tramo está declarado en
> \`tests/helpers/journeyTracks.mjs\` — explícito y revisable, no adivinado.

## Las capas y cómo dependen unas de otras

Cada flecha va de quien importa a quien es importado, con cuántos imports hay.
La dirección legítima es siempre hacia abajo: **lo de arriba sabe de lo de
abajo, nunca al revés** (ley §0). Lo vigila \`tests/layers.test.mjs\`.

\`\`\`mermaid
graph TD
${nodes}
${arrows}
\`\`\`

## Qué puede importar cada capa

| Capa | Puede importar | PROHIBIDO |
|---|---|---|
| **contenido** | core · kernel | plantillas · vistas · adaptadores |
| **plantillas** | core · contenido · kernel | vistas · adaptadores (una plantilla no sabe en qué modo corre) |
| **kernel** | core · contenido · config | vistas · adaptadores · plantillas concretas (el motor es puro) |
| **core** | kernel · contenido · config | vistas (salvo \`import()\` dinámico al montar un modo) · adaptadores concretos (solo la fachada \`adapters/index.js\`) |
| **adaptadores** | core · kernel · contenido · config | vistas · plantillas |
| **vistas** | todo lo de abajo | — |
| **config** | nada | es un fichero de datos |

## Dónde se acumula el tamaño (líneas)

| Capa | Módulos más grandes |
|---|---|
${ORDER.map(l => `| **${l}** | ${top(l)} |`).join('\n')}

## Los módulos más importados (fan-in)

Un cambio aquí toca a mucha gente: son los que más test necesitan.

| Módulo | Lo importan |
|---|---|
${most}

## Los módulos más grandes (candidatos a partir)

El tamaño no es un defecto por sí solo, pero es donde han caído las regresiones:
\`views/hostLive.js\` concentra lobby + los cuatro bucles + podio + tabla + CSV.

| Módulo | Líneas | Lo importan |
|---|---|---|
${hot}

## El mapa de DATOS: quién escribe cada colección

Ley §21 (una colección, un dueño) y §22 (quién puede escribir, según las reglas
REALES de \`core/pbRules.js\`). El panel \`views/adminView.js\` no se lista: es el
dueño del ESQUEMA y por eso las nombra todas.

| Colección | Módulo dueño | Quién puede CREAR |
|---|---|---|
${dataRows}

> Un módulo que necesite datos no hace fetch a la colección: **le pide un método
> al dueño**. Lo vigila la regla \`pb-dueno\` de \`tests/norms.test.mjs\`.
`;

if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(OUT, 'utf8'); } catch { /* no existe todavía */ }
  if (current !== md) {
    console.error('❌ docs/arquitectura-modulos.md NO está al día con el código.');
    console.error('   Corre: node tools/module-map.mjs');
    process.exit(1);
  }
  console.log('✅ el mapa de módulos coincide con el código');
} else {
  writeFileSync(OUT, md);
  console.log(`✅ escrito ${OUT} (${g.files.length} módulos, ${g.edges.length} imports)`);
}
