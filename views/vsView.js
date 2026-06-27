// VS view — head-to-head duel on ONE shared touchscreen. Two activities run in
// PARALLEL: alumno 1 plays the left panel, alumno 2 the right, each racing
// through the SAME item sequence at their own pace. A central tug-of-war bar,
// fed by the session engine's standings(), shows who's winning in real time.
//
// The flow/scoring live entirely in kernel/session/engine.js (format 'vs'); this
// view only paints panels and reflects standings — no game logic here.
//
// EMBEDDING: mountVs(host, activity, ctx, opts) renders setup + duel INTO `host`
// (the activity stage) and returns { dispose } so the page can stop the central
// animation when switching modes. renderVsView(rootSel, id) is a thin wrapper
// kept for the standalone deep-link route (#/vs/:id), rendering full-page with a
// "Volver" link. Both share the SAME code below — embedded and standalone never
// diverge.
import { html, escapeHtml, mount, $ } from '../core/html.js';
import { on } from '../core/events.js';
import { get, save } from '../core/storage.js';
import { lsGet, lsSet } from '../core/ls.js';
import { getTemplate } from '../core/registry.js';
import { createSession, isVsCompatible, FORMATS, sessionItems } from '../kernel/session/engine.js';
import { GameEvents, emitGame } from '../core/gameEvents.js';
import { podiumHtml } from '../core/podium.js';
import { getVsAnimation } from '../core/vsAnimations.js';
import { play as playSound } from '../core/sounds.js';
import { answerConfetti } from '../core/effects.js';
import { renderModeSetup } from './modeSetup.js';
import { getSkin } from '../core/skins.js';

const FLASH_MS = 700;
const AVATAR_MAX_BYTES = 150 * 1024; // 150 KB hard limit

// Per-answer feedback in VS, configurable from the setup panel. Default: the
// quiet, focused combo the teacher asked for — colour flash + a short sound,
// and NO confetti popping on every question (that reads as noise on a duel).
const FX_DEFAULTS = { sound: true, confetti: false, flash: true };

// Avatar helpers — stored in localStorage keyed by activity id so they never
// bloat the activity JSON and survive across sessions on the same device.
function avatarKey(actId, side) { return `ww.vsavatar.${actId}.${side}`; }
function loadAvatar(actId, side) { return lsGet(avatarKey(actId, side), ''); }
function saveAvatar(actId, side, dataUrl) { lsSet(avatarKey(actId, side), dataUrl); }

function avatarPreviewHtml(dataUrl, side) {
  if (dataUrl) return `<img src="${escapeHtml(dataUrl)}" class="vs-av-thumb" alt="">`;
  return `<span class="vs-av-empty"><i class="bi bi-${side === 'left' ? 'person' : 'person'}-circle fs-1 text-muted"></i></span>`;
}

// Standalone route wrapper (#/vs/:id): resolve element + activity, then mount
// full-page with a back link to the activity page.
export function renderVsView(rootSel, id) {
  const host = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
  const a = get(id);
  if (!a) {
    mount(host, html`<div class="alert alert-warning m-3">Actividad no encontrada. <a href="#/home">Volver</a></div>`);
    return;
  }
  mountVs(host, a, null, { backHref: `#/play/${a.id}` });
}

