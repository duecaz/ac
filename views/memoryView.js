// MEMORY (Equipos) view — the classic flip-two-cards game for the shared screen,
// by turns. A match scores and keeps the turn; a miss passes it to the next
// team. All rules live in kernel/session/memory.js (pure); this view paints the
// board, scoreboard and turn, and times the "cover" after a miss.
//
// EMBEDDING: mountMemory(host, activity, ctx, opts) renders setup + game INTO
// `host` (the activity stage). renderMemoryView(rootSel, id) is the thin wrapper
// for the standalone deep-link route (#/memory/:id). Both share the same code.
import { html, escapeHtml, mount, $, $$ } from '../core/html.js';
import { on } from '../core/events.js';
import { get } from '../core/storage.js';
import { createMemoryGame } from '../kernel/session/memory.js';
import { GameEvents, emitGame } from '../core/gameEvents.js';
import { renderModeSetup } from './modeSetup.js';

const TEAM_COLORS = ['danger', 'primary', 'success', 'warning'];
const COVER_MS = 1100;

// Standalone route wrapper (#/memory/:id).
export function renderMemoryView(rootSel, id) {
  const host = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
  const a = get(id);
  if (!a) {
    mount(host, html`<div class="alert alert-warning m-3">Actividad no encontrada. <a href="#/home">Volver</a></div>`);
    return;
  }
  mountMemory(host, a, null, { backHref: `#/play/${a.id}` });
}

// Embedded entry point. `host` is a DOM element. Returns { dispose }.
export function mountMemory(host, a, ctx, opts = {}) {
  const backHref = opts.backHref;
  const pairs = (a.content?.pairs || []).filter(p => p?.left && p?.right);
  if (pairs.length < 2) {
    mount(host, html`<div class="alert alert-info m-3">La memoria necesita al menos 2 pares. <a href="#/edit/${a.id}">Editar</a></div>`);
    return { dispose() {} };
  }

  let teamCount = a.presentation?.teamsCount || 2; // default from editor "Modos" tab
  renderSetup();

  function renderSetup() {
    const body = `
      <div class="my-3">
        <label class="form-label small text-muted d-block">¿Cuántos equipos?</label>
        <div class="btn-group" id="mem-count">
          ${[2, 3, 4].map(n => `<button class="btn btn-outline-primary ${n === 2 ? 'active' : ''}" data-n="${n}">${n}</button>`).join('')}
        </div>
      </div>
      <div id="mem-names" class="row justify-content-center g-2 my-3" style="max-width:560px;margin:auto"></div>`;

    renderModeSetup(host, {
      icon: 'bi-grid-3x3-gap-fill', color: 'primary', title: 'Memoria por equipos',
      subtitle: `${a.title} · ${pairs.length} pares`,
      body, backHref,
      note: 'Acierto: sumas y sigues. Fallo: pasa el turno.',
      onMount: () => {
        renderNames();
        on(host, 'click', '#mem-count button', (_, b) => {
          teamCount = Number(b.dataset.n);
          $('#mem-count').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
          renderNames();
        });
      },
      onStart: () => {
        const names = $$('#mem-names input').map((el, i) => (el.value || '').trim() || `Equipo ${i + 1}`);
        startGame(names);
      }
    });
  }

  function renderNames() {
    const box = $('#mem-names');
    if (!box) return;
    box.innerHTML = Array.from({ length: teamCount }, (_, i) => `
      <div class="col-6 col-md-3">
        <input class="form-control text-center border-${TEAM_COLORS[i]}" value="Equipo ${i + 1}" maxlength="14">
      </div>`).join('');
  }

  function startGame(names) {
    const game = createMemoryGame(a, { teams: names });
    let busy = false; // true while two cards are up after a miss (input locked)

    paint();

    function paint() {
      const teams = game.state.teams;
      const active = game.activeTeam();
      const ended = game.status === 'ended';
      mount(host, html`
        <div class="teams-arena">
          <div class="teams-scoreboard">
            ${teams.map(t => `
              <div class="teams-chip text-bg-${colorOf(t)} ${active && t.id === active.id && !ended ? 'is-turn' : ''}">
                <span class="teams-chip-name">${escapeHtml(t.name)}</span>
                <span class="teams-chip-score">${t.score}</span>
              </div>`).join('')}
          </div>
          <div class="teams-stage">
            ${ended ? '' : `<div class="teams-turn"><span class="badge text-bg-${colorOf(active)} fs-6">
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

    function cardHtml(c) {
      const face = c.matched || c.flipped;
      const cls = c.matched ? 'is-matched' : c.flipped ? 'is-flipped' : '';
      return `<button class="mem-card ${cls}" data-id="${c.id}" ${c.matched || c.flipped || busy ? 'disabled' : ''}>
        <span class="mem-face">${face ? escapeHtml(c.text) : '<i class="bi bi-question-lg"></i>'}</span>
      </button>`;
    }

    function podium() {
      const lb = game.leaderboard();
      const top = lb[0];
      const tie = lb.length > 1 && lb[1].score === top.score;
      return `
        <div class="teams-podium text-center">
          <i class="bi bi-trophy-fill display-1 text-warning"></i>
          <h2 class="mt-2">${tie ? '¡Empate!' : `🏆 ¡${escapeHtml(top.name)} gana!`}</h2>
          <div class="teams-ranking">
            ${lb.map(t => `<div class="d-flex justify-content-between teams-rank-row"><span>${t.rank}. ${escapeHtml(t.name)}</span><b>${t.score}</b></div>`).join('')}
          </div>
          ${backHref ? `<a href="${backHref}" class="btn btn-outline-secondary mt-3">Salir</a>` : ''}
          <button class="btn btn-primary mt-3 ms-2" id="mem-again"><i class="bi bi-arrow-repeat"></i> Otra vez</button>
        </div>`;
    }

    function wire() {
      on(host, 'click', '.mem-card', (_, btn) => {
        if (busy || btn.disabled) return;
        const r = game.flip(btn.dataset.id);
        if (!r.ok) return;
        if (r.matched) emitGame(GameEvents.ANSWER_CORRECT, {});
        if (r.pair && !r.matched) {
          // Miss: show both briefly, then cover and pass the turn.
          emitGame(GameEvents.ANSWER_WRONG, {});
          busy = true;
          paint(); // reflect the 2nd card face-up (all disabled)
          setTimeout(() => { game.cover(); busy = false; paint(); }, COVER_MS);
          return;
        }
        if (r.ended) emitGame(GameEvents.PODIUM, { top: game.leaderboard().slice(0, 1).map(t => ({ name: t.name, score: t.score })) });
        paint();
      });
      on(host, 'click', '#mem-again', () => renderSetup());
    }

    function colorOf(team) {
      const i = game.state.teams.findIndex(t => t.id === team.id);
      return TEAM_COLORS[i % TEAM_COLORS.length];
    }
  }

  return { dispose() {} };
}
