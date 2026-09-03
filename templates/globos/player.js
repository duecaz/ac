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
import { hudHtml, hudSet } from '../../core/playerHud.js';

// Campo de globos: cada opción es un globo de color (tokens --ww-shape-1..4 →
// los skins recolorean). El bamboleo va por CSS y se apaga bajo ww-lite.
// Offsets de altura por índice (pseudo-aleatorio ESTABLE, sin Math.random:
// mismo layout en cada repintado del mismo ítem).
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
export function wireBalloonField(root, { onPick } = {}) {
  let picked = false;
  root.querySelector('.gl-field')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.gl-balloon');
    if (!btn || picked || btn.disabled) return;
    picked = true;
    onPick?.(btn.dataset.value, btn);
  });
}

export async function renderGlobosPlayer(rootSel, activity, opts = {}) {
  runSequentialPlayer(rootSel, activity, opts, {
    onFinish() { Streaks.reset('solo', activity.id); },
    renderItem({ rootSel, item, idx, total, score, timerSecs, submit, alAgotarse }) {
      const options = (item.options || []).slice();
      if (activity.rules?.shuffleOptions) shuffle(options);
      const streak = Streaks.get('solo', activity.id);
      mount(rootSel, html`
        <div class="ww-player gl-play">
          ${hudHtml({
            pagina: `${idx + 1} / ${total}`,
            racha: streak >= 2 ? String(streak) : null,   // el 🔥 lo pone el chip (core/playerHud.js)
          })}
          <div class="edu-sec edu-sec--enunciado ww-prow">
            <h3 class="ww-q gl-q">${escapeHtml(item.question || '')}</h3>
          </div>
          ${item.image ? `<div class="ww-q-media gl-media"><img src="${escapeHtml(item.image)}" alt=""></div>` : ''}
          ${balloonFieldHtml(options)}
        </div>
      `);

      const root = document.querySelector(rootSel);
      const t0 = clock.now();

      // Revela el globo correcto (verde) tras un fallo o timeout.
      const revealCorrect = () => {
        if (item.answer == null) return;
        const good = (Array.isArray(item.answer) ? item.answer : [item.answer]).map(String);
        root.querySelectorAll('.gl-balloon').forEach(b => {
          if (good.includes(b.dataset.value)) b.classList.add('gl-good');
        });
      };
      const disableAll = () => root.querySelectorAll('.gl-balloon').forEach(b => { b.disabled = true; });

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
  });
}
