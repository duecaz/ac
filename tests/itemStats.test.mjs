// M3+M2 — agregador de analítica por ítem/parte y normalizador de fuentes.
// Run: node tests/itemStats.test.mjs
import assert from 'node:assert';
import { aggregate, heatClass, HEAT } from '../core/itemStats.js';
import { rowsFromLiveState, rowsFromLiveAnswers, rowsFromAttempts, dedupeRows } from '../core/answerRows.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Plantilla de texto simulada (tildes): partes = posiciones requeridas.
const textTpl = {
  itemParts: ({ item }) => (item.marks || []).map(m => ({ key: m.pos, label: 'w' + m.pos, ok: true })),
  valueParts: ({ value }) => (value || []).map(Number),
  itemLabel: (it) => it.text.slice(0, 10),
};
// Ítem: "jugo" con tilde requerida en pos 3 (la 'o' de jugó) y otra en pos 0.
const items = [{ text: 'ajugo', marks: [{ pos: 0, kind: 'tilde' }, { pos: 3, kind: 'tilde' }] }];

// ── Fallback sin M1: %acierto por ítem desde `correct` ───────────────────────
{
  const rows = [
    { player: 'A', itemIndex: 0, value: [0], correct: true, points: 1 },
    { player: 'B', itemIndex: 0, value: [], correct: false, points: 0 },
  ];
  const r = aggregate({ items: [{}], template: null, rows });
  assert.strictEqual(r.nPlayers, 2, 'cuenta 2 jugadores');
  assert.strictEqual(r.items[0].pctCorrect, 0.5, 'fallback: 50% correcto');
  assert.strictEqual(r.items[0].parts.length, 1, 'fallback: una parte "Acierto"');
  ok('fallback genérico da %acierto por ítem sin M1');
}

// ── Con M1 (texto): marca por posición, extras y % por parte ─────────────────
{
  const rows = [
    { player: 'A', itemIndex: 0, value: [0, 3], correct: true, points: 2 },   // ambas bien
    { player: 'B', itemIndex: 0, value: [3], correct: true, points: 1 },      // solo pos3
    { player: 'C', itemIndex: 0, value: [3, 4], correct: true, points: 1 },   // pos3 + una de MÁS (4)
    { player: 'D', itemIndex: 0, value: [], correct: false, points: 0 },      // nada
  ];
  const r = aggregate({ items, template: textTpl, rows });
  const it = r.items[0];
  assert.strictEqual(it.n, 4, '4 respuestas');
  const p0 = it.parts.find(p => p.key === '0');
  const p3 = it.parts.find(p => p.key === '3');
  assert.strictEqual(p0.nMarked, 1, 'pos0 marcada por 1 (A)');
  assert.strictEqual(p3.nMarked, 3, 'pos3 marcada por 3 (A,B,C)');
  assert.strictEqual(p3.pctMarked, 0.75, 'pos3 acierto 75%');
  assert.strictEqual(it.extras, 1, 'una marca de más (C→4)');
  ok('M1 texto: nMarked/pctMarked por posición + extras');
}

// ── heatClass umbrales ───────────────────────────────────────────────────────
{
  assert.strictEqual(heatClass(0.9), 'ok', '90% verde');
  assert.strictEqual(heatClass(HEAT.warn), 'warn', '50% ámbar');
  assert.strictEqual(heatClass(0.2), 'bad', '20% rojo');
  ok('heatClass respeta los umbrales verde/ámbar/rojo');
}

// ── dedupe: última respuesta por (player,item) gana ──────────────────────────
{
  const rows = [
    { player: 'A', itemIndex: 0, value: [1], correct: false, points: 0 },
    { player: 'A', itemIndex: 0, value: [0, 3], correct: true, points: 2 }, // reintento correcto
  ];
  const d = dedupeRows(rows);
  assert.strictEqual(d.length, 1, 'una sola fila para A×item0');
  assert.deepStrictEqual(d[0].value, [0, 3], 'se queda la última');
  ok('dedupeRows: la respuesta más reciente gana');
}

