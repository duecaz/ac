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
import { getTemplate, listTemplates } from '../core/registry.js';
import { newActivity } from '../core/migrate.js';
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

// REGLA del grafo de conversión: todo conversor une modelos usados por ≥1
// plantilla VIVA. (Habría cazado el bug real: qa→entries quedó huérfano cuando
// la Ruleta migró a items y Quiz→Ruleta dejó de ofrecerse EN SILENCIO.)
{
  const { converterKeys } = await import('../kernel/content/convert.js');
  const liveModels = new Set(templates.map(T => T.meta.contentModel));
  const dead = converterKeys().flatMap(k => k.split('->')).filter(m => !liveModels.has(m));
  assert.deepStrictEqual([...new Set(dead)], [],
    `conversores hacia/desde modelos sin plantilla viva: ${dead.join(', ')}`);
  ok('grafo de conversión: todos los conversores unen modelos con plantilla viva');
}

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
assert.ok(checkTemplateContract(badScorer).some(i => i.includes('{correct, points, hits, total}')),
  'detecta un scorer con forma equivocada ({score,maxScore})');
// Y el MÉRITO (hits/total) es obligatorio desde P3 del handoff de puntuación:
// un scorer con la forma vieja {correct, points} sin mérito también se caza.
const noMerit = { ...badScorer, scoreSubmission: () => ({ correct: true, points: 1 }) };
assert.ok(checkTemplateContract(noMerit).some(i => i.includes('mérito')),
  'detecta un scorer sin mérito {hits, total}');
ok('el checker caza plantillas rotas (instructions vacío, ronda a medias, scorer con forma equivocada)');

// ── R-D · LA ACTIVIDAD NUEVA NACE VACÍA ──────────────────────────────────────
// Antes llegaba con el contenido de MUESTRA de su plantilla y empezar el trabajo
// real costaba borrarlo de uno en uno («Cabeza / Ojo / Nariz / Boca» sobre una
// cara de ejemplo). Lo que enseña ahora es el ESTADO VACÍO del editor.
// Se comprueba por RECORRIDO del registro: una plantilla nueva entra sola.
{
  const conTexto = (v) => {
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.some(conTexto);
    if (v && typeof v === 'object') return Object.entries(v).some(([k, x]) => k !== 'id' && conTexto(x));
    return false;
  };
  // Solo las plantillas REALES: al correr la suite entera hay dobles de prueba
  // registrados por otras suites (solo.test.mjs registra una sin defaultContent).
  const reales = listTemplates().filter(T => typeof T.meta?.defaultContent === 'function');
  const sucias = [];
  for (const T of reales) {
    const a = newActivity(T.meta.name);
    // Las de contenido GENERADO nacen con su tablero A PROPÓSITO: vaciarlas
    // daría una actividad injugable esperando un botón que la app sabe pulsar.
    if (T.meta.editor?.generado) {
      if (!conTexto(a.content)) sucias.push(`${T.meta.name}: declara \`generado\` pero nace sin contenido jugable`);
      continue;
    }
    if (conTexto(a.content)) sucias.push(`${T.meta.name}: nace con contenido escrito — ${JSON.stringify(a.content).slice(0, 90)}`);
  }
  assert.deepStrictEqual(sucias, [], 'actividades nuevas que NO nacen vacías:\n  ' + sucias.join('\n  '));

  // CONTRA-PRUEBA: `defaultContent()` sigue trayendo contenido JUGABLE — es con
  // lo que siembran la matriz, el edit-audit y media docena de suites. Vaciar
  // eso habría dejado ciegas a todas ellas de golpe.
  const sinDemo = reales.filter(T => !conTexto(T.meta.defaultContent())).map(T => T.meta.name);
  assert.deepStrictEqual(sinDemo, [],
    'defaultContent() debe seguir siendo contenido jugable (lo usan las redes): ' + sinDemo.join(', '));
  ok(`las ${reales.length} nacen vacías y su defaultContent() sigue siendo jugable`);
}

console.log(`\ntemplateContract.test: ${passed} checks passed`);
