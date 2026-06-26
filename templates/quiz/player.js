// SOLO + LIVE-student player UI for the quiz template.
// Mode is determined by opts.mode = 'solo' | 'live-student'.
// In live-student mode, opts handles network calls (submit). In solo, scoring is local.
// Loop/timer/finish are handled by the SequentialShell (core/soloPlayer.js);
// this core renders the kahoot-style options grid and scores each click.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { scoreQuizSubmission } from './scorer.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import * as Streaks from '../../core/streaks.js';
import { shuffle } from '../../core/roundRender.js';
import { runSequentialPlayer } from '../../core/soloPlayer.js';

const SHAPE_ICONS = ['bi-triangle-fill', 'bi-diamond-fill', 'bi-circle-fill', 'bi-square-fill'];

export async function renderQuizPlayer(rootSel, activity, opts = {}) {
  function maxScore(items) {
    const scoring = activity.scoring || {};
    if (scoring.maxScore) return scoring.maxScore;
    // Kahoot scoring gives base*500 + speedBonus per correct, so the flat
    // pointsPerCorrect*items max read "7000 / 5". Compute the real ceiling:
    // every scorable item answered correctly and instantly.
    if (scoring.mode === 'kahoot') {
      const speedBonus = activity.live?.speedBonusMax ?? 1000;
      const ppc = scoring.pointsPerCorrect || 1;
      return items.reduce((sum, it) =>
        it.answer != null ? sum + (it.points || ppc) * 500 + speedBonus : sum, 0);
    }
    return (scoring.pointsPerCorrect || 1) * items.length;
  }

  runSequentialPlayer(rootSel, activity, opts, {
    maxScore,
    onFinish() { Streaks.reset('solo', activity.id); },
    renderItem({ rootSel, item, idx, total, score, timerSecs, submit, startTimer }) {
      const opts2 = (item.options || []).slice();
      if (activity.rules?.shuffleOptions) shuffle(opts2);
      const streak = Streaks.get('solo', activity.id);
      mount(rootSel, html`
        <div class="ww-player">
          <div class="ww-phead d-flex justify-content-between align-items-center">
            <span class="badge bg-secondary">${idx + 1} / ${total}</span>
            ${streak >= 2 ? `<span class="badge bg-warning text-dark">🔥 ${streak}</span>` : ''}
            ${timerSecs > 0 ? `<span class="badge bg-danger ww-timer-badge">⏱ ${timerSecs}</span>` : ''}
            <span class="badge bg-primary">★ ${score}</span>
          </div>
          <h3 class="ww-q">${escapeHtml(item.question)}</h3>
          <div class="ww-q-media">${item.image ? `<img src="${escapeHtml(item.image)}" alt="">` : ''}</div>
          <div class="ww-kahoot-grid ww-options">
            ${opts2.map((o, i) => `
              <button class="btn btn-lg w-100 ww-opt ww-shape-${(i % 4) + 1}" data-value="${escapeHtml(o)}">
                <i class="bi ${SHAPE_ICONS[i % 4]} me-2"></i>${escapeHtml(o)}
              </button>`).join('')}
          </div>
        </div>
      `);

      const t0 = Date.now();

      function revealCorrect() {
        if (item.answer == null) return;
        // answer may be a single value OR an array (multi-correct); highlight
        // every correct option, not just when String(array) accidentally matches.
        const correct = (Array.isArray(item.answer) ? item.answer : [item.answer]).map(String);
        document.querySelectorAll('.ww-opt').forEach(b => {
          if (correct.includes(b.dataset.value)) b.classList.add('btn-success');
        });
      }

      startTimer({
        onTick: (remaining) => {
          const el = document.querySelector('.ww-timer-badge');
          if (el) el.textContent = `⏱ ${remaining}`;
        },
        onTimeout: () => {
          document.querySelectorAll('.ww-opt').forEach(b => { b.disabled = true; });
          revealCorrect();
          Streaks.bump('solo', activity.id, false);
          emitGame(GameEvents.ANSWER_WRONG, { idx });
          submit({ itemId: item.id, value: null, correct: false, points: 0, msTaken: timerSecs * 1000 });
        },
      });

      on(rootSel, 'click', '.ww-opt', (_, btn) => {
        if (btn.disabled) return;
        const ms = Date.now() - t0;
        const value = btn.dataset.value;
        const r = scoreQuizSubmission({ value, item, msTaken: ms, activity });
        document.querySelectorAll('.ww-opt').forEach(b => b.disabled = true);
        btn.classList.add(r.correct ? 'btn-success' : 'btn-danger');
        if (!r.correct) revealCorrect();
        const newStreak = Streaks.bump('solo', activity.id, r.correct === true);
        if (r.correct === true) {
          emitGame(GameEvents.ANSWER_CORRECT, { idx, points: r.points, streak: newStreak });
          if (newStreak >= 2) emitGame(GameEvents.STREAK, { count: newStreak });
        } else if (r.correct === false) {
          emitGame(GameEvents.ANSWER_WRONG, { idx });
        }
        submit({ itemId: item.id, value, correct: r.correct, points: r.points, msTaken: ms });
      });
    },
  });
}