// ── M2: parse del blob legado state.answers ──────────────────────────────────
{
  const state = {
    players: [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Beto' }],
    answers: { '0:p1': { playerId: 'p1', value: [3], correct: true, points: 1 }, '0:p2': { playerId: 'p2', value: [], correct: false, points: 0 } },
  };
  const rows = rowsFromLiveState(state);
  assert.strictEqual(rows.length, 2, 'dos filas');
  assert.strictEqual(rows.find(r => r.player === 'p1').name, 'Ana', 'resuelve el nombre desde players');
  const r = aggregate({ items, template: textTpl, rows });
  assert.strictEqual(r.items[0].parts.find(p => p.key === '3').nMarked, 1, 'pos3 marcada por 1 en el blob');
  ok('M2 rowsFromLiveState + agregación end-to-end');
}

// ── M2: filas live_answers y attempts ────────────────────────────────────────
{
  const la = rowsFromLiveAnswers([{ playerId: 'p1', value: [0], correct: true, points: 1 }], 0);
  assert.strictEqual(la[0].itemIndex, 0, 'itemIndex por parámetro');
  const at = rowsFromAttempts([{ player_name: 'Ana', answers: [{ i: 0, v: [3], c: true, p: 1 }] }]);
  assert.strictEqual(at[0].player, 'Ana', 'attempt → player_name');
  assert.strictEqual(at[0].itemIndex, 0, 'attempt → itemIndex');
  ok('M2 rowsFromLiveAnswers + rowsFromAttempts');
}

// ── M4 packAnswers: normaliza ambas formas + tope de tamaño ──────────────────
{
  const { packAnswers } = await import('../core/answerDetail.js');
  // shell secuencial (value/correct/points) + runner de texto (v/c/p)
  const packed = packAnswers([
    { i: 0, itemId: 'q1', value: 'Madrid', correct: true, points: 1 },
    { i: 1, v: [3, 5], c: false, p: 0 },
  ]);
  assert.deepStrictEqual(packed[0], { i: 0, v: 'Madrid', c: true, p: 1 }, 'normaliza forma secuencial');
  assert.deepStrictEqual(packed[1], { i: 1, v: [3, 5], c: false, p: 0 }, 'normaliza forma de texto');
  // tope: primero suelta v de correctos
  const big = Array.from({ length: 50 }, (_, i) => ({ i, v: 'x'.repeat(100), c: i % 2 === 0, p: 1 }));
  const capped = packAnswers(big, { maxBytes: 2000 });
  assert.ok(JSON.stringify(capped).length <= 2000, 'respeta el tope de bytes');
  ok('M4 packAnswers normaliza y capa por tamaño');
}

// ── v0/c0: la analítica usa el PRIMER intento (carrera), no el corregido ──────
{
  // Fila de carrera: el alumno acabó ACERTANDO (value/correct = correcto), pero su
  // primer intento fue MAL (v0 vacío, c0 false). El análisis debe ver el primer intento.
  const raceRows = rowsFromLiveAnswers([
    { playerId: 'p1', value: [3], correct: true, points: 1, v0: [], c0: false }, // acabó bien, empezó mal
    { playerId: 'p2', value: [3], correct: true, points: 1, v0: [3], c0: true }, // bien a la primera
  ], 0);
  assert.deepStrictEqual(raceRows[0].value, [], 'usa v0 (primer intento) no el value final');
  assert.strictEqual(raceRows[0].correct, false, 'usa c0 (primer intento) no el correct final');
  const r = aggregate({ items, template: textTpl, rows: raceRows });
  // pos3 la acertó a la PRIMERA solo p2 → 1 de 2 = 50%
  assert.strictEqual(r.items[0].parts.find(p => p.key === '3').nMarked, 1, 'solo p2 acertó pos3 a la primera');
  ok('v0/c0: la analítica de carrera refleja el primer intento (captura errores)');
}

// ── nombres por veredicto (quién acertó/falló, estilo Kahoot) ────────────────
{
  const rows = [
    { player: 'p1', name: 'Ana', itemIndex: 0, value: [3], correct: true, points: 1 },
    { player: 'p2', name: 'Beto', itemIndex: 0, value: [], correct: false, points: 0 },
  ];
  const r = aggregate({ items, template: textTpl, rows });
  assert.deepStrictEqual(r.items[0].correctNames, ['Ana'], 'Ana acertó');
  assert.deepStrictEqual(r.items[0].wrongNames, ['Beto'], 'Beto falló');
  ok('aggregate lista quién acertó/falló por ítem');
}

console.log(`\nitemStats.test: ${passed} checks passed`);
