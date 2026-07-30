// LEY DE CONFIANZA §22 — invariantes de las reglas de PocketBase + ANTI-DIVERGENCIA.
//
// Las reglas se declaran UNA vez en core/pbRules.js y se aplican por dos vías:
// el panel `#/admin` (navegador) y `tools/setup-pocketbase.ps1` (PowerShell).
// Cuando cada vía llevaba su copia a mano, DIVERGIERON en silencio: la del
// script exigía sesión para leer `assignment_attempts`, lo que rompe el tope de
// intentos del alumno anónimo (y solo se descubre con alumnos delante).
// Este test hace imposible repetirlo.
//
// Run: node tests/pbRules.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RULES, AUTH } from '../core/pbRules.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ACTIONS = ['list', 'view', 'create', 'update', 'delete'];

// ── 1. Toda colección declara sus 5 reglas explícitamente ───────────────────
// Una regla ausente (undefined) es un agujero: PocketBase la deja como estaba.
for (const [coll, r] of Object.entries(RULES)) {
  for (const a of ACTIONS) {
    assert.ok(`${a}Rule` in r, `${coll}: falta ${a}Rule (declárala: '' abierto · null cerrado · expresión)`);
    const v = r[`${a}Rule`];
    assert.ok(v === '' || v === null || typeof v === 'string', `${coll}.${a}Rule: valor inválido`);
  }
}
ok(`${Object.keys(RULES).length} colecciones con sus 5 reglas declaradas (sin agujeros)`);

// ── 2. NADIE tiene la escritura abierta de par en par ───────────────────────
// '' en create/update/delete = cualquier anónimo hace lo que quiera. Solo se
// permite donde el ALUMNO ANÓNIMO tiene que poder escribir, y ahí la regla debe
// llevar guardas de campo (se comprueban abajo).
const ANON_CREATE_OK = ['results', 'live_players', 'assignment_attempts'];
for (const [coll, r] of Object.entries(RULES)) {
  if (r.createRule === '' && !ANON_CREATE_OK.includes(coll)) {
    assert.fail(`${coll}.createRule abierto sin justificar — el alumno anónimo no necesita crear aquí`);
  }
  assert.notStrictEqual(r.updateRule, '', `${coll}.updateRule abierto de par en par: un anónimo puede editar cualquier fila`);
  assert.notStrictEqual(r.deleteRule, '', `${coll}.deleteRule abierto de par en par: un anónimo puede borrar cualquier fila`);
}
ok('ninguna colección tiene update/delete abiertos (y create abierto solo donde el alumno anónimo escribe)');

// ── 3. El VEREDICTO de una respuesta en vivo es del host ────────────────────
// El corazón de C6: si el alumno pudiera escribir scored/points, se saltaría el
// settle y el marcador sumaría sus puntos inventados.
for (const f of ['scored', 'points']) {
  assert.match(RULES.live_answers.updateRule, new RegExp(`@request\\.body\\.${f}:isset = false`),
    `live_answers.updateRule debe prohibir al anónimo tocar "${f}"`);
}
assert.match(RULES.live_answers.createRule, /@request\.body\.scored = false/, 'crear respuesta: scored debe nacer false');
assert.match(RULES.live_answers.createRule, /@request\.body\.points = 0/, 'crear respuesta: points debe nacer 0');
ok('live_answers: el veredicto (scored/points) solo lo escribe el host');

// ── 4. El BLOB de control de la sala es del host ─────────────────────────────
for (const f of ['state', 'activity', 'code']) {
  assert.match(RULES.live_sessions.updateRule, new RegExp(`@request\\.body\\.${f}:isset = false`),
    `live_sessions.updateRule debe prohibir al anónimo tocar "${f}"`);
}
assert.strictEqual(RULES.live_sessions.createRule, AUTH, 'crear sala exige sesión de profe');
assert.strictEqual(RULES.live_sessions.deleteRule, AUTH, 'borrar sala exige sesión de profe');
assert.strictEqual(RULES.live_players.deleteRule, AUTH, 'expulsar exige sesión (antes cualquier alumno echaba a otro)');
assert.strictEqual(RULES.live_players.updateRule, null, 'nadie renombra una fila de jugador');
ok('live_sessions: fase/ítem/deadline/puntajes son host-only; expulsar y crear sala también');

