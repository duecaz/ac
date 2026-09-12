// SequentialShell tests (core/soloPlayer.js). Validate the item-loop the
// Quiz/Math cores delegate to: iterate each item once, accumulate
// score, advance exactly once per item (submit is idempotent), honour a
// maxScore override, and finish with onFinish + result screen.
// Run: node tests/soloPlayer.test.mjs
import assert from 'node:assert';
import { runSequentialPlayer, runFreeformPlayer } from '../core/soloPlayer.js';
import { GameEvents, onGame } from '../core/gameEvents.js';

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

  // ── manual advance: submit({auto:false}) waits for ctx.next() (animation-driven pacing) ─
  {
    const root = makeRoot();
    const seen = [];
    const pending = [];   // captured next() callbacks, one per item
    runSequentialPlayer(root, baseActivity, { mode: 'async-tracked', onFinish: () => {} }, {
      renderItem({ item, idx, submit, next }) {
        seen.push(idx);
        submit({ itemId: item.id, correct: true, points: 1 }, { auto: false });
        pending.push(next);   // do NOT advance yet — emulate an in-flight animation
      },
    });
    drain();
    assert.deepStrictEqual(seen, [0], 'auto:false no avanza solo: queda en el ítem 0');
    pending.shift()();        // animation done → advance to item 1
    drain();
    assert.deepStrictEqual(seen, [0, 1], 'ctx.next() avanza al siguiente ítem');
    ok('runSequentialPlayer: avance manual (auto:false + next)');
  }

  // ── early finish + custom result screen (e.g. reaching a finish line) ─────
  {
    const root = makeRoot();
    let finalScore = null;
    runSequentialPlayer(root, baseActivity, { mode: 'async-tracked', onFinish: (s) => { finalScore = s.score; } }, {
      resultScreen: ({ state }) => ({ lead: `Recorrido ${state.score}`, stats: 'meta' }),
      renderItem({ item, idx, submit, finish }) {
        submit({ itemId: item.id, correct: true, points: 5 }, { auto: false });
        if (idx === 0) finish();   // end on the very first item
        else throw new Error('no debe renderizar más ítems tras finish()');
      },
    });
    drain();
    assert.strictEqual(finalScore, 5, 'finish() temprano cierra con el score acumulado');
    assert.ok(root.innerHTML.includes('Recorrido 5'), 'usa el resultScreen personalizado');
    ok('runSequentialPlayer: finish() temprano + resultScreen personalizado');
  }

  // ── reanudar (F5) en modo solo: guarda avance y lo retoma ───────────────────
  {
    const mem = new Map();
    global.localStorage = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: (k) => { mem.delete(k); },
    };
    const act = { ...baseActivity, id: 'resume1', template: 'quiz', updatedAt: 'u1' };

    // Sesión 1: responde el ítem 0 (avanza a 1) y "recarga" ahí (no responde el 1).
    runSequentialPlayer(makeRoot(), act, { mode: 'solo' }, {
      renderItem({ idx, item, submit }) { if (idx === 0) submit({ itemId: item.id, correct: true, points: 1 }); },
    });
    drain();

    // Sesión 2 (F5): nueva instancia, misma actividad → reanuda en el ítem 1.
    const seen2 = []; let scoreAtStart = null;
    runSequentialPlayer(makeRoot(), act, { mode: 'solo' }, {
      renderItem({ idx, score, item, submit }) {
        seen2.push(idx);
        if (scoreAtStart === null) scoreAtStart = score;
        submit({ itemId: item.id, correct: true, points: 1 });
      },
    });
    drain();
    assert.strictEqual(seen2[0], 1, 'reanuda en el ítem 1 (no empieza de 0)');
    assert.strictEqual(scoreAtStart, 1, 'conserva el punto ya logrado en el ítem 0');

    // Sesión 3: al haber TERMINADO la 2, el progreso se limpió → empieza de 0.
    const seen3 = [];
    runSequentialPlayer(makeRoot(), act, { mode: 'solo' }, {
      renderItem({ idx, item, submit }) { seen3.push(idx); submit({ itemId: item.id, correct: true, points: 1 }); },
    });
    drain();
    assert.strictEqual(seen3[0], 0, 'tras terminar, empieza de 0 (progreso limpiado)');

    // Live NO reanuda aunque haya progreso guardado de otra actividad.
    const actL = { ...baseActivity, id: 'resume2', updatedAt: 'u1' };
    runSequentialPlayer(makeRoot(), actL, { mode: 'solo' }, {
      renderItem({ idx, item, submit }) { if (idx === 0) submit({ itemId: item.id, correct: true, points: 1 }); },
    });
    drain();
    const seenLive = [];
    runSequentialPlayer(makeRoot(), actL, { mode: 'live-student' }, {
      renderItem({ idx, item, submit }) { seenLive.push(idx); submit({ itemId: item.id, correct: true, points: 1 }); },
    });
    drain();
    assert.strictEqual(seenLive[0], 0, 'Live no reanuda (empieza de 0)');
    ok('runSequentialPlayer: reanuda solo en modo individual; limpia al terminar; Live no reanuda');
    delete global.localStorage;
  }

  // ── reanudar FREEFORM (Memoria): saveProgress/loadProgress round-trip ───────
  {
    const mem = new Map();
    global.localStorage = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: (k) => { mem.delete(k); },
    };
    const act = { id: 'ff1', updatedAt: 'u1', scoring: {} };
    const ctx = runFreeformPlayer(makeRoot(), act, { mode: 'solo' });
    assert.strictEqual(ctx.loadProgress(), null, 'sin progreso guardado → null');
    ctx.saveProgress({ deckIds: ['a', 'b'], score: 3 });
    // Nueva instancia (F5) recupera el snapshot.
    const ctx2 = runFreeformPlayer(makeRoot(), act, { mode: 'solo' });
    assert.deepStrictEqual(ctx2.loadProgress(), { deckIds: ['a', 'b'], score: 3 }, 'reanuda el snapshot guardado');
    // Terminar limpia el progreso.
    ctx2.finish({ score: 3, maxScore: 3, skipResultScreen: true });
    assert.strictEqual(runFreeformPlayer(makeRoot(), act, { mode: 'solo' }).loadProgress(), null, 'tras finish → limpio');
    // Otra versión de la actividad (updatedAt distinto) NO reanuda.
    runFreeformPlayer(makeRoot(), act, { mode: 'solo' }).saveProgress({ deckIds: ['a', 'b'], score: 1 });
    assert.strictEqual(runFreeformPlayer(makeRoot(), { ...act, updatedAt: 'u2' }, { mode: 'solo' }).loadProgress(), null, 'updatedAt distinto → no reanuda');
    // Live no reanuda.
    runFreeformPlayer(makeRoot(), { ...act, id: 'ff2' }, { mode: 'live-student' }).saveProgress({ x: 1 });
    assert.strictEqual(runFreeformPlayer(makeRoot(), { ...act, id: 'ff2' }, { mode: 'live-student' }).loadProgress(), null, 'freeform Live no reanuda');
    ok('runFreeformPlayer: saveProgress/loadProgress reanuda en solo; limpia al terminar; invalida por updatedAt; Live no');
    delete global.localStorage;
  }

  // Los dos bloques que siguen cierran partidas → el shell guarda el resultado
  // (cola offline en el almacén): sin un `localStorage` de mentira, la consola
  // se llena de avisos ajenos a lo que se comprueba.
  const memFin = new Map();
  global.localStorage = {
    getItem: (k) => (memFin.has(k) ? memFin.get(k) : null),
    setItem: (k, v) => { memFin.set(k, String(v)); },
    removeItem: (k) => { memFin.delete(k); },
  };

  // ── EL PODIO LO EMITE EL SHELL, Y UNA SOLA VEZ ─────────────────────────────
  // El podio enciende el sonido, el confeti y la meta de la rana (core/sounds,
  // core/effects, core/soloAnimator). Lo emitían SEIS players a mano y otros
  // seis se quedaban sin él; ahora lo pone el shell al cerrar. Si alguno vuelve
  // a copiarlo, se oye DOS veces — por eso la cuenta es exacta, no «≥1».
  {
    /** @param {() => void} jugar */
    const podiosDe = (jugar) => {
      const vistos = [];
      const off = onGame(GameEvents.PODIUM, (detalle) => vistos.push(detalle));
      try { jugar(); drain(); } finally { off(); }
      return vistos;
    };

    const libre = podiosDe(() => {
      const ctx = runFreeformPlayer(makeRoot(), { id: 'pod1', rules: {}, scoring: {} }, { mode: 'solo' });
      ctx.finish({ score: 7, maxScore: 10 });
      ctx.finish({ score: 7, maxScore: 10 });   // un segundo final no suena otra vez
    });
    assert.strictEqual(libre.length, 1, 'el shell LIBRE emite PODIUM exactamente una vez');
    assert.strictEqual(libre[0].top[0].score, 7, 'el podio lleva el puntaje final');

    const sec = podiosDe(() => {
      runSequentialPlayer(makeRoot(), baseActivity, { mode: 'solo' }, {
        renderItem({ item, submit }) { submit({ itemId: item.id, correct: true, points: 1 }); },
      });
    });
    assert.strictEqual(sec.length, 1, 'el shell SECUENCIAL emite PODIUM exactamente una vez');
    assert.strictEqual(sec[0].top[0].score, 3, 'el podio lleva el puntaje final');
    ok('PODIUM: lo emite el shell (libre y secuencial), exactamente una vez por partida');
  }

  // ── los dos shells cierran IGUAL (un solo `cerrarPartida`) ────────────────
  // El cierre estaba escrito dos veces y en distinto orden. Ahora lo pone
  // `cerrarPartida`: guardar → pintar → avisar al caller. Lo observable desde
  // Node es que pintar precede al `onFinish` del caller en AMBOS shells (el
  // guardado es asíncrono y no deja huella síncrona).
  {
    const orden = [];
    const root = { querySelector: () => null, querySelectorAll: () => [],
      set innerHTML(_v) { orden.push('pintar'); }, get innerHTML() { return ''; } };
    const ctx = runFreeformPlayer(root, { id: 'ord1', rules: {}, scoring: {} },
      { mode: 'async-tracked', onFinish: () => { orden.push('onFinish'); } });
    ctx.finish({ score: 1, maxScore: 1 });
    assert.deepStrictEqual(orden, ['pintar', 'onFinish'], 'pinta y luego avisa al caller');

    const orden2 = [];
    const root2 = { querySelector: () => null, querySelectorAll: () => [],
      set innerHTML(_v) { orden2.push('pintar'); }, get innerHTML() { return ''; } };
    runSequentialPlayer(root2, { id: 'ord2', rules: {}, scoring: {}, content: { items: [] } },
      { mode: 'async-tracked', onFinish: () => { orden2.push('onFinish'); } },
      { renderItem() {} });
    drain();
    assert.deepStrictEqual(orden2, ['pintar', 'onFinish'], 'el secuencial cierra en el mismo orden que el libre');
    ok('cerrarPartida: los dos shells cierran con el mismo orden');
  }
  delete global.localStorage;
} finally {
  global.setTimeout = realSetTimeout;
}

console.log(`\nsoloPlayer.test: ${passed} checks passed`);
