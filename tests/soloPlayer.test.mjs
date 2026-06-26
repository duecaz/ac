// SequentialShell tests (core/soloPlayer.js). Validate the item-loop the
// Quiz/Math/Froggy cores delegate to: iterate each item once, accumulate
// score, advance exactly once per item (submit is idempotent), honour a
// maxScore override, and finish with onFinish + result screen.
// Run: node tests/soloPlayer.test.mjs
import assert from 'node:assert';
import { runSequentialPlayer } from '../core/soloPlayer.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Minimal element for mount(): just captures innerHTML.
const makeRoot = () => ({ innerHTML: '', querySelector: () => null, querySelectorAll: () => [] });

// Fake timer that DEFERS (queues) callbacks rather than running them inline —
// this preserves real async ordering: each renderItem call fully returns (both
// submits run) before the next item's advance fires. An inline fake would
// recurse and reset the idempotency guard, masking the very behaviour we test.
const realSetTimeout = global.setTimeout;
const timerQueue = [];
global.setTimeout = (fn) => { timerQueue.push(fn); return timerQueue.length; };
const drain = () => { while (timerQueue.length) timerQueue.shift()(); };

try {
  const baseActivity = {
    id: 'm1', template: 'math', rules: {},
    scoring: { mode: 'flat', pointsPerCorrect: 1 },
    content: { items: [
      { id: 'a', question: '2+2', answer: '4' },
      { id: 'b', question: '3+3', answer: '6' },
      { id: 'c', question: '1+1', answer: '2' },
    ] },
  };

  // ── iterate once per item, idempotent submit, score accumulation ────────────
  {
    const root = makeRoot();
    const seen = [];
    let finishState = null;
    runSequentialPlayer(root, baseActivity, { mode: 'async-tracked', onFinish: (s) => { finishState = s; } }, {
      renderItem({ item, idx, submit }) {
        seen.push(idx);
        submit({ itemId: item.id, value: item.answer, correct: true, points: 1, msTaken: 0 });
        // Second call must be ignored — a timeout-then-click can't double-advance.
        submit({ itemId: item.id, value: 'x', correct: false, points: 99, msTaken: 0 });
      },
    });
    drain();
    assert.deepStrictEqual(seen, [0, 1, 2], 'renderiza cada ítem una vez, en orden');
    assert.strictEqual(finishState.score, 3, 'puntos = 3 (segundo submit ignorado)');
    assert.strictEqual(finishState.answers.length, 3, 'un answer por ítem');
    assert.ok(root.innerHTML.includes('/ 3'), 'pantalla final muestra max = sum(ppc·items)');
    ok('runSequentialPlayer: itera ítems, submit idempotente, suma puntos');
  }

  // ── maxScore override is honoured ──────────────────────────────────────────
  {
    const root = makeRoot();
    runSequentialPlayer(root, baseActivity, { mode: 'async-tracked', onFinish: () => {} }, {
      maxScore: () => 999,
      renderItem({ item, submit }) { submit({ itemId: item.id, correct: true, points: 0, msTaken: 0 }); },
    });
    drain();
    assert.ok(root.innerHTML.includes('/ 999'), 'usa el maxScore override');
    ok('runSequentialPlayer: maxScore override aplicado');
  }

  // ── empty items → finishes immediately ─────────────────────────────────────
  {
    const root = makeRoot();
    let finished = false;
    runSequentialPlayer(root, { id: 'e', rules: {}, scoring: {}, content: { items: [] } },
      { mode: 'async-tracked', onFinish: () => { finished = true; } },
      { renderItem() { throw new Error('no debe renderizar ningún ítem'); } });
    assert.ok(finished, 'sin ítems termina de inmediato sin renderItem');
    ok('runSequentialPlayer: lista vacía termina sin error');
  }
} finally {
  global.setTimeout = realSetTimeout;
}

console.log(`\nsoloPlayer.test: ${passed} checks passed`);
