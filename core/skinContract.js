// Contrato de skin EJECUTABLE — un checker puro que garantiza que TODO skin
// define el set COMPLETO de tokens pintables, no un subconjunto. Lo consumen dos
// runners (mismo patrón que templateContract.js / normsCheck.js):
//   · tests/skins.test.mjs — suite Node (CI)
//   · core/selftest.js     — panel #/admin, grupo "Skins"
//
// Por qué existe: un skin es un objeto `cssVars` que redefine los `--ww-*` que
// las actividades usan para pintarse. Si un skin OLVIDA un token (p.ej.
// `--ww-success`), ese color cae al fallback global de `styles/theme.css :root`
// → el "verde de acierto" se ve genérico en vez del de la paleta del skin, y el
// día que alguien renombre ese token del :root, el skin se rompe sin aviso. El
// contrato lo hace imposible: cada skin debe definir al menos lo que define el
// skin `default` (la lista canónica: si se añade un token a `default`, TODOS
// deben declararlo). Los tokens extra (--key-*, --display-*, --math-*) son
// mejoras opcionales con fallback inline en el CSS, así que no se exigen.
import { listSkins, getSkin } from './skins.js';

/** El set canónico = lo que declara el skin `default`. */
export function requiredSkinTokens() {
  const def = getSkin('default');
  return Object.keys(def?.cssVars || {});
}

/**
 * Verifica UN skin contra el contrato.
 * @returns {string[]} problemas (vacío = cumple).
 */
export function checkSkin(skin, required = requiredSkinTokens()) {
  const issues = [];
  if (!skin?.name) return ['skin sin name'];
  if (!String(skin.label || '').trim()) issues.push('sin label');
  const vars = skin.cssVars || {};
  const keys = new Set(Object.keys(vars));
  const missing = required.filter(k => !keys.has(k));
  if (missing.length) issues.push(`faltan tokens estándar: ${missing.join(', ')}`);
  for (const [k, v] of Object.entries(vars)) {
    if (v == null || String(v).trim() === '') issues.push(`token ${k} con valor vacío`);
  }
  return issues;
}

/**
 * Corre el contrato sobre TODOS los skins registrados.
 * @returns {{name:string, issues:string[]}[]} solo los que fallan.
 */
export function checkAllSkins() {
  const required = requiredSkinTokens();
  return listSkins()
    .map(s => ({ name: s.name, issues: checkSkin(s, required) }))
    .filter(r => r.issues.length);
}
