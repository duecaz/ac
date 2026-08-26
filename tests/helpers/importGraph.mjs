// EL GRAFO DE IMPORTS DEL REPO — una sola lectura, dos consumidores.
//
// Lo usan `tests/layers.test.mjs` (¿algún módulo importa hacia arriba?) y
// `tools/module-map.mjs` (genera el diagrama de docs/arquitectura-modulos.md).
// Que salgan del MISMO grafo es el punto: el diagrama no puede envejecer,
// porque se regenera del código y el test falla si el código lo contradice.
//
// Módulo puro de Node (fs + path), sin dependencias.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, relative, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Se escanea el CÓDIGO DE LA APP. Fuera: pruebas, herramientas, documentación y
// lo que no es JS del repo (los tests sí pueden importar lo que quieran: son el
// observador, no una capa).
// `vendor/` fuera: es código de terceros copiado tal cual (ver vendor/README.md).
// Sin esto, el bundle de Bootstrap entraba en el grafo de capas de la §0 como si
// fuera un módulo nuestro de la capa «arranque», y el mapa generado pasó de 268 a
// 270 módulos sin que nadie hubiera escrito una línea.
const SKIP_DIRS = new Set(['node_modules', '.git', 'docs', 'scratchpad', 'tests', 'tools', 'themes', 'styles', 'assets', 'vendor']);

export function appFiles(root = ROOT) {
  const out = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.js')) out.push(relative(root, p).split('\\').join('/'));
    }
  })(root);
  return out.sort();
}

/** Capa de un fichero por su ruta. El orden importa: `kernel/content` antes que
 *  `kernel`, porque el contenido es una capa propia (§0). */
export function layerOf(file) {
  const p = String(file).split('\\').join('/');
  if (p.startsWith('kernel/content/')) return 'contenido';
  if (p.startsWith('kernel/')) return 'kernel';
  if (p.startsWith('templates/')) return 'plantillas';
  if (p.startsWith('core/')) return 'core';
  if (p.startsWith('adapters/')) return 'adaptadores';
  if (p.startsWith('views/')) return 'vistas';
  if (p.endsWith('.config.js')) return 'config';   // pocketbase.config.js: solo datos
  return 'arranque';        // main.*.js, sw.js — el cableado de cada página
}

/** Especificadores relativos de un fichero, resueltos a ruta de repo. */
export function importsOf(file, root = ROOT) {
  const src = readFileSync(join(root, file), 'utf8');
  const out = [];
  // `from '…'` cubre import y re-export; `import('…')` cubre el dinámico (que en
  // este repo es como se cargan las vistas y las plantillas: si no se mirara, el
  // grafo diría que las vistas no dependen de nadie).
  for (const re of [/\bfrom\s+['"]([^'"]+)['"]/g, /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g]) {
    for (const m of src.matchAll(re)) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue;              // solo módulos del repo
      out.push(normalize(join(dirname(file), spec)).split('\\').join('/'));
    }
  }
  return [...new Set(out)];
}

/** `{ files, edges }` — `edges`: `{ from, to, fromLayer, toLayer }` por import. */
export function buildGraph(root = ROOT) {
  const files = appFiles(root);
  const edges = [];
  for (const f of files) {
    for (const to of importsOf(f, root)) {
      edges.push({ from: f, to, fromLayer: layerOf(f), toLayer: layerOf(to) });
    }
  }
  return { files, edges };
}

/** Aristas agregadas entre capas: `Map('a→b' → nº de imports)`. */
export function layerEdges(graph) {
  const m = new Map();
  for (const e of graph.edges) {
    if (e.fromLayer === e.toLayer) continue;
    const k = `${e.fromLayer}→${e.toLayer}`;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}
