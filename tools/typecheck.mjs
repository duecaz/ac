#!/usr/bin/env node
// TYPECHECK — TypeScript como VERIFICADOR del JavaScript que ya hay.
//
//   node tools/typecheck.mjs            → 0 errores o sale con código 1
//   node tools/typecheck.mjs --foto     → además, el recuento por capa y por código
//
// Qué es y qué NO es. El proyecto sigue siendo JavaScript plano con módulos ES:
// no hay `.ts`, no hay bundler, no hay paso de compilación, GitHub Pages sirve
// los mismos ficheros que hay en el repo. `jsconfig.json` tiene `checkJs:true`
// + `strict` + `noEmit`: `tsc` LEE los JSDoc y los tipos que infiere, y avisa
// de lo que no cuadra (una propiedad que no existe, un `null` que no se
// comprobó, dos adaptadores con distinta firma). No produce nada.
//
// Por qué aquí y no en un `package.json`: el repo no es una app de npm y no
// hace falta que lo sea. `tsc` se busca en el PATH (o en `WW_TSC`) y, si no
// está, se dice cómo instalarlo — no se descarga nada en silencio.
//
// El vocabulario de tipos vive en `kernel/contracts/*.js` (JSDoc `@typedef`,
// un dueño por concepto). La red que impide silenciar el verificador
// (`@ts-ignore` · `@ts-nocheck` · `any` · relajar `jsconfig.json`) es
// `tests/tipos.test.mjs`. Esto corre en `tools/preflight.mjs` (paso `tipos`).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const foto = process.argv.includes('--foto');

function localizarTsc() {
  if (process.env.WW_TSC && existsSync(process.env.WW_TSC)) return process.env.WW_TSC;
  const candidatos = [
    join(ROOT, 'node_modules', '.bin', 'tsc'),
    '/opt/node22/bin/tsc',
    '/usr/local/bin/tsc',
    '/usr/bin/tsc',
  ];
  for (const c of candidatos) if (existsSync(c)) return c;
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['tsc'], { encoding: 'utf8' });
  const hallado = (which.stdout || '').split(/\r?\n/).find(Boolean);
  return hallado || null;
}

const tsc = localizarTsc();
if (!tsc) {
  console.error('typecheck: no encuentro `tsc`. Instálalo una vez (`npm i -g typescript`) o apunta WW_TSC al binario.');
  process.exit(3);
}

const r = spawnSync(tsc, ['-p', 'jsconfig.json', '--pretty', 'false'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const lineas = `${r.stdout || ''}${r.stderr || ''}`.split(/\r?\n/);
const errores = lineas
  .map(l => l.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/))
  .filter(Boolean)
  .map(m => ({ file: m[1].replace(/\\/g, '/'), line: +m[2], code: m[4], msg: m[5] }));

const capa = (f) => {
  if (f.startsWith('kernel/contracts')) return 'kernel/contracts';
  if (f.startsWith('kernel/content')) return 'kernel/content';
  if (f.startsWith('kernel/session')) return 'kernel/session';
  if (f.startsWith('kernel/')) return 'kernel';
  if (f.startsWith('adapters/')) return 'adapters';
  if (f.startsWith('templates/')) return 'templates';
  if (f.startsWith('views/')) return 'views';
  if (f.startsWith('main.')) return 'main.*';
  if (f.startsWith('core/')) return 'core';
  return 'otros';
};
const contar = (arr, k) => {
  const m = new Map();
  for (const r of arr) m.set(k(r), (m.get(k(r)) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

if (errores.length === 0 && r.status === 0) {
  console.log('typecheck: 0 errores (tsc, checkJs + strict, sin emitir nada)');
  process.exit(0);
}

if (foto) {
  console.log(`typecheck: ${errores.length} errores en ${new Set(errores.map(e => e.file)).size} ficheros\n`);
  console.log('POR CAPA');
  for (const [k, v] of contar(errores, e => capa(e.file))) {
    const n = new Set(errores.filter(e => capa(e.file) === k).map(e => e.file)).size;
    console.log(`  ${String(v).padStart(5)}  ${k}  (${n} ficheros)`);
  }
  console.log('\nPOR CÓDIGO');
  for (const [k, v] of contar(errores, e => e.code).slice(0, 15)) {
    console.log(`  ${String(v).padStart(5)}  ${k}  ${errores.find(e => e.code === k).msg.slice(0, 80)}`);
  }
  console.log('\nTOP 20 FICHEROS');
  for (const [k, v] of contar(errores, e => e.file).slice(0, 20)) console.log(`  ${String(v).padStart(5)}  ${k}`);
} else {
  for (const e of errores) console.log(`${e.file}:${e.line} ${e.code} ${e.msg}`);
  if (!errores.length) console.log(lineas.filter(Boolean).join('\n'));
  console.log(`\ntypecheck: ${errores.length} errores en ${new Set(errores.map(e => e.file)).size} ficheros (node tools/typecheck.mjs --foto para el desglose)`);
}
process.exit(1);
