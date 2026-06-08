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
import { podiumHtml } from '../core/podium.js';

const SHAPE_ICONS = ['bi-triangle-fill', 'bi-diamond-fill', 'bi-circle-fill', 'bi-square-fill'];
const FLASH_MS = 700;

// ── Tug-of-war scene (SVG) ───────────────────────────────────────────────
// Two pullers lean on a rope; the knot/flag slides toward whoever leads. The
// rope is a sagging Bézier redrawn each frame so the motion is smooth, and the
// scorer gives a visible yank (handled in CSS via .pull-left/.pull-right).
const TUG = { LHX: 260, LHY: 155, RHX: 740, RHY: 155, KY: 155, SAG: 24, CX: 500, MAXOFF: 155 };
let _knotX = TUG.CX, _knotRaf = 0;

// One puller, feet at local (0,0), reaching to a rope hand at (110,-95). The
// right puller reuses this mirrored via scale(-1,1), so the scene stays exactly
// symmetric and the lean keyframes work for both sides.
const FIGURE = `
  <ellipse class="tug-shadow" cx="-6" cy="3" rx="46" ry="8"/>
  <line class="tug-limb" x1="-8" y1="-64" x2="-46" y2="0"/>
  <line class="tug-limb" x1="-8" y1="-64" x2="20" y2="0"/>
  <line class="tug-torso" x1="-8" y1="-64" x2="-26" y2="-112"/>
  <line class="tug-limb" x1="-12" y1="-80" x2="110" y2="-95"/>
  <line class="tug-limb" x1="-26" y1="-112" x2="110" y2="-95"/>
  <circle class="tug-head" cx="-32" cy="-130" r="16"/>
  <circle class="tug-eye" cx="-39" cy="-132" r="2.6"/>
  <circle class="tug-hand" cx="110" cy="-95" r="9"/>`;

function tugRopeD(kx) {
  const { LHX, LHY, RHX, RHY, KY, SAG } = TUG;
  return `M${LHX},${LHY} Q${(LHX + kx) / 2},${KY + SAG} ${kx},${KY} Q${(kx + RHX) / 2},${KY + SAG} ${RHX},${RHY}`;
}

function tugScene() {
  return `
    <svg class="vs-tug-svg" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <line class="tug-ground" x1="40" y1="250" x2="960" y2="250"/>
      <g class="tug-zone">
        <rect class="tug-pit" x="466" y="243" width="68" height="13" rx="5"/>
        <line class="tug-centerline" x1="500" y1="118" x2="500" y2="246"/>
        <path class="tug-mark" d="M348,250 L348,224 L372,234 L348,244"/>
        <path class="tug-mark" d="M652,250 L652,224 L628,234 L652,244"/>
      </g>
      <g transform="translate(150,250)"><g class="tug-fig tug-fig-left">${FIGURE}</g></g>
      <g transform="translate(850,250) scale(-1,1)"><g class="tug-fig tug-fig-right">${FIGURE}</g></g>
      <g id="tug-dynamic">
        <path id="tug-rope" d="${tugRopeD(TUG.CX)}"/>
        <g id="tug-knot" transform="translate(${TUG.CX},${TUG.KY})">
          <line class="tug-pole" x1="0" y1="2" x2="0" y2="-46"/>
          <path class="tug-flag" d="M0,-46 L30,-39 L0,-31 Z"/>
          <circle class="tug-knotball" cx="0" cy="0" r="11"/>
        </g>
      </g>
      <g class="tug-dust tug-dust-left"><circle cx="120" cy="247" r="5"/><circle cx="138" cy="245" r="7"/><circle cx="104" cy="244" r="4"/></g>
      <g class="tug-dust tug-dust-right"><circle cx="880" cy="247" r="5"/><circle cx="862" cy="245" r="7"/><circle cx="896" cy="244" r="4"/></g>
    </svg>`;
}

function tugDraw(kx) {
  const rope = document.getElementById('tug-rope');
  const knot = document.getElementById('tug-knot');
  if (rope) rope.setAttribute('d', tugRopeD(kx));
  if (knot) knot.setAttribute('transform', `translate(${kx},${TUG.KY})`);
}

// Smoothly slide the knot to a target x, redrawing the sagging rope each frame.
function tugTweenTo(target) {
  cancelAnimationFrame(_knotRaf);
  const from = _knotX, t0 = performance.now(), dur = 600;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const step = now => {
    const k = Math.min(1, (now - t0) / dur);
    _knotX = from + (target - from) * ease(k);
    tugDraw(_knotX);
    if (k < 1) _knotRaf = requestAnimationFrame(step);
  };
  _knotRaf = requestAnimationFrame(step);
}

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
            <div class="vs-tug-scene" id="vs-tug-scene">${tugScene()}</div>
          </div>
          <div class="vs-panels">
            ${panelShell('left', st.left.name)}
            <div class="vs-divider"><span>VS</span></div>
            ${panelShell('right', st.right.name)}
          </div>
        </div>`);
      on(rootSel, 'click', '#vs-again', () => renderSetup());
      _knotX = TUG.CX; tugDraw(TUG.CX);
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
      // A correct answer yanks the rope: the scoring team gives a visible tug.
      if (r.correct) {
        const scene = document.getElementById('vs-tug-scene');
        if (scene) {
          scene.classList.remove('pull-left', 'pull-right');
          void scene.offsetWidth; // restart the animation
          scene.classList.add(side === 'left' ? 'pull-left' : 'pull-right');
        }
      }
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
      const scene = document.getElementById('vs-tug-scene');
      const label = document.getElementById('vs-tug-label');
      if (!label) return;
      const signed = st.left.score - st.right.score;          // + → left ahead
      const lead = signed / (st.left.score + st.right.score + 1);
      const off = Math.max(-TUG.MAXOFF, Math.min(TUG.MAXOFF, lead * 320));
      tugTweenTo(TUG.CX - off);                                // left ahead → knot pulled left
      if (scene) {
        scene.classList.toggle('lead-left', signed > 0);
        scene.classList.toggle('lead-right', signed < 0);
      }
      label.textContent = signed === 0 ? '¡Empate!'
        : `${(signed > 0 ? st.left.name : st.right.name)} va ganando (+${Math.abs(signed)})`;
    }

    function finish(st) {
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
