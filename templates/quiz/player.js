// SOLO + LIVE-student player UI for the quiz template.
// Mode is determined by opts.mode = 'solo' | 'live-student'.
// In live-student mode, opts handles network calls (submit). In solo, scoring is local.
// Loop/timer/finish are handled by the SequentialShell (core/soloPlayer.js);
// this core renders the kahoot-style options grid and scores each click.
import { html, escapeHtml, mount } from '../../core/html.js';
import { SHAPE_ICONS } from '../../core/roundRender.js';
import { on } from '../../core/events.js';
import { scoreQuizSubmission } from './scorer.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import * as Streaks from '../../core/streaks.js';
import { shuffle } from '../../core/roundRender.js';
import { runSequentialPlayer } from '../../core/soloPlayer.js';
import { hudHtml, hudSet } from '../../core/playerHud.js';
import { clock } from '../../core/clock.js';



export async function renderQuizPlayer(rootSel, activity, opts = {}) {
  // Techo = lo que da el PROPIO scorer si se acierta todo al instante
  // (msTaken 0 → bonus de velocidad máximo). Derivarlo así evita la copia local
  // de la fórmula Kahoot que antes vivía aquí: una sola verdad para el
  // numerador y el denominador del "X / max".
  function maxScore(items) {
    if (activity.scoring?.maxScore) return activity.scoring.maxScore;
    return items.reduce((sum, it) =>
      sum + scoreQuizSubmission({ value: it.answer, item: it, msTaken: 0, activity }).points, 0);
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
          ${hudHtml({
            pagina: `${idx + 1} / ${total}`,
            racha: streak >= 2 ? `🔥 ${streak}` : null,
            tiempo: timerSecs > 0 ? `⏱ ${timerSecs}` : null,
          })}
          <div class="edu-sec edu-sec--enunciado ww-prow">
            <h3 class="ww-q">${escapeHtml(item.question)}</h3>
          </div>
          ${item.image ? `<div class="ww-q-media"><img src="${escapeHtml(item.image)}" alt=""></div>` : ''}
          <div class="edu-sec edu-sec--tablero ww-kahoot-grid ww-options">
            ${opts2.map((o, i) => `
              <button class="btn btn-lg w-100 ww-opt ww-shape-${(i % 4) + 1}" data-value="${escapeHtml(o)}">
                <i class="bi ${SHAPE_ICONS[i % 4]} me-2"></i>${escapeHtml(o)}
              </button>`).join('')}
          </div>
        </div>
      `);

      const t0 = clock.now();

      // Acotado al root del player (C7): '.ww-opt' a documento entero rompería
      // con dos players montados (p.ej. una miniatura + el juego, o tests).
      const opts$ = () => document.querySelectorAll(`${rootSel} .ww-opt`);

      function revealCorrect() {
        if (item.answer == null) return;
        // answer may be a single value OR an array (multi-correct); highlight
        // every correct option, not just when String(array) accidentally matches.
        const correct = (Array.isArray(item.answer) ? item.answer : [item.answer]).map(String);
        opts$().forEach(b => {
          if (correct.includes(b.dataset.value)) b.classList.add('btn-success');
        });
      }

      startTimer({
        onTick: (remaining) => hudSet(rootSel, 'tiempo', `⏱ ${remaining}`),
        onTimeout: () => {
          opts$().forEach(b => { b.disabled = true; });
          revealCorrect();
          Streaks.bump('solo', activity.id, false);
          emitGame(GameEvents.ANSWER_WRONG, { idx });
          submit({ itemId: item.id, value: null, correct: false, points: 0, msTaken: timerSecs * 1000 });
        },
      });

      on(rootSel, 'click', '.ww-opt', (_, btn) => {
        if (btn.disabled) return;
        const ms = clock.now() - t0;
        const value = btn.dataset.value;
        const r = scoreQuizSubmission({ value, item, msTaken: ms, activity });
        opts$().forEach(b => b.disabled = true);
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
