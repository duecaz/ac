// Contrato de plantilla — corre core/templateContract.js (el MISMO checker que
// usa el self-test del panel #/admin) sobre las 12 plantillas registradas.
// Una plantilla nueva queda cubierta automáticamente al registrarse: si le
// falta `instructions`, su scorer no devuelve {correct,points}, su
// defaultContent no valida o su migrateContent no es idempotente, esto falla.
// Run: node tests/templateContract.test.mjs
import assert from 'node:assert';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import '../core/registerTemplates.js';   // side-effect: registra las 12
import { getTemplate } from '../core/registry.js';
import { checkTemplateContract, checkAllTemplates } from '../core/templateContract.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// La lista canónica sale del DIRECTORIO templates/ (no de listTemplates(): en
// run.mjs otras suites registran plantillas sintéticas de prueba en el registro
// compartido). Bonus: una carpeta de plantilla NO registrada en
// core/registerTemplates.js falla aquí ("creaste la carpeta y olvidaste registrarla").
const TDIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const names = readdirSync(TDIR).filter(n => statSync(join(TDIR, n)).isDirectory());
assert.ok(names.length >= 12, `esperaba ≥12 carpetas de plantilla, hay ${names.length}`);
const templates = names.map(n => {
  const T = getTemplate(n);
  assert.ok(T, `templates/${n}/ existe pero NO está registrada en core/registerTemplates.js`);
  return T;
});
ok(`${templates.length} plantillas: carpeta ↔ registro consistentes`);

for (const T of templates) {
  const issues = checkTemplateContract(T);
  assert.deepStrictEqual(issues, [], `"${T.meta.name}" incumple el contrato:\n  - ${issues.join('\n  - ')}`);
}
ok('las plantillas cumplen el contrato completo (meta, modelo, scorer {correct,points}, migrate idempotente)');

// El agregador que usa el self-test del admin reporta lo mismo (vacío = todo ok).
assert.deepStrictEqual(checkAllTemplates(templates), [], 'checkAllTemplates debe devolver vacío');
ok('checkAllTemplates (runner del panel admin) coincide: 0 incumplimientos');

// El checker DETECTA de verdad (no es un stub): una plantilla rota debe fallar.
const broken = {
  meta: {
    name: 'rota', label: 'Rota', icon: 'bi-bug', contentModel: 'qa', templateVersion: 1,
    instructions: '',                                  // ← viola instructions obligatorio
    modes: { live: false },
    defaultRules: () => ({}), defaultScoring: () => ({}),
    defaultContent: () => ({ items: [{ id: 'x', question: 'q', answer: 'a', options: ['a', 'b'] }] }),
  },
  renderPlayer() {}, renderEditor() {},
  renderRound() {},                                    // ← renderRound sin scorer ni payload
  scoreSubmission: undefined,
};
const found = checkTemplateContract(broken);
assert.ok(found.some(i => i.includes('instructions')), 'detecta instructions vacío');
assert.ok(found.some(i => i.includes('renderRound')), 'detecta renderRound sin scorer/payload');
// Y la forma del scorer: {score,maxScore} (el bug real del Crucigrama) debe cazarse.
const badScorer = { ...broken, meta: { ...broken.meta, instructions: 'x' }, renderRound: undefined,
  scoreSubmission: () => ({ score: 1, maxScore: 2 }) };
assert.ok(checkTemplateContract(badScorer).some(i => i.includes('{correct, points}')),
  'detecta un scorer con forma equivocada ({score,maxScore})');
ok('el checker caza plantillas rotas (instructions vacío, ronda a medias, scorer con forma equivocada)');

console.log(`\ntemplateContract.test: ${passed} checks passed`);
