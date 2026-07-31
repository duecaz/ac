// Ball Sort template — pure engine + scoring + contract. Run: node tests/ballsort.test.mjs
import assert from 'node:assert';
import { canMove, applyMove, isWin, progress } from '../templates/ballsort/game/rules.js';
import { createBoard, randomBoard, cloneBoard } from '../templates/ballsort/game/board.js';
import { scoreBallsort } from '../templates/ballsort/scorer.js';
import '../templates/ballsort/index.js'; // side-effect: registers the template
import { getTemplate, registerTemplate } from '../core/registry.js';
import { isVsCompatible } from '../kernel/session/engine.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── rules ────────────────────────────────────────────────────────────────────
{
  const b = { tubeCapacity: 3, colors: ['red','blue'], tubes: [['red','blue'], ['red'], []] };
  assert.strictEqual(canMove(b, 0, 2), true, 'top → empty is legal');
  assert.strictEqual(canMove(b, 1, 1), false, 'same tube illegal');
  assert.strictEqual(canMove(b, 2, 0), false, 'empty source illegal');
  const full = { tubeCapacity: 1, colors: ['red'], tubes: [['red'], ['red']] };
  assert.strictEqual(canMove(full, 0, 1), false, 'full destination illegal');
  ok('canMove respects source/dest/capacity');

  const moved = applyMove(b, 0, 2);
  assert.deepStrictEqual(moved.tubes[2], ['blue'], 'applyMove pops top onto dest');
  assert.deepStrictEqual(moved.tubes[0], ['red'], 'applyMove leaves source minus top');
  assert.strictEqual(b.tubes[0].length, 2, 'applyMove is immutable (source untouched)');
  ok('applyMove moves the top ball immutably');
}

// ── win + progress ────────────────────────────────────────────────────────────
{
  const won = { tubeCapacity: 2, colors: ['red','blue'], tubes: [['red','red'], ['blue','blue'], []] };
  assert.strictEqual(isWin(won), true, 'all tubes single-colour-full or empty → win');
  assert.strictEqual(progress(won), 1, 'fully sorted → progress 1');

  const mid = { tubeCapacity: 2, colors: ['red','blue'], tubes: [['red','red'], ['blue','red'], []] };
  assert.strictEqual(isWin(mid), false, 'mixed tube → not won');
  assert.ok(progress(mid) > 0 && progress(mid) < 1, 'partial board → 0 < progress < 1');
  ok('isWin + progress compute board completeness');
}

// ── random board fairness ──────────────────────────────────────────────────────
{
  const r = randomBoard('classic');
  const counts = {};
  r.tubes.flat().forEach(c => { counts[c] = (counts[c] || 0) + 1; });
  for (const color of r.colors) {
    assert.strictEqual(counts[color], r.tubeCapacity, `every colour appears exactly tubeCapacity times (${color})`);
  }
  assert.strictEqual(r.tubes.filter(t => t.length === 0).length, r.tubes.length - r.colors.length, 'exactly the spare tubes are empty');
  ok('randomBoard distributes a fair, solvable ball pool');

  // seeded rand → reproducible
  const seq = [0.1, 0.9, 0.3, 0.7, 0.5, 0.2, 0.8, 0.4, 0.6, 0.05];
  let i = 0; const rand = () => seq[(i++) % seq.length];
  let j = 0; const rand2 = () => seq[(j++) % seq.length];
  assert.deepStrictEqual(randomBoard('easy', rand).tubes, randomBoard('easy', rand2).tubes, 'same rand seq → identical board');
  ok('randomBoard accepts an injectable rand for reproducible boards');
}

