// LA ARENA DEL DUELO: los dos paneles jugando en paralelo, la barra de arriba,
// la animación central y el cierre con el podio.
//
// Sale de `views/vsView.js` (Fase 6 del plan de simplificar), donde `startMatch`
// eran 286 líneas dentro de una vista que además hacía la antesala, los avatares
// y el ciclo de vida. Aquí está SOLO el encuentro: de `start()` al podio.
//
// El flujo y la puntuación siguen en kernel/session/vsMachine.js (vía la fachada
// engine.js, formato 'vs'): esto pinta y refleja el marcador, no decide nada del
// juego.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { createSession, FORMATS, ganador } from '../../kernel/session/engine.js';
import { sessionItems } from '../../kernel/content/sessionItems.js';
import { supportsLoop } from '../../core/liveLoops.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { cierreHtml } from '../../core/podium.js';
import { duelSummaryHtml } from '../../core/duelSummary.js';
import { getVsAnimation, DEFAULT_VS_ANIMATION } from '../../core/vsAnimations.js';
import { play as playSound } from '../../core/sounds.js';
import { answerConfetti } from '../../core/effects.js';
import { applyPlayOptions } from '../../core/playOptions.js';
import { FLASH_MS, WIN_HOLD_MS, CONFETTI_ENCORE_MS } from '../../core/timings.js';
import { getSkin } from '../../core/skins.js';

/** @typedef {import('../../kernel/contracts/activity.js').Activity} Activity */
/** @typedef {import('../../core/vsAnimations.js').AnimacionVs} AnimacionVs */
/** @typedef {import('../../core/playOptions.js').PlayChoices} PlayChoices */
/** @typedef {import('../vsView.js').Lado} Lado */
/** @typedef {import('../vsView.js').PlantillaDuelo} PlantillaDuelo */
/** @typedef {import('../vsView.js').SesionVs} SesionVs */
/** @typedef {import('../vsView.js').MarcadorCrudo} MarcadorCrudo */

/**
 * @typedef {Object} OpcionesArena
 * @property {Activity} a
 * @property {PlantillaDuelo} T
 * @property {ReturnType<import('../../core/lifecycle.js').acquire>} life  el ritmo (destello, celebración, confeti) va por aquí (§23)
 * @property {PlayChoices} playChoices
 * @property {{flash?: boolean, confetti?: boolean}} fx
 * @property {boolean} animOn            si se ve la animación central
 * @property {Record<Lado, string>} avatars
 * @property {string} leftName
 * @property {string} rightName
 * @property {string} [backHref]
 * @property {(st: MarcadorCrudo) => void} [onFinish]  el orquestador de listas se queda el resultado
 * @property {() => void} onAgain        «Otra vez» → vuelve a la antesala
 */

/**
 * Monta el encuentro en `host` y lo deja corriendo.
 * @param {string|Element} host
 * @param {OpcionesArena} opts
 * @returns {{destroy: () => void}} suelta la animación central (el resto lo drena `life`)
 */
