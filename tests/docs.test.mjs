// LA DOCUMENTACIÓN QUE SE PUEDE VERIFICAR, SE VERIFICA.
//
// "Si es norma, es test" — y luego los cuadros de las normas se mantenían a
// mano. El de los bucles en vivo estaba copiado en CLAUDE.md, docs/leyes.md §26
// y docs/modos-de-juego.md §9.4, y los TRES decían que el tablero puntúa plano
// cuando Ordena las Pelotas tiene su propia escala 0-1000. Hubo que corregirlo
// en tres sitios (v1.51.354): eso es la definición de duplicación con coste.
//
// Ahora esos cuadros salen de su módulo dueño (`tools/docgen.mjs`) y aquí se
// comprueba que están al día. Igual que el mapa de módulos.
//
// Run: node tests/docs.test.mjs
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const run = (args) => execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });

// ── 1. Los cuadros generados coinciden con el código ────────────────────────
{
  let out = '';
  try {
    out = run(['tools/docgen.mjs', '--check']);
  } catch (e) {
    assert.fail(`Cuadros desactualizados — corre \`node tools/docgen.mjs\`\n${e.stdout || ''}${e.stderr || ''}`);
  }
  assert.match(out, /coinciden con el código/);
  ok('los cuadros de CLAUDE.md · leyes.md · modos-de-juego.md salen del código y están al día');
}

// ── 2. Los marcadores siguen puestos (nadie borró un bloque al editar) ──────
// Sin marcadores, `docgen --check` pasaría trivialmente: no habría nada que
// comparar y la duplicación volvería sin que CI dijera nada.
{
  const EXPECTED = {
    'CLAUDE.md': ['bucles', 'modos'],
    'docs/leyes.md': ['bucles'],
    'docs/modos-de-juego.md': ['bucles', 'modos'],
  };
  for (const [file, blocks] of Object.entries(EXPECTED)) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    for (const b of blocks) {
      assert.ok(src.includes(`<!-- GENERADO:${b} -->`) && src.includes(`<!-- /GENERADO:${b} -->`),
        `${file} perdió el bloque GENERADO:${b} — sin marcadores, el cuadro vuelve a mantenerse a mano`);
    }
  }
  ok('los 5 bloques generados siguen declarados en sus 3 documentos');
}

// ── 3. CONTRA-PRUEBA: si el código cambia y el MD no, CI lo dice ────────────
// Un generador que no puede fallar no protege de nada. Se simula el cambio
// EDITANDO el cuadro (equivalente a que el código diga otra cosa) y se
// comprueba que `--check` lo detecta; luego se restaura.
{
  const file = join(ROOT, 'CLAUDE.md');
  const original = readFileSync(file, 'utf8');
  try {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(file, original.replace('| `board` · Tablero |', '| `board` · Tablero MENTIRA |'));
    let detected = false;
    try { run(['tools/docgen.mjs', '--check']); } catch { detected = true; }
    assert.ok(detected, 'un cuadro tocado a mano DEBE romper CI');
    ok('CONTRA-PRUEBA: editar un cuadro a mano rompe la comprobación');
  } finally {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(file, original);
  }
}

console.log(`\n  ${passed} docs checks passed`);
