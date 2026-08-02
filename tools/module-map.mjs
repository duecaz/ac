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

const arrows = [...edges].sort((a, b) => b[1] - a[1]).map(([k, n]) => {
  const [from, to] = k.split('→');
  return `  ${ID[from]} -->|${n}| ${ID[to]}`;
}).join('\n');

const nodes = ORDER.map(l => `  ${ID[l]}["<b>${l}</b><br/><small>${WHAT[l]}</small><br/><small>${byLayer.get(l).length} módulos</small>"]`).join('\n');

const top = (l, n = 5) => byLayer.get(l).sort((a, b) => b.lines - a.lines).slice(0, n)
  .map(x => `\`${x.f}\` (${x.lines})`).join(' · ') || '—';

const most = [...fanIn].sort((a, b) => b[1] - a[1]).slice(0, 10)
  .map(([f, n]) => `| \`${f}\` | ${n} |`).join('\n');

const md = `# Mapa de módulos — GENERADO, no editar a mano

> Lo produce \`node tools/module-map.mjs\` del grafo de imports REAL del repo.
> Si editas este archivo a mano, el siguiente \`node tests/run.mjs\` lo revierte
> (la suite \`layers\` comprueba que está al día). Para cambiar el dibujo, cambia
> el código — que es justo el punto.
>
> **${g.files.length} módulos · ${g.edges.length} imports internos.**

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
