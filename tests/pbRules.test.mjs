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
// `live_claims`: el alumno REGISTRA la credencial de su dispositivo al entrar
// (§22-4). Abierto a crear, pero el índice único (session,player) hace que el
// primero se quede el jugador, y leer/editar están CERRADOS.
const ANON_CREATE_OK = ['results', 'live_players', 'assignment_attempts', 'live_claims'];
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
// §22-4 — y además atada al DISPOSITIVO: la rama anónima exige el secreto de
// `live_claims` por cabecera, y en el UPDATE contra el jugador de la FILA (si
// fuera contra el cuerpo, bastaría mandar otro `player` para editar filas ajenas).
{
  const c = RULES.live_answers.createRule, u = RULES.live_answers.updateRule;
  assert.ok(c.includes('@request.headers.x_ww_claim') && c.includes('live_claims'),
    'crear respuesta debe exigir el secreto del dispositivo');
  assert.ok(u.includes('@request.headers.x_ww_claim') && u.includes('.player ?= player'),
    'actualizar respuesta debe atarse al jugador de LA FILA, no al del cuerpo');
  // Y el secreto no puede quedar legible en ninguna colección pública.
  assert.strictEqual(RULES.live_claims.listRule, null, 'nadie puede LISTAR credenciales');
  assert.strictEqual(RULES.live_claims.viewRule, null, 'nadie puede LEER una credencial');
  assert.strictEqual(RULES.live_claims.updateRule, null, 'nadie puede robar un jugador cambiándole el secreto');
}
ok('live_answers: el veredicto (scored/points) solo lo escribe el host, y la fila va atada al dispositivo');

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

// ── 9. ORDEN de aplicación: una colección va DESPUÉS de las que sus reglas
// consultan por join. PocketBase valida las reglas al guardarlas: si live_answers
// (que hace join a live_claims) se aplica antes de que live_claims exista, el
// servidor rebota con "Failed to update collection" — pasó en la Pi. Se fija en
// las DOS vías (panel y script), leyendo el orden real de sus DEFS.
{
  const orderOf = (src, re) => {
    const names = [];
    let m; const rx = new RegExp(re, 'g');
    while ((m = rx.exec(src))) names.push(m[1]);
    return names;
  };
  const deps = {};
  for (const [coll, r] of Object.entries(RULES)) {
    const joins = new Set();
    for (const rule of Object.values(r)) {
      let m; const rx = /@collection\.([\w_]+)/g;
      while ((m = rx.exec(String(rule || '')))) if (m[1] !== coll) joins.add(m[1]);
    }
    if (joins.size) deps[coll] = [...joins];
  }
  assert.ok(Object.keys(deps).length >= 2, 'premisa: hay reglas con join (live_answers, assignment_attempts)');
  for (const [label, order] of [
    ['views/adminView.js', orderOf(readFileSync(join(ROOT, 'views/adminView.js'), 'utf8'), String.raw`\{ name: '([\w_]+)', fields:`)],
    ['tools/setup-pocketbase.ps1', orderOf(readFileSync(join(ROOT, 'tools/setup-pocketbase.ps1'), 'utf8'), String.raw`@\{ name = "([\w_]+)";`)],
  ]) {
    for (const [coll, needs] of Object.entries(deps)) {
      for (const dep of needs) {
        const a = order.indexOf(dep), b = order.indexOf(coll);
        assert.ok(a >= 0 && b >= 0, `${label}: no encuentro ${dep}/${coll} en los DEFS`);
        assert.ok(a < b, `${label}: ${coll} hace join a ${dep} pero se aplica ANTES (${b} < ${a}) — en un servidor limpio la regla rebota`);
      }
    }
  }
  ok('orden de aplicación: cada colección va después de las que sus reglas consultan');
}

console.log(`\npbRules.test: ${passed} checks passed`);
