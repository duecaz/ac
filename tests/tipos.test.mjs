// EL VERIFICADOR NO SE SILENCIA — la red que protege a `tools/typecheck.mjs`.
//
// TypeScript corre como verificador del JavaScript (`jsconfig.json`:
// `checkJs` + `strict` + `noEmit`, sin `.ts`, sin bundler). Un verificador al
// que se le puede tapar la boca no verifica nada: la forma más barata de
// «arreglar» un error es `@ts-ignore` encima, `any` en el JSDoc, `unknown as X`
// o quitar la carpeta del `include`. Todo eso lo cuenta ESTE test, y el
// número solo puede BAJAR (trinquete, §31).
//
// Qué se permite y cómo: `@ts-expect-error` SOLO cuando se está probando a
// propósito que algo no compila (con su motivo escrito en la misma línea); y
// `unknown` en las fronteras (JSON · PocketBase · localStorage · postMessage)
// que luego se ESTRECHA, no se fuerza.
//
// Run: node tests/tipos.test.mjs
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── El código SERVIDO: lo mismo que verifica jsconfig.json ─────────────────
const CARPETAS = ['core', 'kernel', 'templates', 'views', 'adapters'];
function ficherosServidos() {
  const out = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n.endsWith('.js')) out.push(p);
    }
  };
  for (const c of CARPETAS) walk(join(ROOT, c));
  for (const n of readdirSync(ROOT)) if (/^main\..*\.js$/.test(n)) out.push(join(ROOT, n));
  return out.sort();
}

// ── Lo que se cuenta ───────────────────────────────────────────────────────
// Cada patrón es UNA forma de callar al verificador. Se busca en todo el
// fichero (JSDoc incluido, que es donde viven los tipos en JS).
const SILENCIOS = {
  'ts-ignore': /@ts-ignore\b/,
  'ts-nocheck': /@ts-nocheck\b/,
  'eslint-disable': /eslint-disable/,
  // `any` como TIPO: dentro de unas llaves de JSDoc (`{any}`, `{any[]}`,
  // `{Record<string, any>}`, `{(x:any)=>void}`), como argumento genérico
  // (`Promise<any>`) o `as any`. La palabra suelta en un comentario («any
  // tab loads…») no es un tipo y no cuenta.
  'any': /(\{[^{}]*\bany\b[^{}]*\}|<\s*any\s*>|,\s*any\s*>|\bas any\b)/,
  // Forzar un tipo desde `unknown` es mentirle al verificador.
  'unknown-as': /\bunknown\s+as\s+\w/,
};

/** @param {string} src */
export function contarSilencios(src) {
  const hallados = /** @type {Record<string, number[]>} */ ({});
  src.split('\n').forEach((linea, i) => {
    for (const [k, re] of Object.entries(SILENCIOS)) {
      if (re.test(linea)) (hallados[k] ||= []).push(i + 1);
    }
    if (/@ts-expect-error/.test(linea) && !/@ts-expect-error\s+\S.{15,}/.test(linea)) {
      (hallados['expect-error-sin-motivo'] ||= []).push(i + 1);
    }
  });
  return hallados;
}

// TRINQUETE: lo que hay hoy. Solo baja. Cuando llegue a 0 se queda en 0.
const TOPE = { 'ts-ignore': 0, 'ts-nocheck': 0, 'eslint-disable': 0, 'any': 3, 'unknown-as': 0, 'expect-error-sin-motivo': 0 };

{
  const total = /** @type {Record<string, string[]>} */ ({});
  for (const f of ficherosServidos()) {
    const h = contarSilencios(readFileSync(f, 'utf8'));
    for (const [k, lineas] of Object.entries(h)) {
      (total[k] ||= []).push(...lineas.map(l => `${relative(ROOT, f)}:${l}`));
    }
  }
  for (const [k, tope] of Object.entries(TOPE)) {
    const n = (total[k] || []).length;
    assert.ok(n <= tope,
      `«${k}» aparece ${n} veces en el código servido y el tope es ${tope}:\n     ${(total[k] || []).join('\n     ')}\n`
      + '   el verificador no se silencia: se tipa (en la frontera, `unknown` y se estrecha)');
  }
  ok(`sin silenciar el verificador: ${Object.entries(TOPE).map(([k, t]) => `${k} ${(total[k] || []).length}/${t}`).join(' · ')}`);
}

