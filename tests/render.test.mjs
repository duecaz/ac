// Smoke de los constructores de HTML PUROS (sin DOM): aseguran markup bien
// formado y, en el caso del final de actividad, que el enlace "Inicio" siempre
// está. (El render real del editor/vistas se verifica a ojo; un DOM test con
// jsdom/Playwright sería el siguiente salto — requiere dependencias.)
import assert from 'node:assert';
import { resultScreenHtml } from '../core/resultScreen.js';
import { podiumHtml } from '../core/podium.js';
import { teamNameInputsHtml } from '../core/teams.js';
import { buildQuizOptions } from '../kernel/content/qaAdapt.js';

let passed = 0; const ok = (m) => { passed++; console.log('  ✓', m); };

const rs = resultScreenHtml({ title: '¡Listo!', lead: 'Puntos: <b>3</b>', stats: '10s' });
assert.ok(rs.includes('¡Listo!') && rs.includes('Puntos: <b>3</b>') && rs.includes('10s'), 'título/lead/stats');
assert.ok(rs.includes('href="#/home"') && rs.includes('Inicio'), 'SIEMPRE el enlace Inicio (#/home)');
ok('resultScreenHtml: contenido + enlace Inicio único');

const pod = podiumHtml([{ name: 'Ana', score: 5 }, { name: 'Beto', score: 2 }]);
assert.ok(pod.includes('Ana') && pod.includes('Beto'), 'pinta el ranking');
ok('podiumHtml: renderiza participantes');

assert.strictEqual((teamNameInputsHtml(4).match(/<input/g) || []).length, 4, '4 inputs');
ok('teamNameInputsHtml: N inputs');

const opts = buildQuizOptions('12', '2 × 6');
assert.strictEqual(opts.length, 4); assert.ok(opts.includes('12'));
ok('buildQuizOptions: 4 opciones con la respuesta');

console.log(`\nrender.test: ${passed} checks passed`);
