// VS view — head-to-head duel on ONE shared touchscreen. Two activities run in
// PARALLEL: alumno 1 plays the left panel, alumno 2 the right, each racing
// through the SAME item sequence at their own pace. A central tug-of-war bar,
// fed by the session engine's standings(), shows who's winning in real time.
//
// The flow/scoring live entirely in kernel/session/engine.js (format 'vs'); this
// view only paints panels and reflects standings — no game logic here.
import { html, escapeHtml, mount, $ } from '../core/html.js';
import { on } from '../core/events.js';
import { get, save } from '../core/storage.js';
import { getTemplate } from '../core/registry.js';
import { createSession, isVsCompatible, FORMATS, sessionItems } from '../kernel/session/engine.js';
import { GameEvents, emitGame } from '../core/gameEvents.js';
import { podiumHtml } from '../core/podium.js';
import { getVsAnimation } from '../core/vsAnimations.js';
import { play as playSound } from '../core/sounds.js';
import { answerConfetti } from '../core/effects.js';

const SHAPE_ICONS = ['bi-triangle-fill', 'bi-diamond-fill', 'bi-circle-fill', 'bi-square-fill'];
const FLASH_MS = 700;

// Per-answer feedback in VS, configurable from the setup panel. Default: the
// quiet, focused combo the teacher asked for — colour flash + a short sound,
// and NO confetti popping on every question (that reads as noise on a duel).
const FX_DEFAULTS = { sound: true, confetti: false, flash: true };

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

  const fxCfg = () => ({ ...FX_DEFAULTS, ...(a.presentation?.vsFeedback || {}) });

  renderSetup();

  // Names + start. Defaults let the teacher launch in one tap.
  function renderSetup() {
    const fx = fxCfg();
    const sw = (key, label, hint) => `
      <label class="vs-fx-row" title="${escapeHtml(hint)}">
        <span class="form-check form-switch m-0">
          <input class="form-check-input vs-fx" type="checkbox" role="switch" data-fx="${key}" ${fx[key] ? 'checked' : ''}>
        </span>
        <span class="vs-fx-label">${label}<small class="d-block text-muted">${escapeHtml(hint)}</small></span>
      </label>`;
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

        <details class="vs-fx-panel mx-auto mt-3">
          <summary><i class="bi bi-sliders"></i> Sonido y efectos</summary>
          <div class="vs-fx-grid">
            ${sw('sound', 'Sonido', 'Un sonido corto al acertar o fallar.')}
            ${sw('flash', 'Destello de color', 'Fondo verde al acertar, rojo al fallar.')}
            ${sw('confetti', 'Confeti por pregunta', 'Lluvia de confeti en cada acierto (desactivado por defecto).')}
          </div>
        </details>
      </div>`);
    on(rootSel, 'click', '#vs-start', () => {
      const left = ($('#vs-name-left')?.value || '').trim() || 'Alumno 1';
      const right = ($('#vs-name-right')?.value || '').trim() || 'Alumno 2';
      startMatch(left, right);
    });
    // Feedback toggles persist per-activity (presentation.vsFeedback).
    on(rootSel, 'change', '.vs-fx', (_, el) => {
      if (!a.presentation) a.presentation = {};
      const cfg = { ...fxCfg(), [el.dataset.fx]: el.checked };
      a.presentation.vsFeedback = cfg;
      save(a);
    });
  }

  function startMatch(leftName, rightName) {
    const T = getTemplate(a.template);
    const session = createSession(a, { format: FORMATS.VS, left: leftName, right: rightName });
    session.start();
    const flashing = { left: false, right: false };
    const fx = fxCfg();
    // The central stage is a pluggable animation chosen by the teacher in
    // Presentación (default: the built-in SVG tug-of-war).
    const animDef = getVsAnimation(a.presentation?.vsAnimation || 'svg-tug');
    let anim = null;

    paintArena();
    renderSide('left'); renderSide('right'); updateCenter();

    // 4-column arena: alumno 1 | (animación, 2 cols) | alumno 2. Stacks to rows
    // in portrait/narrow via CSS. The animation owns the centre stage; the view
    // only feeds it the lead and yanks, and updates the textual label.
    function paintArena() {
      const st = session.standings();
      mount(rootSel, html`
        <div class="vs-arena">
          ${panelShell('left', st.left.name)}
          <div class="vs-stage" id="vs-stage">
            <div class="vs-tug-label" id="vs-tug-label">¡Empate!</div>
            <div class="vs-stage-canvas" id="vs-stage-canvas"></div>
          </div>
          ${panelShell('right', st.right.name)}
        </div>`);
      on(rootSel, 'click', '#vs-again', () => { if (anim) anim.destroy(); renderSetup(); });
      if (anim) anim.destroy();
      anim = animDef.create(document.getElementById('vs-stage-canvas'), { src: a.presentation?.vsAnimationSrc });
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
      // Per-answer feedback is driven locally (not via the global game-event
      // bus) so VS controls exactly what fires: colour flash, a short sound,
      // and the central animation's reaction — but no per-question confetti
      // unless the teacher turned it on. Each piece honours its own toggle.
      if (fx.flash && body) body.classList.add(r.correct ? 'vs-flash-ok' : 'vs-flash-no');
      if (fx.sound) playSound(r.correct ? 'correct' : 'wrong');
      updateCenter();
      // The chosen animation reacts to the scorer; its sound (above) is what
      // ties feedback to the animation rather than a detached jingle.
      if (r.correct && anim) anim.yank(side);
      if (r.correct && fx.confetti) answerConfetti();
      setTimeout(() => {
        flashing[side] = false;
        if (body) body.classList.remove('vs-flash-ok', 'vs-flash-no');
        renderSide(side);
        const st = session.standings();
        if (st.finished) finish(st);
      }, FLASH_MS);
    }

    // Feed the stage the normalized lead (−1..1, + = left) so it reacts to the
    // score, and update the textual "who's winning" label (view chrome).
    function updateCenter() {
      const st = session.standings();
      const label = document.getElementById('vs-tug-label');
      const signed = st.left.score - st.right.score;          // + → left ahead
      const lead = signed / (st.left.score + st.right.score + 1);
      if (anim) anim.setProgress(Math.max(-1, Math.min(1, lead * 2.1)));
      if (label) {
        label.textContent = signed === 0 ? '¡Empate!'
          : `${(signed > 0 ? st.left.name : st.right.name)} va ganando (+${Math.abs(signed)})`;
      }
    }

    function finish(st) {
      if (anim) { anim.destroy(); anim = null; }
      const tie = st.leader === 'tie';
      const winner = tie ? null : st[st.leader];
      // Same podium component as live mode; tied players get equal-height bars.
      const ranked = [st.left, st.right]
        .map(s => ({ name: s.name, score: s.score }))
        .sort((a, b) => b.score - a.score);
      const heading = tie
        ? `<i class="bi bi-emoji-neutral text-secondary"></i> ¡Empate a ${st.left.score}!`
        : `<i class="bi bi-trophy-fill text-warning"></i> 🏆 ¡${escapeHtml(winner.name)} gana!`;
      const body = `
        <div class="vs-result text-center py-4">
          <h2 class="mb-3">${heading}</h2>
          ${podiumHtml(ranked)}
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
