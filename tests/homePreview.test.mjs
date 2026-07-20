// Contrato del preview del home: CADA plantilla registrada tiene su propio
// esquema en core/homePreview.js — nunca cae al respaldo genérico (icono+label).
// Ese respaldo silencioso fue justo el bug que reportó el usuario (Abre Cajas,
// Ruleta, etc. sin preview). Si añades una plantilla y olvidas su esquema, esto
// falla en CI en vez de verse feo en producción.
// Run: node tests/homePreview.test.mjs
import assert from 'node:assert';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import '../core/registerTemplates.js';
import { getTemplate } from '../core/registry.js';
import { homePreviewHtml } from '../core/homePreview.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Lista canónica desde el DIRECTORIO templates/ (no listTemplates(): otras suites
// registran plantillas sintéticas en el registro compartido). Igual que templateContract.
const TDIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const names = readdirSync(TDIR).filter(n => statSync(join(TDIR, n)).isDirectory());
assert.ok(names.length >= 13, `esperaba ≥13 carpetas de plantilla, hay ${names.length}`);

for (const n of names) {
  const T = getTemplate(n);
  assert.ok(T, `templates/${n}/ no está registrada`);
  const act = { id: `_pv_${n}`, template: n, content: T.meta.defaultContent?.() || {} };
  const html = homePreviewHtml(act);
  assert.ok(typeof html === 'string' && html.trim().length > 0, `${n}: preview vacío`);
  assert.ok(!html.includes('pv-generic'),
    `${n}: cae al respaldo genérico — falta su esquema en core/homePreview.js (build switch)`);
  assert.ok(html.includes('class="pv '), `${n}: el preview no abre con la clase base .pv`);
}
ok(`las ${names.length} plantillas tienen esquema propio (0 respaldos genéricos)`);

// La memo devuelve idéntico para la misma clave id:updatedAt (string puro).
const a = { id: 'x', updatedAt: 't1', template: 'quiz', content: { items: [{ question: 'q', options: ['a', 'b'] }] } };
assert.strictEqual(homePreviewHtml(a), homePreviewHtml(a), 'la memo debe devolver el mismo HTML para la misma clave');
ok('memoización estable por id:updatedAt');

console.log(`\nhomePreview.test: ${passed} checks passed`);