export function montarArena(host, opts) {
  const { a, T, life, playChoices, fx, animOn, avatars, leftName, rightName, backHref, onFinish, onAgain } = opts;
  // Cómo acaba el duelo lo DECLARA la plantilla en `meta.play.vs` y lo aplica el
  // motor ('race' | 'points'). Antes esta vista forzaba carrera para las 13, así
  // que en Quiz/Emparejar/Tildes el primero en terminar cortaba al otro y le
  // robaba lo que llevaba hecho (bug de QA).
  const session = /** @type {SesionVs} */ (createSession(applyPlayOptions(T, a, playChoices),
    { format: FORMATS.VS, left: leftName, right: rightName }));
  session.start();
  const flashing = { left: false, right: false };
  let finished = false; // guards finish() against double-fire from pending timers
  /** @type {AnimacionVs|null} */
  let currentAnim = null; // the running central animation (destroyed on destroy())
  // The central stage is a pluggable animation chosen by the teacher in
  // Presentación (default: the built-in SVG tug-of-war / "cuerda"). The teacher
  // can hide it entirely (presentation.vsAnimationOff) → the two panels take the
  // whole width.
  const animDef = getVsAnimation(a.presentation?.vsAnimation || DEFAULT_VS_ANIMATION);
  // Por defecto la animación central se DESACTIVA en plantillas de texto
  // (Tildes/Comas): el texto necesita el ancho y el carril central lo robaba.
  // Los dos paneles pasan a 50%/50% (vs-no-stage). El profe puede forzar on/off
  // con presentation.vsAnimationOff (si está definido, manda sobre el default).
  const animOff = !animOn;
  // Compacta = la animación se queda en la franja de arriba del carril y
  // suelta el resto (Presentación → «Animación compacta»); es puro tamaño,
  // no interfiere con animOff (que oculta el carril entero).
  const animCompact = !!a.presentation?.vsAnimCompact;
  // "Board" templates (Ordena las Pelotas): one shared board, no per-question
  // score during play, so the rope is fed by each side's BOARD progress instead.
  const isBoard = supportsLoop(T, 'board');
  const boardProgress = { left: 0, right: 0 };

  // POLÍTICA DE MAQUETACIÓN del panel, declarada por la plantilla (estándar):
  //   'fill'   → el contenido LLENA el panel y se escala para caber (texto de
  //              Tildes, opciones de Quiz). Es el valor por defecto.
  //   'block'  → bloque ÚNICO indivisible a su tamaño natural, centrado y CON
  //              tope (no se estira a toda la vertical) — p.ej. la calculadora.
  //   'center' → tamaño natural, centrado, sin llenar (contenido pequeño).
  // El panel recibe la clase `ww-fit-<modo>` y styles/vs.css aplica cada caso.
  const panelFit = T.meta?.panelFit || 'fill';

  const vsTheme = getSkin(a.presentation?.skin)?.vsLayout || 'classic';

  paintArena();
  renderSide('left'); renderSide('right'); updateCenter();

  function paintArena() {
    const st = session.standings();
    mount(host, html`
      <div class="vs-wrap">
        <div class="vs-arena vs-skin-${vsTheme}${animOff ? ' vs-no-stage' : ''}${animCompact ? ' vs-anim-compact' : ''}">
          ${vsBarHtml(st.left.name, st.right.name, avatars.left, avatars.right)}
          <div class="vs-main">
            <div class="vs-panel vs-left" data-side="left">
              <div class="vs-body ww-fit-${panelFit}" id="vs-body-left"></div>
            </div>
            <div class="vs-stage">
              <div class="vs-tug-label" id="vs-tug-label">¡Empate!</div>
              <div class="vs-stage-canvas" id="vs-stage-canvas"></div>
            </div>
            <div class="vs-panel vs-right" data-side="right">
              <div class="vs-body ww-fit-${panelFit}" id="vs-body-right"></div>
            </div>
          </div>
        </div>
      </div>`);
    on(host, 'click', '#vs-again', () => onAgain());
    if (currentAnim) { currentAnim.destroy(); currentAnim = null; }
    // Skip the central animation entirely when the teacher turned it off.
    const lienzo = document.getElementById('vs-stage-canvas');
    if (!animOff && animDef && lienzo) {
      currentAnim = animDef.create(lienzo, { src: a.presentation?.vsAnimationSrc });
    }
  }

  /** @param {string} lName @param {string} rName @param {string} lAv @param {string} rAv */
  function vsBarHtml(lName, rName, lAv, rAv) {
    /** @param {string} src @param {string} name */
    const av = (src, name) => src
      ? `<img src="${escapeHtml(src)}" class="vs-avatar vss-av" alt="">`
      : `<span class="vs-avatar vss-av vs-avatar-init">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
    return `
      <div class="vss-bar" style="--vs-total:${Math.max(1, session.totalItems)}">
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
  /** @param {Lado} side */
  function renderSide(side) {
    const body = document.getElementById('vs-body-' + side);
    if (!body) return;
    const payload = session.roundPayloadFor(side);
    const st = session.standings()[side];
    const prog = document.getElementById('vs-prog-' + side);
    // Board templates feed the top bar from board completeness (updateBoardLead);
    // item templates from the item cursor.
    // scaleX y no width: animar el ancho relayoutea (ver styles/vs.css).
    if (prog && !isBoard) prog.style.transform = `scaleX(${st.cursor / session.totalItems})`;

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
    // Board templates also stream progress (onProgress) so the rope reacts to
    // how sorted each side's board is, move by move.
    body.innerHTML = '';
    T.renderRound(body, payload, {
      onSubmit: (value) => onAnswer(side, value),
      onProgress: isBoard ? (snap) => { boardProgress[side] = snap?.progress || 0; updateBoardLead(); } : undefined,
    });
  }

  // Board duel: drive the rope + top bars from each side's board completeness.
  function updateBoardLead() {
    const names = session.standings();
    /** @type {Lado[]} */ (['left', 'right']).forEach(s => {
      const prog = document.getElementById('vs-prog-' + s);
      if (prog) prog.style.transform = `scaleX(${boardProgress[s]})`;
    });
    const diff = boardProgress.left - boardProgress.right;     // -1..1, + = left
    if (currentAnim) currentAnim.setProgress(Math.max(-1, Math.min(1, diff)));
    const label = document.getElementById('vs-tug-label');
    if (label) {
      label.textContent = Math.abs(diff) < 0.02 ? '¡Igualados!'
        : `${(diff > 0 ? names.left.name : names.right.name)} va por delante`;
    }
  }

  /** @param {Lado} side @param {unknown} value */
  function onAnswer(side, value) {
    if (flashing[side]) return;
    // Guard against late taps after this side has already finished all items
    // or after the whole duel has ended (both sides done).
    if (session.standings()[side].done || session.status !== 'running') return;

    // Templates que declaran play.retry (p.ej. la calculadora) reintentan al
    // wrong: flash red, re-render the SAME question without advancing cursor.
    if (T.meta?.play?.retry && typeof T.scoreSubmission === 'function') {
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
        playSound('wrong');
        life.setTimeout(() => {
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
    if (scoreEl) scoreEl.textContent = String(session.standings()[side].score);
    const body = document.getElementById('vs-body-' + side);
    // Per-answer feedback is driven locally (not via the global game-event
    // bus) so VS controls exactly what fires: colour flash, a short sound,
    // and the central animation's reaction — but no per-question confetti
    // unless the teacher turned it on. Each piece honours its own toggle.
    if (fx.flash && body) body.classList.add(r.correct ? 'vs-flash-ok' : 'vs-flash-no');
    playSound(r.correct ? 'correct' : 'wrong');
    updateCenter();
    // The chosen animation reacts to the scorer; its sound (above) is what
    // ties feedback to the animation rather than a detached jingle.
    if (r.correct && currentAnim) currentAnim.yank(side);
    if (r.correct && fx.confetti) answerConfetti();
    life.setTimeout(() => {
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
        // Misma regla que el podio (`ganador`): la animación central no puede
        // celebrar a uno y el cierre coronar al otro.
        const ws = ganador(st);
        if (ws && currentAnim) currentAnim.setProgress(ws === 'left' ? 1 : -1);
        life.setTimeout(() => finish(st), WIN_HOLD_MS);
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

  /** @param {MarcadorCrudo} st */
  function finish(st) {
    if (finished) return; // idempotent: both sides' pending timers may call this
    finished = true;
    if (currentAnim) { currentAnim.destroy(); currentAnim = null; }
    // List-orchestrator mode: delegate result handling to the caller.
    if (onFinish) { onFinish(st); return; }
    // Quién gana lo decide la MÁQUINA (`ganador`, kernel/session/vsMachine.js),
    // que conoce la política declarada por la plantilla (carrera vs puntos).
    // La regla estaba tecleada aquí, en listView y en el remate de la carrera.
    const winnerSide = ganador(st);
    const tie = !winnerSide;
    const winner = winnerSide ? st[winnerSide] : null;
    // El ganador (quien terminó primero) encabeza el podio; el otro lado después.
    const other = winnerSide === 'left' ? 'right' : 'left';
    const ranked = (winnerSide
      ? [st[winnerSide], st[other]]
      : [st.left, st.right].sort((a, b) => b.score - a.score))
      .map(s => ({ name: s.name, score: s.score }));
    const actions = `
      <button id="vs-again" class="btn btn-danger btn-lg"><i class="bi bi-arrow-repeat"></i> Otra vez</button>
      ${backHref ? `<a href="${backHref}" class="btn btn-outline-secondary btn-lg ms-2">Salir</a>` : ''}`;
    // Cierre COMPARTIDO (`cierreHtml`, core/podium.js): el duelo aporta solo su
    // vestido — clase (rayos/foco/corona resueltos en CSS puro sobre
    // `.vs-celebration`, ver vs.css), el marcador grande (dato, no un SEGUNDO
    // «¡GANADOR!»/«¡Empate!»: el título ya lo dice, ver §31 costuras-divergencia
    // B8·4) y el resumen de qué puso cada uno (`duelSummaryHtml`). El `tie` va
    // EXPLÍCITO: el criterio del duelo es quién terminó primero
    // (`st.leader`/`finishedBy`), no solo la puntuación.
    const flourish = `<div class="vs-celeb-score">${winner ? `${winner.score} pts` : `${st.left.score} – ${st.right.score}`}</div>`;
    const body = cierreHtml({
      ranked, tie, resumen: flourish + duelSummaryHtml(st), acciones: actions,
      clase: tie ? 'vs-celebration vs-celeb-tie' : `vs-celebration vs-win-${winnerSide}`,
    });
    mount(host, html`<div class="vs-result-screen vs-skin-${vsTheme}">${body}</div>`);
    // Only celebrate a real winner. On a tie, no victory fanfare/confetti
    // (PODIUM triggers win.mp3 + confetti) — a draw isn't a win.
    if (winner) {
      emitGame(GameEvents.PODIUM, { top: [{ name: winner.name, score: winner.score }] });
      // Two follow-up bursts (respecting the confetti cooldown) sustain the moment.
      life.setTimeout(() => answerConfetti(), CONFETTI_ENCORE_MS[0]);
      life.setTimeout(() => answerConfetti(), CONFETTI_ENCORE_MS[1]);
    }
    on(host, 'click', '#vs-again', () => onAgain());
  }

  return { destroy() { if (currentAnim) { currentAnim.destroy(); currentAnim = null; } } };
}
