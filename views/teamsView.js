// TEAMS view — shared-screen, no-device classroom play (Baamboozle/Factile
// style). Teams take TURNS on one question flow; the turn rotates each time the
// teacher advances. Two scoring modes, both driven by the session engine
// (format 'teams'):
//   • auto  — the active team taps an option and the machine scores it (Quiz).
//   • judge — the TEACHER marks ✓/✗ on whatever the team answered out loud, so
//             ANY content plays in teams even without a machine scorer.
//
// All flow/scoring lives in kernel/session/engine.js; this view paints the
// board, the scoreboard and the host controls.
import { html, escapeHtml, mount, $, $$ } from '../core/html.js';
import { on } from '../core/events.js';
import { get } from '../core/storage.js';
import { getTemplate } from '../core/registry.js';
import { createSession, FORMATS } from '../kernel/session/engine.js';
import { GameEvents, emitGame } from '../core/gameEvents.js';

const SHAPE_ICONS = ['bi-triangle-fill', 'bi-diamond-fill', 'bi-circle-fill', 'bi-square-fill'];
const TEAM_COLORS = ['danger', 'primary', 'success', 'warning'];

export function renderTeamsView(rootSel, id) {
  const a = get(id);
  if (!a) {
    mount(rootSel, html`<div class="alert alert-warning m-3">Actividad no encontrada. <a href="#/home">Volver</a></div>`);
    return;
  }
  const total = a.content?.items?.length || 0;
  if (!total) {
    mount(rootSel, html`<div class="alert alert-info m-3">Esta actividad no tiene preguntas. <a href="#/edit/${a.id}">Editar</a></div>`);
    return;
  }
  const T = getTemplate(a.template);
  const canAuto = typeof T?.scoreSubmission === 'function' && typeof T?.getRoundPayload === 'function';

  let teamCount = 2;
  renderSetup();

  function renderSetup() {
    mount(rootSel, html`
      <div class="teams-setup text-center py-5">
        <a href="#/play/${a.id}" class="btn btn-sm btn-link"><i class="bi bi-arrow-left"></i> Volver</a>
        <h3 class="mt-2 mb-1"><i class="bi bi-people-fill text-success"></i> Modo Equipos</h3>
        <p class="text-muted">${escapeHtml(a.title)} · ${total} preguntas · por turnos</p>

        <div class="my-3">
          <label class="form-label small text-muted d-block">¿Cuántos equipos?</label>
          <div class="btn-group" role="group" id="teams-count">
            ${[2, 3, 4].map(n => `<button class="btn btn-outline-success ${n === 2 ? 'active' : ''}" data-n="${n}">${n}</button>`).join('')}
          </div>
        </div>

        <div id="teams-names" class="row justify-content-center g-2 my-3" style="max-width:560px;margin:auto"></div>

        <div class="my-3">
          <label class="form-label small text-muted d-block">Puntuación</label>
          <div class="btn-group" role="group" id="teams-scoring">
            <button class="btn btn-outline-secondary ${canAuto ? 'active' : 'd-none'}" data-mode="auto" ${canAuto ? '' : 'disabled'}>
              <i class="bi bi-cpu"></i> Automática
            </button>
            <button class="btn btn-outline-secondary ${canAuto ? '' : 'active'}" data-mode="judge">
              <i class="bi bi-person-check"></i> Juez docente
            </button>
          </div>
          <div class="form-text">${canAuto
            ? 'Automática: el equipo toca la opción. Juez: tú marcas ✓/✗.'
            : 'Esta plantilla no se autocorrige: el docente marca ✓/✗.'}</div>
        </div>

        <button id="teams-start" class="btn btn-success btn-lg px-5"><i class="bi bi-play-fill"></i> ¡Empezar!</button>
      </div>`);

    renderNameInputs();
    on(rootSel, 'click', '#teams-count button', (_, b) => {
      teamCount = Number(b.dataset.n);
      $('#teams-count').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      renderNameInputs();
    });
    on(rootSel, 'click', '#teams-scoring button', (_, b) => {
      if (b.disabled) return;
      $('#teams-scoring').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    });
    on(rootSel, 'click', '#teams-start', () => {
      const names = $$('#teams-names input').map((el, i) => (el.value || '').trim() || `Equipo ${i + 1}`);
      const scoring = $('#teams-scoring .active')?.dataset.mode || (canAuto ? 'auto' : 'judge');
      startGame(names, scoring);
    });
  }

  function renderNameInputs() {
    const box = $('#teams-names');
    if (!box) return;
    box.innerHTML = Array.from({ length: teamCount }, (_, i) => `
      <div class="col-6 col-md-3">
        <input class="form-control text-center border-${TEAM_COLORS[i]}" value="Equipo ${i + 1}" maxlength="14">
      </div>`).join('');
  }

  function startGame(names, scoring) {
    const session = createSession(a, { format: FORMATS.TEAMS, teams: names, scoring });
    session.dispatch('start');
    let selected = null; // auto-mode: the active team's tapped value (pre-reveal)

    paint();

    function paint() {
      const phase = session.phase;
      const teams = session.state.teams;
      const active = session.activeTeam();
      const idx = session.currentItem;
      const item = a.content.items[idx];
      const payload = session.roundPayload();

      mount(rootSel, html`
        <div class="teams-arena">
          ${scoreboard(teams, active, phase)}
          <div class="teams-stage">
            <div class="teams-turn">
              <span class="badge text-bg-${colorOf(active)} fs-6">
                <i class="bi bi-arrow-right-circle"></i> Turno: ${escapeHtml(active.name)}
              </span>
              <span class="text-muted ms-2">Pregunta ${idx + 1} / ${total}</span>
            </div>
            <div class="teams-card" id="teams-card">
              ${roundBody(item, payload, phase)}
            </div>
            <div class="teams-controls" id="teams-controls">
              ${controls(phase)}
            </div>
          </div>
        </div>`);

      wire(item, payload, phase);
    }

    function scoreboard(teams, active, phase) {
      return `
        <div class="teams-scoreboard">
          ${teams.map(t => `
            <div class="teams-chip text-bg-${colorOf(t)} ${t.id === active.id && phase !== 'ended' ? 'is-turn' : ''}">
              <span class="teams-chip-name">${escapeHtml(t.name)}</span>
              <span class="teams-chip-score">${t.score}</span>
            </div>`).join('')}
        </div>`;
    }

    // Question body. Auto-capable templates show tappable options; otherwise we
    // render a generic prompt for the teacher-judge flow.
    function roundBody(item, payload, phase) {
      if (phase === 'ended') return podium();
      const prompt = payload?.question || item?.question || item?.text || item?.prompt || '';
      let media = '';
      if (payload?.image || item?.image) media = `<div class="text-center mb-2"><img src="${escapeHtml(payload?.image || item.image)}" style="max-height:150px" class="img-fluid"></div>`;

      let opts = '';
      if (scoring === 'auto' && payload?.options) {
        opts = `<div class="ww-kahoot-grid teams-opts">
          ${payload.options.map((o, i) => `
            <button class="btn vs-opt teams-opt" data-value="${escapeHtml(o)}">
              <i class="bi ${SHAPE_ICONS[i % 4]} me-2"></i>${escapeHtml(o)}
            </button>`).join('')}
        </div>`;
      }

      // On reveal, surface the right answer so the class sees it.
      let reveal = '';
      if (phase === 'reveal' && item?.answer != null) {
        reveal = `<div class="teams-answer"><i class="bi bi-check-circle-fill text-success"></i>
          Respuesta: <b>${escapeHtml(Array.isArray(item.answer) ? item.answer.join(' / ') : item.answer)}</b></div>`;
      } else if (scoring === 'judge' && item?.answer != null) {
        // Judge mode: a discreet, teacher-only hint to rule with.
        reveal = `<details class="teams-hint"><summary>Ver respuesta (docente)</summary>
          <b>${escapeHtml(Array.isArray(item.answer) ? item.answer.join(' / ') : item.answer)}</b></details>`;
      }

      return `<div class="teams-q">${escapeHtml(prompt)}</div>${media}${opts}${reveal}`;
    }

    function controls(phase) {
      const last = session.currentItem >= total - 1;
      if (phase === 'question') {
        if (scoring === 'judge') {
          return `
            <button class="btn btn-success btn-lg teams-judge" data-correct="1"><i class="bi bi-check-lg"></i> Correcto</button>
            <button class="btn btn-danger btn-lg teams-judge" data-correct="0"><i class="bi bi-x-lg"></i> Incorrecto</button>`;
        }
        // auto: reveal enabled once the team has tapped an option
        return `<button class="btn btn-primary btn-lg" id="teams-reveal" ${selected ? '' : 'disabled'}>
          <i class="bi bi-eye"></i> Revelar</button>`;
      }
      if (phase === 'reveal') {
        return `<button class="btn btn-success btn-lg" id="teams-next">
          ${last ? '<i class="bi bi-flag-fill"></i> Ver resultado' : '<i class="bi bi-arrow-right"></i> Siguiente equipo'}</button>`;
      }
      return `<a href="#/play/${a.id}" class="btn btn-outline-secondary">Salir</a>
              <button class="btn btn-success" id="teams-restart"><i class="bi bi-arrow-repeat"></i> Otra vez</button>`;
    }

    function podium() {
      const lb = session.leaderboard();
      const top = lb[0];
      const tie = lb.length > 1 && lb[1].score === top.score;
      return `
        <div class="teams-podium text-center">
          <i class="bi bi-trophy-fill display-1 text-warning"></i>
          <h2 class="mt-2">${tie ? '¡Empate!' : `🏆 ¡${escapeHtml(top.name)} gana!`}</h2>
          <div class="teams-ranking">
            ${lb.map(t => `<div class="d-flex justify-content-between teams-rank-row">
              <span>${t.rank}. ${escapeHtml(t.name)}</span><b>${t.score}</b></div>`).join('')}
          </div>
        </div>`;
    }

    function wire(item, payload, phase) {
      // Auto mode: active team taps an option (stored, not scored until reveal).
      on(rootSel, 'click', '.teams-opt', (_, btn) => {
        if (btn.disabled) return;
        selected = btn.dataset.value;
        session.submit(session.activeTeam().id, session.currentItem, selected);
        $$('.teams-opt').forEach(b => b.classList.toggle('teams-picked', b === btn));
        const rev = $('#teams-reveal');
        if (rev) rev.disabled = false;
      });

      on(rootSel, 'click', '#teams-reveal', () => {
        session.dispatch('reveal'); // auto → settle scores
        const ans = session.state.answers[`${session.currentItem}:${session.activeTeam().id}`];
        emitGame(ans?.correct ? GameEvents.ANSWER_CORRECT : GameEvents.ANSWER_WRONG, {});
        selected = null;
        paint();
      });

      // Judge mode: teacher rules, then we flip to reveal.
      on(rootSel, 'click', '.teams-judge', (_, btn) => {
        const correct = btn.dataset.correct === '1';
        session.judge({ correct });
        session.dispatch('reveal'); // judge → just flips phase
        emitGame(correct ? GameEvents.ANSWER_CORRECT : GameEvents.ANSWER_WRONG, {});
        paint();
      });

      on(rootSel, 'click', '#teams-next', () => {
        const last = session.currentItem >= total - 1;
        session.dispatch(last ? 'end' : 'next'); // 'next' rotates the turn
        selected = null;
        if (last) emitGame(GameEvents.PODIUM, { top: session.leaderboard().slice(0, 1).map(t => ({ name: t.name, score: t.score })) });
        paint();
      });

      on(rootSel, 'click', '#teams-restart', () => renderSetup());
    }

    function colorOf(team) {
      const i = session.state.teams.findIndex(t => t.id === team.id);
      return TEAM_COLORS[i % TEAM_COLORS.length];
    }
  }
}