// ── jsconfig.json: el modo es el que es, y las carpetas también ────────────
{
  const cfg = JSON.parse(readFileSync(join(ROOT, 'jsconfig.json'), 'utf8'));
  const co = cfg.compilerOptions || {};
  assert.strictEqual(co.checkJs, true, 'jsconfig.json: checkJs tiene que ser true (si no, tsc no mira el JS)');
  assert.strictEqual(co.strict, true, 'jsconfig.json: strict tiene que ser true, y no se relaja por partes');
  assert.strictEqual(co.noEmit, true, 'jsconfig.json: noEmit — tsc VERIFICA, no compila (no hay paso de build)');
  for (const flag of ['noImplicitAny', 'strictNullChecks', 'strictFunctionTypes', 'strictPropertyInitialization', 'noImplicitThis', 'useUnknownInCatchVariables']) {
    assert.notStrictEqual(co[flag], false, `jsconfig.json: ${flag}:false relaja strict por la puerta de atrás`);
  }
  assert.notStrictEqual(co.skipLibCheck, true, 'jsconfig.json: skipLibCheck esconde problemas propios (los .d.ts son de DOM/ES, no hay libs ajenas)');
  const inc = cfg.include || [];
  for (const c of [...CARPETAS.map(c => `${c}/**/*.js`), 'main.*.js']) {
    assert.ok(inc.includes(c), `jsconfig.json: falta «${c}» en include — excluir una carpeta es la forma más grande de silenciar`);
  }
  const exc = (cfg.exclude || []).filter(e => !/node_modules|supabase/.test(e));
  assert.deepStrictEqual(exc, [], `jsconfig.json: exclude añade carpetas propias: ${exc.join(' · ')}`);
  ok('jsconfig.json: checkJs + strict + noEmit, las cinco carpetas y main.*.js dentro, nada propio excluido');
}

// ── CONTRA-PRUEBA: la red ve cada silencio plantado a propósito ────────────
{
  const plantado = [
    '// @ts-ignore',
    '// @ts-nocheck',
    '/* eslint-disable */',
    '/** @param {any} x */',
    '/** @type {Record<string, any>} */',
    'const y = /** @type {unknown} */ (z);', // legítimo: no cuenta
    'const w = (v) => /** @type {Foo} */ (/** @type {unknown} */ (v));', // legítimo
    'foo(x as any)',
    '// @ts-expect-error', // sin motivo
    '// @ts-expect-error se prueba que un scorer sin `total` no compila (tests/tipos)', // con motivo: no cuenta
    'const u = unknown as Foo',
  ].join('\n');
  const h = contarSilencios(plantado);
  assert.deepStrictEqual(h['ts-ignore'], [1]);
  assert.deepStrictEqual(h['ts-nocheck'], [2]);
  assert.deepStrictEqual(h['eslint-disable'], [3]);
  assert.deepStrictEqual(h['any'], [4, 5, 8]);
  assert.deepStrictEqual(h['expect-error-sin-motivo'], [9]);
  assert.deepStrictEqual(h['unknown-as'], [11]);
  const limpio = contarSilencios('/** @param {unknown} raw @returns {Activity|null} */\nconst any1 = 3; // "anyway" no es un tipo\nconst company = 1;');
  assert.deepStrictEqual(limpio, {}, 'las palabras que contienen «any» sin ser un tipo no cuentan');
  ok('CONTRA-PRUEBA: seis silencios plantados, seis vistos; `unknown` estrechado y las palabras sueltas, ni uno');
}

console.log(`\n  ${passed} tipos checks passed`);
