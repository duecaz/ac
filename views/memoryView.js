// MEMORY (Equipos) view — the classic flip-two-cards game for the shared screen,
// by turns. A match scores and keeps the turn; a miss passes it to the next
// team. All rules live in kernel/session/memory.js (pure); this view paints the
// board, scoreboard and turn, and times the "cover" after a miss.
//
// EMBEDDING: mountMemory(host, activity, ctx, opts) renders setup + game INTO
// `host` (the activity stage). (Wrapper de ruta suelta eliminado: sin callers.)
import { html, escapeHtml, mount, raizDe } from '../core/html.js';
import { on } from '../core/events.js';
import { createMemoryGame } from '../kernel/session/memory.js';
import { GameEvents, emitGame } from '../core/gameEvents.js';
import { renderAntesala } from './antesala.js';
import { teamColor, teamsScoreboardHtml, teamsSetupBody, wireTeamsSetup, readTeamNames, teamsPodiumHtml } from '../core/teams.js';
import { COVER_MS } from '../core/timings.js';


/** @typedef {import('../kernel/contracts/activity.js').Activity} Activity */
/** @typedef {import('../kernel/contracts/activity.js').PairsContent} PairsContent */
/** @typedef {import('../kernel/contracts/activity.js').Pair} Pair */
/** @typedef {import('../kernel/session/memory.js').MemoryCard} MemoryCard */
/** @typedef {import('../core/teams.js').Equipo} Equipo */

// Standalone route wrapper (#/memory/:id).
// Embedded entry point. `host` is the stage: el elemento o su SELECTOR (así lo
// declara core/modes.js y así lo pasa views/playerView.js, con
// '#ww-player-widget'). Returns { dispose }.
/**
 * @param {string|Element} host
 * @param {Activity} a
 * @param {ReturnType<import('../core/lifecycle.js').acquire>} [ctx]
 * @param {{backHref?: string}} [opts]
 * @returns {{dispose: () => void}}
 */
export function mountMemory(host, a, ctx, opts = {}) {
  const backHref = opts.backHref;
  // EL ESCENARIO, RESUELTO. `host` llega como SELECTOR desde playerView
  // ('#ww-player-widget'), y un string no tiene `isConnected`: el guard de vida
  // del destape leía `undefined` y SIEMPRE salía antes de destapar, así que tras
  // un fallo las dos cartas se quedaban boca arriba y el tablero bloqueado
  // (`busy` nunca volvía a false). Se pregunta al elemento, no al parámetro.
  const vivo = () => raizDe(host);
  // El contenido es una UNIÓN (§24): solo el modelo `pairs` trae pares, así que
  // se pregunta por la FORMA antes de leerlos.
  const c = a.content;
  const crudos = /** @type {Pair[]} */ (
    c && typeof c === 'object' && 'pairs' in c && Array.isArray(c.pairs) ? c.pairs : []);
  const pairs = crudos.filter(p => p?.left && p?.right);
  if (pairs.length < 2) {
    mount(host, html`<div class="alert alert-info m-3">La memoria necesita al menos 2 pares. <a href="#/edit/${a.id}">Editar</a></div>`);
    return { dispose() {} };
  }

  let teamCount = a.presentation?.teamsCount || 2; // default from editor "Modos" tab
  renderSetup();

  function renderSetup() {
    // La antesala de Equipos es UNA (core/teams.js): la botonera y los nombres
    // estaban copiados aquí, y la copia marcaba siempre el «2» como activo
    // aunque se hubiera elegido 3 o 4.
    const body = teamsSetupBody({ count: teamCount, color: 'primary' });

    renderAntesala(host, {
      activity: a,
      icon: 'bi-grid-3x3-gap-fill', color: 'primary', title: 'Memoria por equipos',
      subtitle: `${a.title} · ${pairs.length} pares`,
      bodyHtml: body, backHref,
      note: 'Acierto: sumas y sigues. Fallo: pasa el turno.',
      onMount: () => {
        wireTeamsSetup(host, teamCount, (n) => { teamCount = n; });
      },
      onStart: () => startGame(readTeamNames()),
    });
  }

  /** @param {string[]} names */
  function startGame(names) {
    const game = createMemoryGame(
      /** @type {import('../kernel/contracts/activity.js').Activity<PairsContent>} */ (a),
      { teams: names });
    let busy = false; // true while two cards are up after a miss (input locked)

    paint();

    function paint() {
      const teams = game.state.teams;
      const active = game.activeTeam();
      const ended = game.status === 'ended';
      mount(host, html`
        <div class="teams-arena">
          ${teamsScoreboardHtml(teams, active?.id ?? null, ended)}
          <div class="teams-stage">
            ${ended || !active ? '' : `<div class="teams-turn"><span class="badge text-bg-${colorOf(active)} fs-6">
              <i class="bi bi-arrow-right-circle"></i> Turno: ${escapeHtml(active.name)}</span></div>`}
            ${ended ? podium() : `<div class="mem-grid" style="${gridStyle()}">${game.state.cards.map(cardHtml).join('')}</div>`}
          </div>
        </div>`);
      wire();
    }

    function gridStyle() {
      const cols = Math.min(game.state.cards.length, Math.ceil(Math.sqrt(game.state.cards.length * 1.6)));
      return `grid-template-columns: repeat(${cols}, 1fr);`;
    }

    /** @param {MemoryCard} c */
    function cardHtml(c) {
      const face = c.matched || c.flipped;
      const cls = c.matched ? 'is-matched' : c.flipped ? 'is-flipped' : '';
      return `<button class="mem-card ${cls}" data-id="${c.id}" ${c.matched || c.flipped || busy ? 'disabled' : ''}>
        <span class="mem-face">${face ? escapeHtml(c.text) : '<i class="bi bi-question-lg"></i>'}</span>
      </button>`;
    }

    function podium() {
      // Cierre COMPARTIDO del modo (core/teams.js): mismo podio y mismos botones
      // que Equipos por turnos.
      const ranked = game.leaderboard().map(t => ({ name: t.name, score: t.score }));
      return teamsPodiumHtml({ ranked, backHref, color: 'primary' });
    }

    function wire() {
      on(host, 'click', '.mem-card', (_, el) => {
        const btn = /** @type {HTMLButtonElement} */ (el);
        if (busy || btn.disabled) return;
        const r = game.flip(btn.dataset.id || '');
        if (!r.ok) return;
        if (r.matched) emitGame(GameEvents.ANSWER_CORRECT, {});
        if (r.pair && !r.matched) {
          // Miss: show both briefly, then cover and pass the turn.
          emitGame(GameEvents.ANSWER_WRONG, {});
          busy = true;
          paint(); // reflect the 2nd card face-up (all disabled)
          // Guard de vida: si la ruta cambió durante la pausa, no repintar
          // sobre la vista siguiente (ley de vista §23).
          setTimeout(() => { if (!vivo()?.isConnected) return; game.cover(); busy = false; paint(); }, COVER_MS);
          return;
        }
        if (r.ended) emitGame(GameEvents.PODIUM, { top: game.leaderboard().slice(0, 1).map(t => ({ name: t.name, score: t.score })) });
        paint();
      });
      on(host, 'click', '#teams-again', () => renderSetup());
    }

    /** @param {Equipo} team */
    function colorOf(team) {
      return teamColor(team.id, game.state.teams);
    }
  }

  return { dispose() {} };
}
