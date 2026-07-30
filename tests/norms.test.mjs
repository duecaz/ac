// Normas transversales — corre core/normsCheck.js (el MISMO escáner que usa el
// self-test del panel #/admin) sobre TODO el JS del repo (fs walk = autoridad;
// el admin solo alcanza por fetch los ficheros de su manifest + plantillas).
// Convierte en CI las reglas de CLAUDE.md: nunca `new ResizeObserver` directo,
// nunca `filter=` de PB con encodeURIComponent, kernel/ sin Date.now().
// Run: node tests/norms.test.mjs
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { scanNormsSource, BROWSER_SCAN_FILES } from '../core/normsCheck.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['core', 'kernel', 'views', 'templates', 'adapters'];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (name.endsWith('.js')) yield p;
  }
}

const violations = [];
let scanned = 0;
for (const d of DIRS) {
  for (const file of walk(join(ROOT, d))) {
    const rel = relative(ROOT, file).replaceAll('\\', '/');
    violations.push(...scanNormsSource(rel, readFileSync(file, 'utf8')));
    scanned++;
  }
}
// main.*.js de la raíz también son código de la app.
for (const name of readdirSync(ROOT)) {
  if (/^main\..*\.js$/.test(name)) {
    violations.push(...scanNormsSource(name, readFileSync(join(ROOT, name), 'utf8')));
    scanned++;
  }
}

if (violations.length) {
  console.error('\n✗ Violaciones de normas transversales:');
  for (const v of violations) console.error(`  - [${v.rule}] ${v.path}:${v.line} → ${v.text}`);
  console.error('\n  Normas (CLAUDE.md + docs/leyes.md): observeResize() en vez de RO directo · pbEscape/');
  console.error('  pbFilterParam para filtros PB · kernel/ determinista (sin Date.now()) · pb-dueno:');
  console.error('  solo el módulo DUEÑO nombra su colección PB — pide un método al dueño (leyes.md §21).');
}
assert.strictEqual(violations.length, 0, `${violations.length} violación(es) de normas — ver arriba`);
ok(`${scanned} ficheros JS escaneados, 0 violaciones (RO directo / filtro PB a pelo / Date.now en kernel)`);

// El manifest del admin no puede apuntar a ficheros inexistentes (rotaría el
// self-test del deploy con 404s silenciosos).
for (const f of BROWSER_SCAN_FILES) {
  assert.ok(statSync(join(ROOT, f), { throwIfNoEntry: false }), `BROWSER_SCAN_FILES apunta a un fichero inexistente: ${f}`);
}
ok(`manifest del admin válido (${BROWSER_SCAN_FILES.length} ficheros existen)`);

// El escáner DETECTA de verdad cada norma (no es un stub).
const bad = scanNormsSource('views/x.js',
  `const ro = new ResizeObserver(cb);\nfetch(\`?filter=(code='\${encodeURIComponent(c)}')\`);`);
assert.strictEqual(bad.length, 2, 'detecta RO directo y filtro PB a pelo');
assert.strictEqual(scanNormsSource('kernel/x.js', 'const t = Date.now();').length, 1, 'detecta Date.now en kernel');
assert.strictEqual(scanNormsSource('kernel/x.js', '// comentario con Date.now()').length, 0, 'ignora comentarios');
assert.strictEqual(scanNormsSource('core/observeResize.js', 'new ResizeObserver(cb)').length, 0, 'allowlist del helper');
// pb-dueno (ley de datos §21): un módulo cualquiera nombrando una colección → violación;
// el dueño y el literal exacto dentro de otra palabra → limpios.
assert.strictEqual(scanNormsSource('views/x.js', `fetch('/api/collections/results/records')`).length, 1, 'caza fetch a colección ajena');
assert.strictEqual(scanNormsSource('views/x.js', `const c = 'live_answers';`).length, 1, 'caza el literal de colección');
assert.strictEqual(scanNormsSource('adapters/pocketbase/remoteStore.js', `fetch('/api/collections/results/records')`).length, 0, 'el dueño puede');
assert.strictEqual(scanNormsSource('views/x.js', `ls('ww.activities.' + uid)`).length, 0, 'no confunde substrings (ww.activities.)');
ok('el escáner caza cada norma (incl. pb-dueno) y respeta comentarios + allowlist');

console.log(`\nnorms.test: ${passed} checks passed`);
