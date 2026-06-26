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
