// SOLO + LIVE-student player UI for the quiz template.
// Mode is determined by opts.mode = 'solo' | 'live-student'.
// In live-student mode, opts handles network calls (submit). In solo, scoring is local.
// Loop/timer/finish are handled by the SequentialShell (core/soloPlayer.js);
// this core renders the de rejilla de opciones options grid and scores each click.
import { html, escapeHtml, mount } from '../../core/html.js';
import { SHAPE_ICONS } from '../../core/roundRender.js';
import { on } from '../../core/events.js';
import { scoreQuizSubmission } from './scorer.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import * as Streaks from '../../core/streaks.js';
import { shuffle } from '../../core/azar.js';
import { runSequentialPlayer } from '../../core/soloPlayer.js';
import { cabeceraHtml } from '../../core/playerHud.js';
import { clock } from '../../core/clock.js';



/**
 * @typedef {import('../../kernel/contracts/activity.js').QaItem} QaItem
 */

/**
 * @param {string|Element} rootSel
 * @param {import('../../kernel/contracts/activity.js').Activity} activity
 * @param {import('../../kernel/contracts/template.js').PlayerOpts} [opts]
 * @returns {Promise<void>}
 */
export async function renderQuizPlayer(rootSel, activity, opts = {}) {
  // Techo = lo que da el PROPIO scorer si se acierta todo al instante
  // (msTaken 0 → bonus de velocidad máximo). Derivarlo así evita la copia local
  // de la fórmula del bonus por velocidad que antes vivía aquí: una sola verdad para el
  // numerador y el denominador del "X / max".
  /** @param {QaItem[]} items @returns {number} */
  function maxScore(items) {
    if (activity.scoring?.maxScore) return activity.scoring.maxScore;
    return items.reduce((sum, it) =>
      sum + scoreQuizSubmission({ value: it.answer, item: it, msTaken: 0, activity }).points, 0);
  }

  /** @type {import('../../core/soloPlayer.js').SequentialCallbacks<QaItem>} */
  const callbacks = {
    maxScore,
    onFinish() { Streaks.reset('solo', activity.id); },
    renderItem({ rootSel, item, idx, total, timerSecs, submit, alAgotarse }) {
      const opts2 = (item.options || []).slice();
      if (activity.rules?.shuffleOptions) shuffle(opts2);
      const streak = Streaks.get('solo', activity.id);
      mount(rootSel, html`
        <div class="ww-player">
          ${cabeceraHtml({
            pagina: `${idx + 1} / ${total}`,
            racha: streak >= 2 ? String(streak) : undefined,   // el 🔥 lo pone el chip (core/playerHud.js)
          })}
          <div class="edu-sec edu-sec--enunciado ww-prow">
            <h3 class="ww-q">${escapeHtml(item.question)}</h3>
          </div>
          ${item.image ? `<div class="ww-q-media"><img src="${escapeHtml(item.image)}" alt=""></div>` : ''}
          <div class="edu-sec edu-sec--tablero ww-opt-grid ww-options">
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
      /** @returns {HTMLButtonElement[]} */
      const opts$ = () => {
        // `rootSel` puede llegar como ELEMENTO (lo declara el shell): interpolarlo
        // en un selector daba «[object HTMLElement] .ww-opt», que no casa con nada.
        const nodos = typeof rootSel === 'string'
          ? document.querySelectorAll(`${rootSel} .ww-opt`)
          : rootSel.querySelectorAll('.ww-opt');
        return [...nodos].map(b => /** @type {HTMLButtonElement} */ (b));
      };

      function revealCorrect() {
        if (item.answer == null) return;
        // answer may be a single value OR an array (multi-correct); highlight
        // every correct option, not just when String(array) accidentally matches.
        const correct = (Array.isArray(item.answer) ? item.answer : [item.answer]).map(String);
        opts$().forEach(b => {
          if (b.dataset.value !== undefined && correct.includes(b.dataset.value)) b.classList.add('btn-success');
        });
      }

      // El reloj lo monta y lo pinta el SHELL (core/reloj.js, uno para todas):
      // aquí solo se dice qué pasa cuando se acaba.
      alAgotarse(() => {
        opts$().forEach(b => { b.disabled = true; });
        revealCorrect();
        Streaks.bump('solo', activity.id, false);
        emitGame(GameEvents.ANSWER_WRONG, { idx });
        submit({ itemId: item.id, value: null, correct: false, points: 0, msTaken: timerSecs * 1000 });
      });

      on(rootSel, 'click', '.ww-opt', (_, el) => {
        const btn = /** @type {HTMLButtonElement} */ (el);
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
  };
  runSequentialPlayer(rootSel, activity, opts, callbacks);
}
