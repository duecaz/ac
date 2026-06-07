// VS view — head-to-head duel on ONE shared touchscreen. Two activities run in
// PARALLEL: alumno 1 plays the left panel, alumno 2 the right, each racing
// through the SAME item sequence at their own pace. A central tug-of-war bar,
// fed by the session engine's standings(), shows who's winning in real time.
//
// The flow/scoring live entirely in kernel/session/engine.js (format 'vs'); this
// view only paints panels and reflects standings — no game logic here.
import { html, escapeHtml, mount, $ } from '../core/html.js';
import { on } from '../core/events.js';
import { get } from '../core/storage.js';
import { getTemplate } from '../core/registry.js';
import { createSession, isVsCompatible, FORMATS, sessionItems } from '../kernel/session/engine.js';
import { GameEvents, emitGame } from '../core/gameEvents.js';

const SHAPE_ICONS = ['bi-triangle-fill', 'bi-diamond-fill', 'bi-circle-fill', 'bi-square-fill'];
const FLASH_MS = 700;

export function renderVsView(rootSel, id) {
  const a = get(id);
  if (!a) {
    mount(rootSel, html`<div class="alert alert-warning m-3">Actividad no encontrada. <a href="#/home">Volver</a></div>`);
    return;
  }
  if (!isVsCompatible(a)) {
    mount(rootSel, html`
      <div class="alert alert-info m-3">
        <h5><i class="bi bi-people"></i> Modo VS no disponible para esta actividad</h5>
        <p class="mb-2">El duelo 1‑contra‑1 necesita una plantilla que se pueda puntuar
        automáticamente y <b>2 o más preguntas</b> para que sea una carrera justa.</p>
        <a href="#/play/${a.id}" class="btn btn-sm btn-outline-secondary">Volver a la actividad</a>
      </div>`);
    return;
  }

  renderSetup();

  // Names + start. Defaults let the teacher launch in one tap.
  function renderSetup() {
    mount(rootSel, html`
      <div class="vs-setup text-center py-5">
        <a href="#/play/${a.id}" class="btn btn-sm btn-link"><i class="bi bi-arrow-left"></i> Volver</a>
        <h3 class="mt-2 mb-1"><i class="bi bi-fire text-danger"></i> Duelo VS</h3>
        <p class="text-muted">${escapeHtml(a.title)} · ${sessionItems(a).length} preguntas</p>
        <div class="row justify-content-center g-3 my-3" style="max-width:520px;margin:auto">
          <div class="col-6">
            <label class="form-label small text-muted">Alumno 1 (izquierda)</label>
            <input id="vs-name-left" class="form-control text-center" value="Alumno 1" maxlength="16">
          </div>
          <div class="col-6">
            <label class="form-label small text-muted">Alumno 2 (derecha)</label>
            <input id="vs-name-right" class="form-control text-center" value="Alumno 2" maxlength="16">
          </div>
        </div>
        <button id="vs-start" class="btn btn-danger btn-lg px-5"><i class="bi bi-play-fill"></i> ¡Empezar!</button>
        <p class="text-muted small mt-3">Cada jugador responde en su lado. Gana quien sume más puntos.</p>
      </div>`);
    on(rootSel, 'click', '#vs-start', () => {
      const left = ($('#vs-name-left')?.value || '').trim() || 'Alumno 1';
      const right = ($('#vs-name-right')?.value || '').trim() || 'Alumno 2';
      startMatch(left, right);
    });
  }

  function startMatch(leftName, rightName) {
    const T = getTemplate(a.template);
    const session = createSession(a, { format: FORMATS.VS, left: leftName, right: rightName });
    session.start();
    const flashing = { left: false, right: false };

    paintArena();
    renderSide('left'); renderSide('right'); updateCenter();

    function paintArena() {
      const st = session.standings();
      mount(rootSel, html`
        <div class="vs-arena">
          <div class="vs-tug" id="vs-tug">
            <div class="vs-tug-label" id="vs-tug-label">¡Empate!</div>
            <div class="vs-tug-track"><div class="vs-tug-knob" id="vs-tug-knob"></div></div>
          </div>
          <div class="vs-panels">
            ${panelShell('left', st.left.name)}
            <div class="vs-divider"><span>VS</span></div>
            ${panelShell('right', st.right.name)}
          </div>
        </div>`);
      on(rootSel, 'click', '#vs-again', () => renderSetup());
    }

    function panelShell(side, name) {
      const color = side === 'left' ? 'primary' : 'danger';
      return `
        <div class="vs-panel vs-${side}" data-side="${side}">
          <div class="vs-head text-bg-${color}">
            <span class="vs-name">${escapeHtml(name)}</span>
            <span class="vs-score" id="vs-score-${side}">0</span>
          </div>
          <div class="vs-prog"><div class="vs-prog-bar" id="vs-prog-${side}"></div></div>
          <div class="vs-body" id="vs-body-${side}"></div>
        </div>`;
    }

    // Paint a side's current round, or its "finished" card when done.
    function renderSide(side) {
      const body = document.getElementById('vs-body-' + side);
      if (!body) return;
      const payload = session.roundPayloadFor(side);
      const st = session.standings()[side];
      const prog = document.getElementById('vs-prog-' + side);
      if (prog) prog.style.width = Math.round((st.cursor / session.totalItems) * 100) + '%';

      if (!payload) {
        body.innerHTML = `
          <div class="vs-done text-center">
            <i class="bi bi-check-circle-fill display-4 text-success"></i>
            <div class="h5 mt-2">¡Terminó!</div>
            <div class="text-muted">${st.correct} de ${session.totalItems} aciertos · ${st.score} pts</div>
          </div>`;
        return;
      }
      // The template owns the round's DOM (options, tap-vowels, …) and reports
      // the answer via onSubmit; the view only handles scoring + feedback.
      body.innerHTML = '';
      T.renderRound(body, payload, { onSubmit: (value) => onAnswer(side, value) });
    }

    function onAnswer(side, value) {
      if (flashing[side]) return;
      flashing[side] = true;
      const r = session.answer(side, value);
      const scoreEl = document.getElementById('vs-score-' + side);
      if (scoreEl) scoreEl.textContent = session.standings()[side].score;
      const body = document.getElementById('vs-body-' + side);
      if (body) body.classList.add(r.correct ? 'vs-flash-ok' : 'vs-flash-no');
      emitGame(r.correct ? GameEvents.ANSWER_CORRECT : GameEvents.ANSWER_WRONG, { idx: r.cursor - 1 });
      updateCenter();
      setTimeout(() => {
        flashing[side] = false;
        if (body) body.classList.remove('vs-flash-ok', 'vs-flash-no');
        renderSide(side);
        const st = session.standings();
        if (st.finished) finish(st);
      }, FLASH_MS);
    }

    // The central tug-of-war: knob slides toward whoever leads; the gap is
    // normalized so an early lead still visibly tugs the bar.
    function updateCenter() {
      const st = session.standings();
      const knob = document.getElementById('vs-tug-knob');
      const label = document.getElementById('vs-tug-label');
      if (!knob || !label) return;
      const signed = st.left.score - st.right.score;          // + → left ahead
      const lead = signed / (st.left.score + st.right.score + 1);
      const pct = 50 - Math.max(-42, Math.min(42, lead * 60)); // left ahead → knob moves left
      knob.style.left = pct + '%';
      knob.className = 'vs-tug-knob ' + (signed > 0 ? 'lead-left' : signed < 0 ? 'lead-right' : '');
      label.textContent = signed === 0 ? '¡Empate!'
        : `${(signed > 0 ? st.left.name : st.right.name)} va ganando (+${Math.abs(signed)})`;
    }

    function finish(st) {
      const winner = st.leader === 'tie' ? null : st[st.leader];
      const loser = st.leader === 'tie' ? null : st[st.leader === 'left' ? 'right' : 'left'];
      const body = `
        <div class="vs-result text-center py-4">
          ${winner
            ? `<i class="bi bi-trophy-fill display-1 text-warning"></i>
               <h2 class="mt-2">🏆 ¡${escapeHtml(winner.name)} gana!</h2>
               <p class="lead">${escapeHtml(winner.name)} ${winner.score} — ${loser.score} ${escapeHtml(loser.name)}</p>`
            : `<i class="bi bi-emoji-neutral display-1 text-secondary"></i>
               <h2 class="mt-2">¡Empate a ${st.left.score}!</h2>`}
          <button id="vs-again" class="btn btn-danger btn-lg mt-2"><i class="bi bi-arrow-repeat"></i> Otra vez</button>
          <a href="#/play/${a.id}" class="btn btn-outline-secondary btn-lg mt-2 ms-2">Salir</a>
        </div>`;
      mount(rootSel, html`<div class="vs-arena"><div class="vs-overlay">${body}</div></div>`);
      // Only celebrate a real winner. On a tie, no victory fanfare/confetti
      // (PODIUM triggers win.mp3 + confetti) — a draw isn't a win.
      if (winner) emitGame(GameEvents.PODIUM, { top: [{ name: winner.name, score: winner.score }] });
      on(rootSel, 'click', '#vs-again', () => renderSetup());
    }
  }
}
