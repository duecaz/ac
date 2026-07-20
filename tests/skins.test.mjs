// Contrato de skin — corre core/skinContract.js (el MISMO checker que el panel
// #/admin) sobre todos los skins built-in. Garantiza que cada skin define el set
// COMPLETO de tokens pintables (los que define `default`), no un subconjunto que
// se apoye en el fallback silencioso de theme.css :root.
// Run: node tests/skins.test.mjs
import assert from 'node:assert';
import { listSkins } from '../core/skins.js';   // side-effect: registra los built-in
import { requiredSkinTokens, checkSkin, checkAllSkins } from '../core/skinContract.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const required = requiredSkinTokens();
assert.ok(required.includes('--ww-success') && required.includes('--ww-danger') && required.includes('--ww-warning'),
  'el set canónico incluye los colores de estado (success/danger/warning)');
ok(`set canónico de ${required.length} tokens (derivado del skin default)`);

const skins = listSkins();
assert.ok(skins.length >= 7, `esperaba ≥7 skins, hay ${skins.length}`);
ok(`${skins.length} skins registrados`);

const failing = checkAllSkins();
assert.deepStrictEqual(failing, [],
  'skins que incumplen el contrato:\n' + failing.map(f => `  - ${f.name}: ${f.issues.join(' · ')}`).join('\n'));
ok('todos los skins definen el set COMPLETO de tokens pintables (sin apoyarse en el fallback :root)');

// El checker DETECTA de verdad: un skin al que le falta un token estándar falla.
const brokenIssues = checkSkin({ name: 'roto', label: 'Roto', cssVars: { '--ww-bg': '#000' } }, required);
assert.ok(brokenIssues.some(i => i.includes('faltan tokens')), 'detecta tokens faltantes');
assert.ok(checkSkin({ name: 'vacio', label: 'V', cssVars: { ...Object.fromEntries(required.map(k => [k, '#000'])), '--ww-bg': '' } }, required)
  .some(i => i.includes('vacío')), 'detecta un token con valor vacío');
ok('el checker caza skins incompletos (token faltante o vacío)');

console.log(`\nskins.test: ${passed} checks passed`);