// ── 5. Append-only donde el dato es un HECHO entregado ───────────────────────
for (const coll of ['results', 'assignment_attempts']) {
  assert.strictEqual(RULES[coll].updateRule, null, `${coll} debe ser append-only (update cerrado)`);
  assert.strictEqual(RULES[coll].deleteRule, null, `${coll} debe ser append-only (delete cerrado)`);
}
// El tope de intentos lo cuenta el alumno ANÓNIMO: si esto exigiera sesión, el
// gateo de tareas reventaría (fue la divergencia real del script de PowerShell).
assert.strictEqual(RULES.assignment_attempts.listRule, '', 'el alumno anónimo debe poder contar sus intentos');
// Crear NO es abierto del todo (§22-3: el tope lo aplica el servidor), pero
// tampoco puede exigir SESIÓN: el alumno es anónimo. La forma exacta de la regla
// (y que el alumno legítimo pasa) la prueba tests/taskRules.test.mjs.
const attCreate = RULES.assignment_attempts.createRule;
assert.ok(attCreate && !attCreate.includes('@request.auth'),
  'crear intento no puede exigir sesión: el alumno es anónimo');
assert.ok(attCreate.includes('max_attempts'),
  'crear intento debe acotar el tope contra la tarea (si no, el límite vive solo en el cliente)');
ok('results/assignment_attempts append-only, y el alumno anónimo aún puede contar y entregar');

// ── 6. Dirigir una tarea es acto del profe ───────────────────────────────────
for (const a of ['create', 'update', 'delete']) {
  assert.strictEqual(RULES.assignments[`${a}Rule`], AUTH, `assignments.${a}Rule debe exigir sesión`);
}
assert.strictEqual(RULES.assignments.viewRule, '', 'el alumno debe poder abrir la tarea por código');
ok('assignments: crear/cerrar/rotar exige sesión; el alumno solo lee');

// ── 7. ANTI-DIVERGENCIA: el script de PowerShell dice lo MISMO ──────────────
// Se parsea `tools/setup-pocketbase.ps1` y se compara regla a regla.
{
  const ps1 = readFileSync(join(ROOT, 'tools/setup-pocketbase.ps1'), 'utf8');
  const norm = (v) => v === null ? null : String(v).replace(/'/g, '"').replace(/\s+/g, ' ').trim();

  // Bloque `rules = @{ … }` de cada colección (llaves balanceadas).
  const rulesOf = (coll) => {
    const at = ps1.indexOf(`name = "${coll}"`);
    if (at < 0) return null;
    const start = ps1.indexOf('rules = @{', at);
    if (start < 0) return null;
    let i = ps1.indexOf('@{', start) + 2, depth = 1;
    while (i < ps1.length && depth > 0) {
      if (ps1.startsWith('@{', i)) { depth++; i += 2; continue; }
      if (ps1[i] === '}') depth--;
      i++;
    }
    const body = ps1.slice(start, i);
    const out = {};
    for (const m of body.matchAll(/(\w+)Rule\s*=\s*(\$null|""|'([^']*)')/g)) {
      out[`${m[1]}Rule`] = m[2] === '$null' ? null : (m[3] ?? '');
    }
    return out;
  };

  let compared = 0;
  for (const [coll, want] of Object.entries(RULES)) {
    const got = rulesOf(coll);
    if (!got) continue;   // el script no define esa colección (p.ej. solo el panel)
    for (const a of ACTIONS) {
      assert.strictEqual(norm(got[`${a}Rule`]), norm(want[`${a}Rule`]),
        `DIVERGENCIA en ${coll}.${a}Rule:\n  core/pbRules.js  → ${JSON.stringify(want[`${a}Rule`])}\n  setup-pocketbase.ps1 → ${JSON.stringify(got[`${a}Rule`])}\n  (las reglas se declaran UNA vez en core/pbRules.js; sincroniza el script)`);
      compared++;
    }
  }
  assert.ok(compared >= 40, `se esperaban ≥40 reglas comparadas, hubo ${compared} (¿el parser dejó de encontrar los bloques?)`);
  ok(`setup-pocketbase.ps1 NO diverge del módulo (${compared} reglas comparadas)`);
}

// ── 8. El panel #/admin las LEE del módulo (no lleva copia) ─────────────────
{
  const admin = readFileSync(join(ROOT, 'views/adminView.js'), 'utf8');
  assert.match(admin, /from '\.\.\/core\/pbRules\.js'/, 'views/adminView.js debe importar las reglas del módulo');
  assert.ok(!/const\s+activityRules\s*=/.test(admin), 'views/adminView.js no debe volver a declarar reglas a mano');
  ok('el panel #/admin aplica las reglas del módulo (sin copia propia)');
}

console.log(`\npbRules.test: ${passed} checks passed`);