// Embedded entry point. `host` is a DOM element. Returns { dispose }.
export function mountVs(host, a, ctx, opts = {}) {
  const backHref = opts.backHref;
  if (!isVsCompatible(a)) {
    mount(host, html`
      <div class="alert alert-info m-3">
        <h5><i class="bi bi-people"></i> Modo VS no disponible para esta actividad</h5>
        <p class="mb-2">El duelo 1‑contra‑1 necesita una plantilla que se pueda puntuar
        automáticamente y <b>2 o más preguntas</b> para que sea una carrera justa.</p>
        ${backHref ? `<a href="${backHref}" class="btn btn-sm btn-outline-secondary">Volver a la actividad</a>` : ''}
      </div>`);
    return { dispose() {} };
  }

  const fxCfg = () => ({ ...FX_DEFAULTS, ...(a.presentation?.vsFeedback || {}) });
  let currentAnim = null; // the running central animation (destroyed on dispose)

  // List-orchestrator mode: skip setup screen and jump straight to the match.
  if (opts.leftName && opts.rightName) {
    startMatch(opts.leftName, opts.rightName);
  } else {
    renderSetup();
  }

  // Names + start. Defaults let the teacher launch in one tap. The header,
  // subtitle and Start button come from the shared scaffold; this only supplies
  // the VS-specific options (names + feedback toggles).
  function renderSetup() {
    if (currentAnim) { currentAnim.destroy(); currentAnim = null; }
    const fx = fxCfg();
    const sw = (key, label, hint) => `
      <label class="vs-fx-row" title="${escapeHtml(hint)}">
        <span class="form-check form-switch m-0">
          <input class="form-check-input vs-fx" type="checkbox" role="switch" data-fx="${key}" ${fx[key] ? 'checked' : ''}>
        </span>
        <span class="vs-fx-label">${label}<small class="d-block text-muted">${escapeHtml(hint)}</small></span>
      </label>`;

    const avLeft  = loadAvatar(a.id, 'left');
    const avRight = loadAvatar(a.id, 'right');

    const avatarCol = (side, label, defaultName, avData) => `
      <div class="col-6">
        <label class="form-label small text-muted fw-semibold">${label}</label>
        <div class="vs-av-upload-wrap">
          <div class="vs-av-preview" id="vs-av-${side}">${avatarPreviewHtml(avData, side)}</div>
          <label class="btn btn-sm btn-outline-secondary vs-av-btn" title="Máx 150 KB · JPG/PNG/WebP">
            <i class="bi bi-image"></i> Foto
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" id="vs-file-${side}" hidden>
          </label>
          ${avData ? `<button class="btn btn-sm btn-outline-danger vs-av-clear" data-side="${side}" title="Quitar imagen"><i class="bi bi-x-lg"></i></button>` : ''}
        </div>
        <input id="vs-name-${side}" class="form-control text-center mt-2"
               value="${escapeHtml(defaultName)}" maxlength="20" placeholder="${escapeHtml(defaultName)}">
        <div class="vs-av-err text-danger small mt-1" id="vs-av-err-${side}" hidden></div>
      </div>`;

    const body = `
      <div class="row justify-content-center g-3 mb-3" style="max-width:520px;margin:auto">
        ${avatarCol('left',  'Equipo izquierda', 'Alumno 1', avLeft)}
        ${avatarCol('right', 'Equipo derecha',   'Alumno 2', avRight)}
      </div>
      <details class="vs-fx-panel mx-auto mt-3">
        <summary><i class="bi bi-sliders"></i> Sonido y efectos</summary>
        <div class="vs-fx-grid">
          ${sw('sound',    'Sonido',             'Un sonido corto al acertar o fallar.')}
          ${sw('flash',    'Destello de color',  'Fondo verde al acertar, rojo al fallar.')}
          ${sw('confetti', 'Confeti por pregunta','Lluvia de confeti en cada acierto (desactivado por defecto).')}
        </div>
      </details>`;

    renderModeSetup(host, {
      icon: 'bi-fire', color: 'danger', title: 'Duelo VS',
      subtitle: `${a.title} · ${sessionItems(a).length} preguntas`,
      body, backHref,
      note: 'Cada jugador responde en su lado. Gana quien sume más puntos.',
      onMount: () => {
        // Feedback toggles persist per-activity (presentation.vsFeedback).
        on(host, 'change', '.vs-fx', (_, el) => {
          if (!a.presentation) a.presentation = {};
          a.presentation.vsFeedback = { ...fxCfg(), [el.dataset.fx]: el.checked };
          save(a);
        });

        // Avatar upload — validate size, read as data-URL, cache in localStorage.
        ['left', 'right'].forEach(side => {
          const fileInput = document.getElementById(`vs-file-${side}`);
          if (!fileInput) return;
          fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const errEl = document.getElementById(`vs-av-err-${side}`);
            if (file.size > AVATAR_MAX_BYTES) {
              if (errEl) { errEl.textContent = `Imagen demasiado grande (${Math.round(file.size/1024)} KB). Máximo: 150 KB.`; errEl.hidden = false; }
              e.target.value = '';
              return;
            }
            if (errEl) errEl.hidden = true;
            const reader = new FileReader();
            reader.onload = (ev) => {
              const data = ev.target.result;
              saveAvatar(a.id, side, data);
              const preview = document.getElementById(`vs-av-${side}`);
              if (preview) preview.innerHTML = `<img src="${escapeHtml(data)}" class="vs-av-thumb" alt="">`;
            };
            reader.readAsDataURL(file);
          });
        });

        // Clear avatar button (only rendered when an avatar exists).
        on(host, 'click', '.vs-av-clear', (_, btn) => {
          const side = btn.dataset.side;
          saveAvatar(a.id, side, '');
          const preview = document.getElementById(`vs-av-${side}`);
          if (preview) preview.innerHTML = avatarPreviewHtml('', side);
          btn.remove();
        });
      },
      onStart: () => {
        const left  = ($('#vs-name-left')?.value  || '').trim() || 'Alumno 1';
        const right = ($('#vs-name-right')?.value || '').trim() || 'Alumno 2';
        startMatch(left, right);
      }
    });
  }

  function startMatch(leftName, rightName) {
    const T = getTemplate(a.template);
    // Carrera: el duelo se CIERRA en cuanto un lado completa todos los ítems y
    // ese lado gana — el otro deja de poder responder. En plantillas con
    // reintento (Operaciones) un fallo no avanza, así que "terminar" = todas
    // bien; en quiz, el primero en contestar todas gana la carrera.
    const session = createSession(a, { format: FORMATS.VS, left: leftName, right: rightName, raceToFinish: true });
    session.start();
    const flashing = { left: false, right: false };
    let finished = false; // guards finish() against double-fire from pending timers
    const fx = fxCfg();
    const avatars = { left: loadAvatar(a.id, 'left'), right: loadAvatar(a.id, 'right') };
    // The central stage is a pluggable animation chosen by the teacher in
    // Presentación (default: the built-in SVG tug-of-war).
    const animDef = getVsAnimation(a.presentation?.vsAnimation || 'svg-tug');

    const vsTheme = getSkin(a.presentation?.skin)?.vsLayout || 'classic';

    paintArena();
    renderSide('left'); renderSide('right'); updateCenter();

    function paintArena() {
      const st = session.standings();
      mount(host, html`
        <div class="vs-wrap">
          <div class="vs-arena vs-skin-${vsTheme}">
            ${vsBarHtml(st.left.name, st.right.name, avatars.left, avatars.right)}
            <div class="vs-main">
              <div class="vs-panel vs-left" data-side="left">
                <div class="vs-body" id="vs-body-left"></div>
              </div>
              <div class="vs-stage" id="vs-stage">
                <div class="vs-tug-label" id="vs-tug-label">¡Empate!</div>
                <div class="vs-stage-canvas" id="vs-stage-canvas"></div>
              </div>
              <div class="vs-panel vs-right" data-side="right">
                <div class="vs-body" id="vs-body-right"></div>
              </div>
            </div>
          </div>
        </div>`);
      on(host, 'click', '#vs-again', () => renderSetup());
      if (currentAnim) currentAnim.destroy();
      currentAnim = animDef.create(document.getElementById('vs-stage-canvas'), { src: a.presentation?.vsAnimationSrc });
    }

    function vsBarHtml(lName, rName, lAv, rAv) {
      const av = (src, name) => src
        ? `<img src="${escapeHtml(src)}" class="vs-avatar vss-av" alt="">`
        : `<span class="vs-avatar vss-av vs-avatar-init">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
      return `
        <div class="vss-bar">
          <div class="vss-team vss-left">
            ${av(lAv, lName)}
            <div class="vss-info">
              <div class="vss-label">EQUIPO</div>
              <div class="vss-name">${escapeHtml(lName)}</div>
              <div class="vs-prog"><div class="vs-prog-bar" id="vs-prog-left"></div></div>
            </div>
            <span class="vss-score" id="vs-score-left">0</span>
          </div>
          <div class="vss-mid"><div class="vss-badge">VS</div></div>
          <div class="vss-team vss-right">
            <span class="vss-score" id="vs-score-right">0</span>
            <div class="vss-info vss-info-r">
              <div class="vss-label">EQUIPO</div>
              <div class="vss-name">${escapeHtml(rName)}</div>
              <div class="vs-prog"><div class="vs-prog-bar" id="vs-prog-right"></div></div>
            </div>
            ${av(rAv, rName)}
          </div>
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
      // Guard against late taps after this side has already finished all items
      // or after the whole duel has ended (both sides done).
      if (session.standings()[side].done || session.status !== 'running') return;

      // Templates that set vsCanRetry=true (e.g. math keypad) must re-try on
      // wrong: flash red, re-render the SAME question without advancing cursor.
      if (T.vsCanRetry && typeof T.scoreSubmission === 'function') {
        const cursor = session.standings()[side].cursor;
        const item = sessionItems(a)[cursor];
        let pre;
        try {
          pre = T.scoreSubmission({ value, item, activity: a, mode: 'vs' });
        } catch (err) {
          console.warn('[vsView] scoreSubmission threw — treating as correct to unblock player:', err);
          pre = { correct: true };
        }
        if (!pre.correct) {
          flashing[side] = true;
          const body = document.getElementById('vs-body-' + side);
          if (fx.flash && body) body.classList.add('vs-flash-no');
          if (fx.sound) playSound('wrong');
          setTimeout(() => {
            flashing[side] = false;
            if (body) body.classList.remove('vs-flash-no');
            renderSide(side); // re-renders same question (cursor unchanged)
          }, FLASH_MS);
          return;
        }
      }

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
      if (r.correct && currentAnim) currentAnim.yank(side);
      if (r.correct && fx.confetti) answerConfetti();
      setTimeout(() => {
        flashing[side] = false;
        if (body) body.classList.remove('vs-flash-ok', 'vs-flash-no');
        const st = session.standings();
        if (st.finished) {
          // Carrera terminada: cerrar las calculadoras (paneles) y dejar la
          // animación central celebrando al ganador un instante antes del podio.
          // Nota: `host` puede ser un selector (string) — usar document, igual
          // que el resto de la vista (getElementById/querySelector).
          const arena = document.querySelector('.vs-arena');
          if (arena) arena.classList.add('vs-race-finished');
          // Carrera: gana quien terminó primero (finishedBy). Solo si no hubiera
          // finisher (estado heredado) cae al criterio de puntos.
          const ws = st.finishedBy || (st.leader !== 'tie' ? st.leader : null);
          if (ws && currentAnim) currentAnim.setProgress(ws === 'left' ? 1 : -1);
          setTimeout(() => finish(st), 1500);
        } else {
          renderSide(side);
        }
      }, FLASH_MS);
    }

    // Feed the stage the normalized lead (−1..1, + = left) so it reacts to the
    // score, and update the textual "who's winning" label (view chrome).
    function updateCenter() {
      const st = session.standings();
      const label = document.getElementById('vs-tug-label');
      const signed = st.left.score - st.right.score;          // + → left ahead
      const lead = signed / (st.left.score + st.right.score + 1);
      if (currentAnim) currentAnim.setProgress(Math.max(-1, Math.min(1, lead * 2.1)));
      if (label) {
        label.textContent = signed === 0 ? '¡Empate!'
          : `${(signed > 0 ? st.left.name : st.right.name)} va ganando (+${Math.abs(signed)})`;
      }
    }

    function finish(st) {
      if (finished) return; // idempotent: both sides' pending timers may call this
      finished = true;
      if (currentAnim) { currentAnim.destroy(); currentAnim = null; }
      // List-orchestrator mode: delegate result handling to the caller.
      if (opts.onFinish) { opts.onFinish(st); return; }
      // Carrera: gana quien terminó primero (finishedBy). Si por alguna razón no
      // hay finisher (estado heredado), cae al criterio de puntos.
      const winnerSide = st.finishedBy || (st.leader !== 'tie' ? st.leader : null);
      const tie = !winnerSide;
      const winner = tie ? null : st[winnerSide];
      // El ganador (quien terminó primero) encabeza el podio; el otro lado después.
      const other = winnerSide === 'left' ? 'right' : 'left';
      const ranked = (winnerSide
        ? [st[winnerSide], st[other]]
        : [st.left, st.right].sort((a, b) => b.score - a.score))
        .map(s => ({ name: s.name, score: s.score }));
      const heading = tie
        ? `<i class="bi bi-emoji-neutral text-secondary"></i> ¡Empate a ${st.left.score}!`
        : `<i class="bi bi-trophy-fill text-warning"></i> 🏆 ¡${escapeHtml(winner.name)} gana!`;
      const body = `
        <div class="vs-result text-center py-4">
          <h2 class="mb-3">${heading}</h2>
          ${podiumHtml(ranked)}
          <button id="vs-again" class="btn btn-danger btn-lg mt-2"><i class="bi bi-arrow-repeat"></i> Otra vez</button>
          ${backHref ? `<a href="${backHref}" class="btn btn-outline-secondary btn-lg mt-2 ms-2">Salir</a>` : ''}
        </div>`;
      mount(host, html`<div class="vs-result-screen">${body}</div>`);
      // Only celebrate a real winner. On a tie, no victory fanfare/confetti
      // (PODIUM triggers win.mp3 + confetti) — a draw isn't a win.
      if (winner) emitGame(GameEvents.PODIUM, { top: [{ name: winner.name, score: winner.score }] });
      on(host, 'click', '#vs-again', () => renderSetup());
    }
  }

  return { dispose() { if (currentAnim) { currentAnim.destroy(); currentAnim = null; } } };
}
