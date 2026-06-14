// Utilidades compartidas del modo Equipos.
import assert from 'node:assert';
import { TEAM_COLORS, teamColor, teamNameInputsHtml } from '../core/teams.js';
let passed = 0; const ok = (m) => { passed++; console.log('  ✓', m); };

const teams = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
assert.strictEqual(teamColor('a', teams), 'danger');
assert.strictEqual(teamColor('e', teams), TEAM_COLORS[4 % 4], 'cicla colores (5º = 1º)');
assert.strictEqual(teamColor('x', teams), TEAM_COLORS[0], 'id desconocido → primer color');
ok('teamColor: por posición, cicla y tolera id desconocido');

const html = teamNameInputsHtml(3);
assert.strictEqual((html.match(/<input/g) || []).length, 3, '3 inputs');
assert.ok(html.includes('Equipo 1') && html.includes('Equipo 3'), 'nombres por defecto');
ok('teamNameInputsHtml: N inputs con nombres por defecto');
console.log(`\nteams.test: ${passed} checks passed`);
