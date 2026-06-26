// FreeformShell: guarantees resultScreenHtml + trySaveResult + onFinish for
// players whose finish moment is not a sequential item-by-item loop
// (Wheel, Question-Live, Memory, Match, Wordsearch, Crossword).
//
// Usage:
//   const ctx = runFreeformPlayer(rootSel, activity, opts);
//   // ... player-specific logic ...
//   ctx.finish({ score, maxScore, lead, stats });  // call once when done
import { mount } from './html.js';
import { resultScreenHtml } from './resultScreen.js';
import { trySaveResult } from './results.js';
import { FEEDBACK_DELAY } from './constants.js';
import { GameEvents, emitGame } from './gameEvents.js';
import { shuffle } from './roundRender.js';
import { createCountdown } from './soloTimer.js';

export function runFreeformPlayer(rootSel, activity, opts = {}) {
  const startedAt = Date.now();
  let finished = false;

  function finish({
    score = 0,
    maxScore = 0,
    lead = '',
    stats = '',
    title = undefined,
    icon = undefined,
    iconColor = undefined,
    skipResultScreen = false,
  } = {}) {
    if (finished) return;
    finished = true;

    const timeUsed = Math.round((Date.now() - startedAt) / 1000);

    trySaveResult(opts, {
      activityId: activity.id,
      scoreAuto: score,
      scoreFinal: score,
      maxScore,
      timeUsed,
    });

    if (!skipResultScreen) {
      mount(rootSel, resultScreenHtml({ icon, iconColor, title, lead, stats, score, maxScore }));
    }

    if (opts.onFinish) opts.onFinish({ score, maxScore, timeUsed });
  }

  return { finish };
}

// SequentialShell: drives the item-by-item loop common to Quiz, Math, Froggy.
// The shell owns: items prep (+randomize), state, idx++, optional per-item
// timer, finish() (timeUsed, maxScore, result screen, trySaveResult, onFinish)
// and the QUESTION_SHOWN / PODIUM emits. The CORE (per template) only decides
// HOW to render an item and HOW to score it.
//
// Usage:
//   runSequentialPlayer(rootSel, activity, opts, {
//     renderItem(ctx) {            // ctx = { rootSel, activity, item, idx, total, score, state, timerSecs, submit, startTimer }
//       // ...render the item-specific UI...
//       // on answer: ctx.submit({ itemId, value, correct, points, msTaken });
//       // optional: ctx.startTimer({ onTick, onTimeout });
//     },
//     maxScore(items, activity) { return n; },  // optional override
//   });
//
// submit() adds points to the running score, records the answer, stops any
// active timer, and schedules the next item after FEEDBACK_DELAY. It is
// idempotent within an item (a timeout-then-click, or vice versa, advances once).
export function runSequentialPlayer(rootSel, activity, opts = {}, callbacks = {}) {
  const source = activity.content?.items || [];
  const items = (activity.rules?.randomize ? shuffle(source.slice()) : source).slice();
  const state = { idx: 0, score: 0, startedAt: Date.now(), answers: [] };
  const timerSecs = activity.rules?.timer ?? 0;

  const maxScore = () => (callbacks.maxScore
    ? callbacks.maxScore(items, activity)
    : (activity.scoring?.maxScore || ((activity.scoring?.pointsPerCorrect || 1) * items.length)));

  let timerHandle = null;
  let advanced = false;
  function stopTimer() { if (timerHandle) { timerHandle.stop(); timerHandle = null; } }

  function advance(record) {
    if (advanced) return;
    advanced = true;
    stopTimer();
    if (record) {
      state.score += record.points || 0;
      state.answers.push(record);
    }
    setTimeout(() => { state.idx++; renderItem(); }, callbacks.feedbackDelay ?? FEEDBACK_DELAY);
  }

  function startTimer({ onTick, onTimeout } = {}) {
    if (!(timerSecs > 0)) return null;
    stopTimer();
    timerHandle = createCountdown(timerSecs, {
      onTick,
      onTimeout: () => { timerHandle = null; onTimeout?.(); },
    });
    timerHandle.start();
    return timerHandle;
  }

  function renderItem() {
    advanced = false;
    stopTimer();
    if (state.idx >= items.length) return finish();
    const item = items[state.idx];
    emitGame(GameEvents.QUESTION_SHOWN, { idx: state.idx, total: items.length, item });
    callbacks.renderItem({
      rootSel, activity, item,
      idx: state.idx, total: items.length,
      score: state.score, state, timerSecs,
      submit: advance,
      startTimer,
    });
  }

  function finish() {
    stopTimer();
    const timeUsed = Math.round((Date.now() - state.startedAt) / 1000);
    const max = maxScore();
    emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score: state.score }] });
    if (!callbacks.skipResultScreen) {
      mount(rootSel, resultScreenHtml({
        lead: `Puntos: <b>${state.score}</b> / ${max}`,
        stats: `Tiempo: ${timeUsed}s`,
        score: state.score, maxScore: max,
      }));
    }
    trySaveResult(opts, { activityId: activity.id, scoreAuto: state.score, scoreFinal: state.score, maxScore: max, timeUsed });
    // Template-level teardown (e.g. reset streaks) runs before the caller's hook.
    callbacks.onFinish?.(state);
    if (opts.onFinish) opts.onFinish(state);
  }

  renderItem();
  return { state };
}
