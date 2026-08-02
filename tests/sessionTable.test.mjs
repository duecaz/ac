// C1 — matriz alumno×ítem compartida (live + tareas). Run: node tests/sessionTable.test.mjs
import assert from 'node:assert';
import { buildSessionTable } from '../core/sessionModel.js';   // el MODELO es dominio (§0)
import { sessionTableCsv } from '../views/sessionTable.js';

let passed = 0; const ok = (m) => { passed++; console.log('  ✓', m); };

// 2 alumnos, 2 preguntas (quiz binario). Ana: P0 bien, P1 mal. Beto: P0 mal, P1 bien.
const rows = [
  { player: 'p1', name: 'Ana', itemIndex: 0, value: 'Madrid', correct: true, points: 2 },
  { player: 'p1', name: 'Ana', itemIndex: 1, value: 'x', correct: false, points: 0 },
  { player: 'p2', name: 'Beto', itemIndex: 0, value: 'y', correct: false, points: 0 },
  { player: 'p2', name: 'Beto', itemIndex: 1, value: 'z', correct: true, points: 3 },
];
{
  const t = buildSessionTable(rows, 2);
  assert.strictEqual(t.players.length, 2, '2 alumnos');
  // ambos 1 acierto → desempata puntos (Beto 3 > Ana 2)
  assert.strictEqual(t.players[0].name, 'Beto', 'ordena por aciertos y desempata por puntos');
  assert.strictEqual(t.players[0].marks, 1, 'Beto 1 acierto');
  assert.strictEqual(t.perItem[0].pct, 50, 'P0 50% acierto');
  ok('buildSessionTable binario: aciertos, desempate por puntos, % por columna');
}
{
  const t = buildSessionTable([{ player: 'p3', name: 'Cid', itemIndex: 0, value: 'a', correct: true, points: 1 }], 2);
  assert.strictEqual(t.players[0].cells[1], null, 'pregunta sin responder = null');
  ok('celda vacía cuando no respondió');
}
// Plantilla de texto FICTICIA para los bloques multi-parte. Desde P4
// (handoff-puntuacion) la tabla lee el mérito del SCORER de la plantilla
// ({hits, over, total}), no de itemParts/valueParts.
const textTpl = {
  scoreSubmission: ({ value, item }) => {
    const want = new Set((item.marks || []).map(m => m.pos));
    const got = (value || []).map(Number);
    let hits = 0, over = 0;
    for (const p of new Set(got)) (want.has(p) ? hits++ : over++);
    return { correct: hits > 0, points: hits, hits, over, total: want.size };
  },
};
// ── Con M1 (texto): la celda cuenta PALABRAS bien (2/3), no frase perfecta ────
{
  const items = [{ marks: [{ pos: 0 }, { pos: 3 }, { pos: 5 }] }]; // 3 tildes requeridas
  const tRows = [
    { player: 'p1', name: 'Ana', itemIndex: 0, value: [0, 3, 9], correct: false, points: 2 },  // 2 de 3 (+1 de más)
    { player: 'p2', name: 'Beto', itemIndex: 0, value: [0, 3, 5], correct: true, points: 3 },   // 3 de 3
  ];
  const t = buildSessionTable(tRows, 1, { items, template: textTpl });
  const ana = t.players.find(p => p.name === 'Ana');
  assert.strictEqual(t.players[0].name, 'Beto', 'Beto (3 aciertos) por delante de Ana (2)');
  assert.strictEqual(ana.cells[0].hits, 2, 'Ana 2 palabras bien');
  assert.strictEqual(ana.cells[0].total, 3, 'de 3 requeridas');
  assert.strictEqual(ana.cells[0].binary, false, 'ítem multi-parte no es binario');
  assert.strictEqual(ana.marks, 2, 'ranking por marcas: Ana 2');
  ok('M1 texto: la celda cuenta palabras bien (no todo-o-nada por frase)');
}
// ── carrera: la tabla cuenta el intento FINAL, no el primer borrador ─────────
{
  const items = [{ marks: [{ pos: 0 }, { pos: 3 }, { pos: 5 }, { pos: 7 }] }]; // 4 tildes
  // alumno2 empezó MAL (v0 vacío → value) pero acabó con 3/4 (valueFinal).
  const tRows = [
    { player: 'p2', name: 'alumno2', itemIndex: 0, value: [], correct: false, valueFinal: [0, 3, 5], correctFinal: true, points: 3 },
  ];
  const t = buildSessionTable(tRows, 1, { items, template: textTpl });
  assert.strictEqual(t.players[0].cells[0].hits, 3, 'la tabla cuenta el intento FINAL (3/4), no el borrador (0)');
  assert.strictEqual(t.players[0].marks, 3, 'ranking por el resultado final');
  ok('carrera: tabla usa valueFinal (resultado real), no el primer intento');
}
{
  const csv = sessionTableCsv(rows, 2);
  assert.ok(csv.includes('"alumno","P1","P2","aciertos","puntos"'), 'cabecera CSV con aciertos y puntos');
  assert.ok(csv.split('\n').length === 3, 'cabecera + 2 alumnos');
  ok('sessionTableCsv exporta bien');
}
console.log(`\nsessionTable.test: ${passed} checks passed`);
