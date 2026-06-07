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
import { createSession, FORMATS, sessionItems } from '../kernel/session/engine.js';
import { GameEvents, emitGame } from '../core/gameEvents.js';
import { applyMarks } from '../core/textMarks.js';
import { podiumHtml } from '../core/podium.js';

const TEAM_COLORS = ['danger', 'primary', 'success', 'warning'];

export function renderTeamsView(rootSel, id) {
  const a = get(id);
  if (!a) {
    mount(rootSel, html`<div class="alert alert-warning m-3">Actividad no encontrada. <a href="#/home">Volver</a></div>`);
    return;
  }
  const total = sessionItems(a).length;
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
      const item = sessionItems(a)[idx];
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

    // Question body. In AUTO mode the template paints the interactive round
    // itself (renderRound) while answering; in JUDGE mode — and on reveal — we
    // render a generic prompt plus the answer (model-aware).
    function roundBody(item, payload, phase) {
      if (phase === 'ended') return podium();

      // AUTO + answering → the template owns the round DOM (filled after mount).
      if (scoring === 'auto' && phase === 'question' && payload && typeof T.renderRound === 'function') {
        return `<div id="teams-round"></div>`;
      }

      const prompt = payload?.question || promptOf(item);
      let media = '';
      if (payload?.image || item?.image) media = `<div class="text-center mb-2"><img src="${escapeHtml(payload?.image || item.image)}" style="max-height:150px" class="img-fluid"></div>`;

      // On reveal, surface the right answer so the class sees it; in judge mode
      // offer it as a discreet teacher-only hint beforehand.
      const ans = answerOf(item);
      let reveal = '';
      if (phase === 'reveal' && ans) {
        reveal = `<div class="teams-answer"><i class="bi bi-check-circle-fill text-success"></i>
          Respuesta: <b>${escapeHtml(ans)}</b></div>`;
      } else if (scoring === 'judge' && ans) {
        reveal = `<details class="teams-hint"><summary>Ver respuesta (docente)</summary>
          <b>${escapeHtml(ans)}</b></details>`;
      }

      return `<div class="teams-q">${escapeHtml(prompt)}</div>${media}${reveal}`;
    }

    // Prompt/answer adapt to the content model so judge mode works everywhere:
    // quiz→question/answer, tildes/comas→passage text / corrected text,
    // match/memory→left / right, ruleta→the entry string.
    function promptOf(item) {
      if (item == null) return '';
      if (typeof item === 'string') return item;
      return item.question || item.text || item.prompt || item.left || '';
    }
    function answerOf(item) {
      if (item == null || typeof item === 'string') return '';
      if (Array.isArray(item.marks)) return applyMarks(item.text || '', item.marks); // textCorrection
      if (item.answer != null) return Array.isArray(item.answer) ? item.answer.join(' / ') : String(item.answer);
      if (item.right != null) return String(item.right); // pairs
      return '';
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
      const ranked = lb.map(t => ({ name: t.name, score: t.score }));
      // Same bar podium as En vivo / VS (tied teams → equal height). Teams
      // beyond the top 3 are listed compactly below.
      return `
        <div class="teams-podium text-center">
          <h2 class="mb-3"><i class="bi bi-trophy-fill text-warning"></i> ${tie ? '¡Empate!' : `🏆 ¡${escapeHtml(top.name)} gana!`}</h2>
          ${podiumHtml(ranked)}
          ${lb.length > 3 ? `<div class="teams-ranking mt-3">${lb.slice(3).map(t => `<div class="d-flex justify-content-between teams-rank-row"><span>${t.rank}. ${escapeHtml(t.name)}</span><b>${t.score}</b></div>`).join('')}</div>` : ''}
        </div>`;
    }

    function wire(item, payload, phase) {
      // Auto mode: the template renders the round; on submit we store the active
      // team's answer (scored later at reveal) and enable the Revelar button.
      const roundEl = $('#teams-round');
      if (roundEl && scoring === 'auto' && phase === 'question' && payload) {
        T.renderRound(roundEl, payload, { onSubmit: (value) => {
          selected = value;
          session.submit(session.activeTeam().id, session.currentItem, value);
          const rev = $('#teams-reveal');
          if (rev) rev.disabled = false;
        } });
      }

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