// ── scoring ────────────────────────────────────────────────────────────────────
{
  const movesItem = { mode: 'moves' };
  const timeItem  = { mode: 'time' };
  const a = scoreBallsort({ value: { solved: true, moveCount: 10 }, item: movesItem });
  const b = scoreBallsort({ value: { solved: true, moveCount: 40 }, item: movesItem });
  assert.ok(a.correct && b.correct, 'solved boards are correct');
  assert.ok(a.points > b.points, 'fewer moves → more points');

  const t1 = scoreBallsort({ value: { solved: true, elapsedMs: 10000 }, item: timeItem });
  const t2 = scoreBallsort({ value: { solved: true, elapsedMs: 60000 }, item: timeItem });
  assert.ok(t1.points > t2.points, 'less time → more points');

  const slow = scoreBallsort({ value: { solved: true, moveCount: 9999 }, item: movesItem });
  assert.strictEqual(slow.points, 200, 'a solve never scores below the floor');

  const partial = scoreBallsort({ value: { solved: false, tubes: [['red','red'],['blue','blue'],['red','blue']], tubeCapacity: 2 }, item: movesItem });
  assert.strictEqual(partial.correct, false, 'unsolved is not correct');
  assert.ok(partial.points > 0 && partial.points <= 300, 'unsolved gets bounded partial credit');
  // Mérito FRACCIONAL (P5): hits = % ordenado sobre 100 → la tabla muestra
  // "73/100" y el ranking por aciertos ordena por progreso aunque nadie termine.
  assert.strictEqual(partial.total, 100, 'mérito sobre 100');
  assert.ok(partial.hits > 0 && partial.hits < 100, 'tablero a medias → mérito parcial');
  assert.deepStrictEqual([a.hits, a.total], [100, 100], 'resuelto = mérito 100/100');
  ok('scoreBallsort ranks by mode and floors a solve above any partial (+mérito %)');
}

// ── template contract ───────────────────────────────────────────────────────────
{
  const T = getTemplate('ballsort');
  assert.ok(T, 'ballsort registers in the registry');
  assert.strictEqual(T.meta.modes.live, true, 'declares live');
  assert.deepStrictEqual(T.meta.play.live, ['board'], "declara play.live ['board'] (tablero compartido; el catálogo de bucles es una LISTA, §26)");
  assert.strictEqual(typeof T.getRoundPayload, 'function', 'has getRoundPayload (live requirement)');
  assert.strictEqual(typeof T.scoreSubmission, 'function', 'has scoreSubmission (live requirement)');

  const act = { template: 'ballsort', content: T.meta.defaultContent() };
  const payload = T.getRoundPayload(act, { itemIndex: 0 });
  assert.ok(payload.board?.tubes?.length, 'getRoundPayload returns a board');
  assert.ok(['moves','time'].includes(payload.mode), 'payload carries the mode');
  ok('template satisfies the live contract (payload + scorer + flags)');
}

// ── VS compatibility (single shared board) ──────────────────────────────────────
{
  const T = getTemplate('ballsort');
  const act = { template: 'ballsort', content: T.meta.defaultContent() };
  assert.strictEqual(act.content.items.length, 1, 'one board per activity');
  assert.strictEqual(isVsCompatible(act), true, 'a 1-board play.live=board template IS VS-compatible (same board both sides)');

  // both sides receive the SAME board (fairness): getRoundPayload ignores side.
  const left  = T.getRoundPayload(act, { itemIndex: 0, side: 'left' });
  const right = T.getRoundPayload(act, { itemIndex: 0, side: 'right' });
  assert.deepStrictEqual(left.board.tubes, right.board.tubes, 'both VS sides get the identical starting board');

  // a NON-liveBoard template with a single item is still NOT VS-compatible.
  registerTemplate({ meta: { name: 't_single', contentModel: 'qa', modes: { live: true } },
    renderPlayer(){}, renderEditor(){}, renderRound(){}, getRoundPayload(){}, scoreSubmission(){ return { correct:false, points:0 }; } });
  const single = { template: 't_single', content: { items: [{}] } };
  assert.strictEqual(isVsCompatible(single), false, 'a normal 1-item template needs ≥2 items for VS');
  ok('Ball Sort is VS-compatible with one shared board; normal templates still need ≥2 items');
}

console.log(`\nballsort.test: ${passed} checks passed`);
