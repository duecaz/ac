// Word search player: solo + VS-round variant.
// EL TABLERO —rejilla, banco de palabras, arrastre, marcado y líneas— es UNO
// solo (./board.js): aquí queda lo que de verdad cambia entre el modo Individual
// (cabecera, puntos, reloj, fin de partida) y la ronda de VS/Equipos (color por
// lado, palabras ya encontradas, aviso al motor).
import { html, mount, raizDe, $ } from '../../core/html.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import * as Streaks from '../../core/streaks.js';
import { generateGrid, SIZE_MAP } from './generator.js';
import { scoreWordsearch } from './scorer.js';
import { basePoints } from '../../core/scoring/index.js';
import { cabeceraHtml, hudSet } from '../../core/playerHud.js';
import { wordsearchRules, wordsearchWords } from './template.js';
import { crearTableroSopa } from './board.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('./generator.js').WsPlaced} WsPlaced
 */

/** EL PAYLOAD de la ronda compartida, tal y como lo arma `getRoundPayload` de
 *  esta misma plantilla (§0: la ronda no adivina, lee su propia forma).
 * @typedef {Object} WsRoundPayload
 * @property {string[][]} grid
 * @property {number} cols
 * @property {WsPlaced[]} [placed]
 * @property {string[]} [found]
 * @property {string} [side]
 */

// ── Solo player ──────────────────────────────────────────────────────────────

/**
 * @param {string|Element} rootSel
 * @param {Activity} activity
 * @param {import('../../kernel/contracts/template.js').PlayerOpts} [opts]
 */
export async function renderWordsearchPlayer(rootSel, activity, opts = {}) {
  const rawWords = wordsearchWords(activity);

  if (!rawWords.length) {
    mount(rootSel, html`<div class="alert alert-warning m-3">No hay palabras configuradas.</div>`);
    return;
  }

  const rules    = wordsearchRules(activity);
  const scoring  = activity.scoring || {};
  const gridN    = SIZE_MAP[rules.gridSize ?? ''] || 15;

  const { grid, placed, cols } = generateGrid(rawWords, {
    rows: gridN, cols: gridN, dirs: rules.directions || 'medium',
  });

  const total = placed.length;
  const ctx = runFreeformPlayer(rootSel, activity, opts);
  let score = 0;
  /** @type {{encontradas: () => number, total: number}|null} */
  let tablero = null;

  function rootEl() { return raizDe(rootSel); }

  function finish() {
    const max = total * basePoints(null, scoring);   // misma convención que el scorer
    Streaks.reset('solo', activity.id);
    ctx.finish({
      lead: `Palabras: <b>${tablero?.encontradas() ?? 0}/${total}</b> · Puntos: <b>${score}</b>`,
      stats: ({ timeUsed }) => `Tiempo: ${timeUsed}s`,
      score, maxScore: max,
    });
  }

  mount(rootSel, html`<div class="ww-ws" data-ws="marco">${cabeceraHtml({ pagina: `0 / ${total}` })}</div>`);
  const marco = $('[data-ws="marco"]', rootEl());
  if (!marco) return;   // la ruta cambió mientras se montaba (§23)

  tablero = crearTableroSopa(marco, {
    grid, cols, placed, colorIdx: 0,   // Individual: un solo jugador (el duelo pinta por lado, abajo)
    alEncontrar: (p, { encontradas }) => {
      // Un solo scorer por plantilla (ley en CLAUDE.md): el player NO reimplementa
      // el conteo — mismo scoreWordsearch que VS/sesión.
      const pts = scoreWordsearch({ value: p.word, activity, mode: 'solo' }).points;
      score += pts;
      const streak = Streaks.bump('solo', activity.id, true);
      emitGame(GameEvents.ANSWER_CORRECT, { idx: encontradas - 1, points: pts, streak });
      if (streak >= 3) emitGame(GameEvents.STREAK, { count: streak });
      hudSet(rootEl(), 'pagina', `${encontradas} / ${total}`);
      if (encontradas >= total) finish();
    },
  });

  // El reloj lo monta y lo pinta el SHELL (core/reloj.js, uno para todas). Aquí
  // solo se dice qué pasa al acabarse: la sopa se termina.
  ctx.alAgotarse(() => finish());
}

// ── VS / Equipos round renderer ──────────────────────────────────────────────
// Mirrors the solo experience: the WHOLE board + ALL words are shown, the player
// drags freely to find ANY word (free-find), and each correct find fires
// onSubmit(word) — the engine advances one segment per find. Words already found
// (carried in payload.found across re-renders) are pre-marked with a permanent
// line so progress survives a re-render. Each VS side gets a DIFFERENT board
// (seeded by side in getRoundPayload) so opponents can't copy positions.
/**
 * @param {Element} root
 * @param {import('../../kernel/contracts/session.js').RoundPayload} payload
 * @param {import('../../kernel/contracts/template.js').RoundCallbacks} [cbs]
 */
export function renderWordsearchRound(root, payload, { onSubmit } = {}) {
  if (!payload) return;
  // El payload lo arma `getRoundPayload` de esta plantilla: se lee con SU forma.
  const { grid, cols, placed = [], found = [], side = 'left' } = /** @type {WsRoundPayload} */ (payload);
  if (!Array.isArray(grid)) return;

  root.innerHTML = `<div class="ww-ws ww-ws-round" data-ws="marco"></div>`;
  const marco = $('[data-ws="marco"]', root);
  if (!marco) return;

  crearTableroSopa(marco, {
    grid, cols, placed,
    colorIdx: side === 'right' ? 1 : 0,
    yaEncontradas: found,
    contador: true,
    alEncontrar: (p) => onSubmit?.(p.word),
  });
}
