// Tests del panel de modos (datos puros) + guardián de capacidad. Verifica que
// la matriz que ve el admin se deriva correctamente del registro y de lo que
// implementa cada plantilla. Run: node tests/modeMatrix.test.mjs
import assert from 'node:assert';
import { registerTemplate } from '../core/registry.js';
import { templateCapabilities, activityAvailability, modeReason, CONTRACT_METHODS } from '../core/modeMatrix.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Arquetipos: full (todo), tool (solo), y memory (teams nativo sin renderRound).
registerTemplate({ meta: { name: 'mm_full', label: 'Full', contentModel: 'qa', modes: { live: true, async: true } },
  renderPlayer() {}, renderEditor() {}, renderRound() {}, getRoundPayload() {}, scoreSubmission() {} });
registerTemplate({ meta: { name: 'mm_tool', label: 'Tool', contentModel: 'entries', modes: {} },
  renderPlayer() {}, renderEditor() {} });
registerTemplate({ meta: { name: 'memory', label: 'Memoria', contentModel: 'pairs', modes: { async: true } },
  renderPlayer() {}, renderEditor() {} });

const byName = (n) => templateCapabilities().find(c => c.name === n);
const modeMap = (cap) => Object.fromEntries(cap.modes.map(m => [m.id, m.supported]));

// ---- full: ofrece todos los modos; métodos detectados ----
const full = byName('mm_full');
assert.deepStrictEqual(modeMap(full), { solo: true, vs: true, teams: true, live: true, task: true },
  'full template soporta los cinco modos');
assert.strictEqual(full.methods.renderRound, true);
assert.strictEqual(full.methods.scoreSubmission, true);
assert.strictEqual(full.methods.renderRoundHost, false, 'detecta método ausente');
ok('templateCapabilities: full ofrece todo y refleja los métodos');

// ---- tool: solo individual; el motivo de VS explica qué falta ----
const tool = byName('mm_tool');
assert.deepStrictEqual(modeMap(tool), { solo: true, vs: false, teams: false, live: false, task: false },
  'tool solo ofrece individual');
assert.match(tool.modes.find(m => m.id === 'vs').reason, /falta scoreSubmission \+ renderRound/,
  'el motivo de VS dice qué falta');
ok('templateCapabilities: tool solo individual, con motivo claro');

// ---- memory: teams por mecánica nativa (sin renderRound) ----
const mem = byName('memory');
assert.strictEqual(modeMap(mem).teams, true, 'memory soporta equipos por mecánica nativa');
assert.strictEqual(modeMap(mem).vs, false, 'memory sin renderRound → no VS');
assert.match(modeReason('teams', { meta: { name: 'memory' } }), /nativa de Memoria/, 'motivo de equipos para memory');
ok('templateCapabilities: memory equipos sí, VS no');

// ---- todas las celdas traen los campos que el panel pinta ----
assert.ok(CONTRACT_METHODS.length >= 4, 'hay columnas de métodos');
assert.ok(full.modes.every(m => 'short' in m && 'reason' in m && 'supported' in m), 'cada modo trae short/reason/supported');
ok('cada celda de la matriz trae short, reason y supported');

// ---- disponibilidad por actividad (con contenido) ----
const rows = activityAvailability([
  { id: 'x1', title: 'A', template: 'mm_full', content: { items: [{}, {}] } }, // ≥2 → vs ok
  { id: 'x2', title: 'B', template: 'mm_full', content: { items: [{}] } },     // 1 ítem → vs no
]);
const av = (r, id) => r.modes.find(m => m.id === id).available;
assert.strictEqual(av(rows[0], 'vs'), true, 'actividad con ≥2 ítems: VS disponible');
assert.strictEqual(av(rows[1], 'vs'), false, 'actividad con 1 ítem: VS no disponible');
assert.strictEqual(av(rows[1], 'teams'), true, 'teams con 1 ítem sí');
ok('activityAvailability refleja la disponibilidad real por contenido');

console.log(`\nmodeMatrix.test: ${passed} checks passed`);
