// C1 — matriz alumno×ítem compartida (live + tareas). Run: node tests/sessionTable.test.mjs
import assert from 'node:assert';
import { buildSessionTable, sessionTableCsv } from '../views/sessionTable.js';

let passed = 0; const ok = (m) => { passed++; console.log('  ✓', m); };

// 2 alumnos, 2 preguntas. Ana: P0 bien, P1 mal. Beto: P0 mal, P1 bien.
const rows = [
  { player: 'p1', name: 'Ana', itemIndex: 0, value: 'Madrid', correct: true, points: 2 },
  { player: 'p1', name: 'Ana', itemIndex: 1, value: 'x', correct: false, points: 0 },
  { player: 'p2', name: 'Beto', itemIndex: 0, value: 'y', correct: false, points: 0 },
  { player: 'p2', name: 'Beto', itemIndex: 1, value: 'z', correct: true, points: 3 },
];
{
  const t = buildSessionTable(rows, 2);
  assert.strictEqual(t.players.length, 2, '2 alumnos');
  assert.strictEqual(t.players[0].name, 'Beto', 'ordena por total (Beto 3 primero)');
  assert.strictEqual(t.players[0].total, 3, 'total Beto');
  assert.strictEqual(t.perItem[0].pct, 50, 'P0 50% acierto');
  assert.strictEqual(t.players.find(p=>p.name==='Ana').cells[1].correct, false, 'celda Ana P1 mal');
  ok('buildSessionTable: celdas, totales y % por columna');
}
{
  // Alumno sin responder una pregunta → celda null.
  const t = buildSessionTable([{ player: 'p3', name: 'Cid', itemIndex: 0, value: 'a', correct: true, points: 1 }], 2);
  assert.strictEqual(t.players[0].cells[1], null, 'pregunta sin responder = null');
  ok('celda vacía cuando no respondió');
}
{
  const csv = sessionTableCsv(rows, 2);
  assert.ok(csv.includes('"alumno","P1","P2","total"'), 'cabecera CSV');
  assert.ok(csv.split('\n').length === 3, 'cabecera + 2 alumnos');
  ok('sessionTableCsv exporta bien');
}
console.log(`\nsessionTable.test: ${passed} checks passed`);
