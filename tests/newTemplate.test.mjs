// Self-test del GENERADOR (tools/new-template.mjs): genera una plantilla en un
// directorio scratch (FUERA de templates/ — el contract-test recorre esa carpeta
// y detectaría la temporal como "no registrada") y corre sobre lo emitido los
// MISMOS checkers del contrato y las normas. Si el contrato crece y el generador
// se queda viejo, esto falla — el esqueleto no puede pudrirse en silencio.
// Run: node tests/newTemplate.test.mjs
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { checkTemplateContract } from '../core/templateContract.js';
import { scanNormsSource } from '../core/normsCheck.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GEN = join(ROOT, 'tools', 'new-template.mjs');
const scratch = mkdtempSync(join(tmpdir(), 'ww-newtpl-'));

function generate(name, args) {
  const out = join(scratch, name);
  const r = spawnSync(process.execPath, [GEN, name, '--out', out, ...args], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `generador falló para ${name}:\n${r.stdout}\n${r.stderr}`);
  return out;
}

async function verify(name, dir, { expectRound }) {
  for (const f of ['template.js', 'player.js', 'editor.js', 'scorer.js', 'index.js', `${name}.css`]) {
    assert.ok(existsSync(join(dir, f)), `${name}: falta ${f}`);
  }
  // Contrato COMPLETO sobre la clase real emitida (import dinámico del scratch —
  // los imports relativos del esqueleto se calculan respecto a --out, así que
  // resuelven al repo aunque la carpeta viva fuera de él).
  const mod = await import(pathToFileURL(join(dir, 'template.js')).href);
  const T = Object.values(mod)[0];
  const issues = checkTemplateContract(T);
  assert.deepStrictEqual(issues, [], `${name} incumple el contrato:\n  - ${issues.join('\n  - ')}`);
  assert.strictEqual(typeof T.renderRound === 'function', expectRound,
    `${name}: renderRound ${expectRound ? 'esperado con --vs' : 'NO debe emitirse sin --vs (plantilla a medias en VS)'}`);
  // Normas sobre cada fuente emitido.
  const norms = readdirSync(dir).filter(f => f.endsWith('.js'))
    .flatMap(f => scanNormsSource(`templates/${name}/${f}`, readFileSync(join(dir, f), 'utf8')));
  assert.deepStrictEqual(norms, [], `${name} viola normas: ${norms.map(v => `[${v.rule}] ${v.path}:${v.line}`).join(' · ')}`);
  // CSS: tokenizado y sin fuentes congeladas (contrato de estilos, versión mínima).
  const css = readFileSync(join(dir, `${name}.css`), 'utf8');
  assert.ok(css.includes('var(--ww-'), `${name}.css sin tokens var(--ww-*)`);
  assert.ok(!/font-size:\s*[\d.]+(px|rem)\s*[;}]/.test(css), `${name}.css con font-size congelada`);
}

try {
  // 1) Default = SOLO-Individual: sin renderRound (no aparece en VS/Equipos a medias).
  const d1 = generate('demo-solo', ['--model', 'qa']);
  await verify('demo-solo', d1, { expectRound: false });
  ok('esqueleto default (solo-Individual): contrato + normas + CSS en verde, sin renderRound');

  // 2) Variante completa: --vs --live --shell freeform sobre pairs.
  const d2 = generate('demo-full', ['--model', 'pairs', '--shell', 'freeform', '--vs', '--live']);
  await verify('demo-full', d2, { expectRound: true });
  ok('esqueleto --vs --live (freeform/pairs): contrato + normas + CSS en verde, con ronda');

  // 3) Con --out el generador NO toca el registro del repo.
  const reg = readFileSync(join(ROOT, 'core', 'registerTemplates.js'), 'utf8');
  assert.ok(!reg.includes('demo-solo') && !reg.includes('demo-full'), '--out no debe editar registerTemplates.js');
  ok('--out no muta el repo (registerTemplates intacto)');

  // 4) Guardas del CLI: nombre inválido y modelo no registrado fallan con exit≠0.
  assert.notStrictEqual(spawnSync(process.execPath, [GEN, 'Mal_Nombre', '--out', join(scratch, 'x')], { encoding: 'utf8' }).status, 0);
  assert.notStrictEqual(spawnSync(process.execPath, [GEN, 'ok-name', '--model', 'inventado', '--out', join(scratch, 'y')], { encoding: 'utf8' }).status, 0);
  assert.notStrictEqual(spawnSync(process.execPath, [GEN, 'demo-solo', '--out', d1], { encoding: 'utf8' }).status, 0, 'no pisa carpeta existente');
  ok('CLI: rechaza nombre inválido, modelo no registrado y carpeta existente');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log(`\nnewTemplate.test: ${passed} checks passed`);
