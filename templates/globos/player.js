// Explota Globos — player SOLO sobre el SHELL SECUENCIAL (core/soloPlayer.js).
// El core pinta la pregunta + el campo de globos y registra la respuesta; el
// shell maneja bucle, timer, finish y trySaveResult. El campo de globos
// (balloonFieldHtml/wireBalloonField) lo REUTILIZA la ronda VS (template.js).
import { html, escapeHtml, mount } from '../../core/html.js';
import { runSequentialPlayer } from '../../core/soloPlayer.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { clock } from '../../core/clock.js';
import { shuffle } from '../../core/azar.js';
import { scoreQuizSubmission } from '../quiz/scorer.js';
import * as Streaks from '../../core/streaks.js';
import { cabeceraHtml } from '../../core/playerHud.js';

// Campo de globos: cada opción es un globo de color (tokens --ww-shape-1..4 →
// los skins recolorean). El bamboleo va por CSS y se apaga bajo ww-lite.
// Offsets de altura por índice (pseudo-aleatorio ESTABLE, sin Math.random:
// mismo layout en cada repintado del mismo ítem).
/**
 * @typedef {import('../../kernel/contracts/activity.js').QaItem} QaItem
 */

/** @param {unknown[]} options @returns {string} */
export function balloonFieldHtml(options) {
  return `<div class="edu-sec edu-sec--tablero gl-field">
    ${options.map((o, i) => `
      <button type="button" class="gl-balloon gl-c${(i % 4) + 1}" data-value="${escapeHtml(o)}"
        style="--gl-lift:${(i * 37) % 24}cqh; --gl-sway:${(i % 3) - 1}">
        <span class="gl-text">${escapeHtml(o)}</span>
      </button>`).join('')}
  </div>`;
}

// Cablea el campo: un toque = una elección (idempotente). onPick(value, btn).
/**
 * @typedef {Object} BalloonHandlers
 * @property {(value: string|undefined, btn: HTMLButtonElement) => void} [onPick]
 */

/**
 * @param {Element} root
 * @param {BalloonHandlers} [handlers]
 * @returns {void}
 */
export function wireBalloonField(root, { onPick } = {}) {
  let picked = false;
  root.querySelector('.gl-field')?.addEventListener('click', (e) => {
    // `target` es FRONTERA (el DOM): se estrecha por forma, no con `instanceof`.
    const t = /** @type {{closest?: (sel: string) => Element|null}|null} */ (e.target);
    const btn = /** @type {HTMLButtonElement|null} */ (typeof t?.closest === 'function' ? t.closest('.gl-balloon') : null);
    if (!btn || picked || btn.disabled) return;
    picked = true;
    onPick?.(btn.dataset.value, btn);
  });
}

/**
 * @param {string|Element} rootSel
 * @param {import('../../kernel/contracts/activity.js').Activity} activity
 * @param {import('../../kernel/contracts/template.js').PlayerOpts} [opts]
 * @returns {Promise<void>}
 */
export async function renderGlobosPlayer(rootSel, activity, opts = {}) {
  /** @type {import('../../core/soloPlayer.js').SequentialCallbacks<QaItem>} */
  const callbacks = {
    onFinish() { Streaks.reset('solo', activity.id); },
    renderItem({ rootSel, item, idx, total, timerSecs, submit, alAgotarse }) {
      const options = (item.options || []).slice();
      if (activity.rules?.shuffleOptions) shuffle(options);
      const streak = Streaks.get('solo', activity.id);
      mount(rootSel, html`
        <div class="ww-player gl-play">
          ${cabeceraHtml({
            pagina: `${idx + 1} / ${total}`,
            racha: streak >= 2 ? String(streak) : undefined,   // el 🔥 lo pone el chip (core/playerHud.js)
          })}
          <div class="edu-sec edu-sec--enunciado ww-prow">
            <h3 class="ww-q gl-q">${escapeHtml(item.question || '')}</h3>
          </div>
          ${item.image ? `<div class="ww-q-media gl-media"><img src="${escapeHtml(item.image)}" alt=""></div>` : ''}
          ${balloonFieldHtml(options)}
        </div>
      `);

      // `rootSel` puede llegar como selector o como elemento (lo declara el
      // shell): antes solo se atendía la forma de cadena.
      const root = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
      if (!root) return;
      const t0 = clock.now();

      /** @returns {HTMLButtonElement[]} */
      const globos = () => [...root.querySelectorAll('.gl-balloon')].map(b => /** @type {HTMLButtonElement} */ (b));

      // Revela el globo correcto (verde) tras un fallo o timeout.
      const revealCorrect = () => {
        if (item.answer == null) return;
        const good = (Array.isArray(item.answer) ? item.answer : [item.answer]).map(String);
        globos().forEach(b => {
          if (b.dataset.value !== undefined && good.includes(b.dataset.value)) b.classList.add('gl-good');
        });
      };
      const disableAll = () => globos().forEach(b => { b.disabled = true; });

      // El reloj lo monta y lo pinta el SHELL (core/reloj.js): aquí, solo el
      // qué-pasa-al-acabarse.
      alAgotarse(() => {
        disableAll(); revealCorrect();
        Streaks.bump('solo', activity.id, false);
        emitGame(GameEvents.ANSWER_WRONG, { idx });
        submit({ itemId: item.id, value: null, correct: false, points: 0, msTaken: timerSecs * 1000 });
      });

      wireBalloonField(root, { onPick: (value, btn) => {
        const ms = clock.now() - t0;
        const r = scoreQuizSubmission({ value, item, msTaken: ms, activity });
        disableAll();
        btn.classList.add('gl-pop', r.correct ? 'gl-pop-ok' : 'gl-pop-bad');
        if (!r.correct) revealCorrect();
        const newStreak = Streaks.bump('solo', activity.id, r.correct === true);
        if (r.correct === true) {
          emitGame(GameEvents.ANSWER_CORRECT, { idx, points: r.points, streak: newStreak });
          if (newStreak >= 2) emitGame(GameEvents.STREAK, { count: newStreak });
        } else if (r.correct === false) {
          emitGame(GameEvents.ANSWER_WRONG, { idx });
        }
        submit({ itemId: item.id, value, correct: r.correct, points: r.points, msTaken: ms });
      } });
    },
  };
  runSequentialPlayer(rootSel, activity, opts, callbacks);
}
