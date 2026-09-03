// VS view — head-to-head duel on ONE shared touchscreen. Two activities run in
// PARALLEL: alumno 1 plays the left panel, alumno 2 the right, each racing
// through the SAME item sequence at their own pace. A central tug-of-war bar,
// fed by the session engine's standings(), shows who's winning in real time.
//
// The flow/scoring live entirely in kernel/session/vsMachine.js (via the
// engine.js facade, format 'vs'); this view only paints panels and reflects
// standings — no game logic here.
//
// EMBEDDING: mountVs(host, activity, ctx, opts) renders setup + duel INTO `host`
// (the activity stage) and returns { dispose } so the page can stop the central
// animation when switching modes. (El wrapper de ruta suelta se eliminó: las
// rutas #/vs/:id montan vía renderPlayerView → runMode, no había otro caller.)
import { acquire, release } from '../core/lifecycle.js';
import { html, escapeHtml, mount, $ } from '../core/html.js';
import { on } from '../core/events.js';
import { save } from '../core/storage.js';
import { lsGet, lsSet } from '../core/ls.js';
import { getTemplate } from '../core/registry.js';
import { vsFeedback, setVsFeedback, vsAnimacionOn, setVsAnimacion } from '../core/presentation.js';
import { esHojaDeTexto } from '../core/contentModels/textCorrection.js';
import { createSession, isVsCompatible, FORMATS } from '../kernel/session/engine.js';
import { sessionItems } from '../kernel/content/sessionItems.js';
import { supportsLoop } from '../core/liveLoops.js';
import { GameEvents, emitGame } from '../core/gameEvents.js';
import { cierreHtml } from '../core/podium.js';
import { duelSummaryHtml } from '../core/duelSummary.js';
import { getVsAnimation, DEFAULT_VS_ANIMATION } from '../core/vsAnimations.js';
import { play as playSound } from '../core/sounds.js';
import { answerConfetti } from '../core/effects.js';
import { renderAntesala } from './antesala.js';
import { applyPlayOptions } from '../core/playOptions.js';
import { FLASH_MS, WIN_HOLD_MS, CONFETTI_ENCORE_MS } from '../core/timings.js';
import { getSkin } from '../core/skins.js';
import { uploadMedia } from '../core/upload.js';

const AVATAR_MAX_BYTES = 150 * 1024; // tope del avatar (lo aplica uploadMedia, comprimiendo antes)
const AVATAR_LADO_MAX = 512;         // px del lado mayor: se ve en una pastilla, no a pantalla

// El feedback por respuesta y la animación central son AMBIENTE del duelo, y su
// dueño es `core/presentation.js` (§21b): esta vista los LEE y los ESCRIBE por
// sus métodos, nunca con constantes propias. Tenía una copia de los defectos
// —y el editor otra—, así que retirar el interruptor de sonido pidió tocar los
// dos ficheros y el defecto de la animación no coincidía entre ambos.

// Avatar helpers — stored in localStorage keyed by activity id so they never
// bloat the activity JSON and survive across sessions on the same device.
function avatarKey(actId, side) { return `ww.vsavatar.${actId}.${side}`; }
function loadAvatar(actId, side) { return lsGet(avatarKey(actId, side), ''); }
function saveAvatar(actId, side, dataUrl) { lsSet(avatarKey(actId, side), dataUrl); }

function avatarPreviewHtml(dataUrl, side) {
  if (dataUrl) return `<img src="${escapeHtml(dataUrl)}" class="vs-av-thumb" alt="">`;
  return `<span class="vs-av-empty"><i class="bi bi-${side === 'left' ? 'person' : 'person'}-circle fs-1 text-muted"></i></span>`;
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

  const fxCfg = () => vsFeedback(a);
  // ¿SE VE LA ANIMACIÓN CENTRAL? UN solo sitio lo decide, porque lo preguntan
  // TRES: el interruptor de la antesala, el montaje del duelo y el panel del
  // editor. Si cada uno lo calculara por su cuenta, el interruptor podría salir
  // encendido y la animación no aparecer (o al revés) — mentirle al profe sobre
  // lo que va a ver es peor que no ofrecer el interruptor. Y pasaba: el editor
  // usaba `!vsAnimationOff` a secas y decía «sí» en Tildes/Comas, donde el duelo
  // la apaga sola porque su texto necesita el ancho.
  // Quién es «una hoja de texto» lo sabe la PLANTILLA; el dueño del ajuste
  // (core/presentation.js) solo recibe ese dato.
  const animOn = () => vsAnimacionOn(a, { textTight: esHojaDeTexto(a) });
  let currentAnim = null; // the running central animation (destroyed on dispose)
  // Ley de vista §23: los setTimeout de RITMO (destello, celebración, confeti)
  // se registran en el lifecycle — un cambio de modo o de ruta a mitad de
  // destello ya no repinta (renderSide/finish) sobre la vista siguiente. Era la
  // última vista de views/ fuera de la norma. (`life`, no `ctx`: el parámetro
  // `ctx` de mountVs es el contexto que ya pasa el padre.)
  const life = acquire('vsView');
  const T = getTemplate(a.template);
  // Opciones de partida elegidas en el setup (core/playOptions.js). Se aplican
  // a una COPIA al arrancar el duelo: la actividad guardada no se toca.
  let playChoices = {};

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
    // EL AMBIENTE DEL DUELO son PASTILLAS, como en las demás antesalas (dueño
    // 2026-09-01: «VS tiene bastante más opciones»). Eran interruptores de
    // Bootstrap con su explicación debajo, dentro de un desplegable propio: el
    // mismo ajuste que en Individual es una pastilla, aquí pedía abrir un panel
    // y leer cuatro filas. La explicación viaja en el `title`; lo que cambia el
    // JUEGO (no el ambiente) sigue arriba, en las opciones de partida.
    // El interruptor de la animación va INVERTIDO respecto al dato guardado
    // (`vsAnimationOff`): al profe se le pregunta si la QUIERE, no si la apaga.
    // Su defecto no es fijo — lo decide la plantilla si su texto es apretado
    // (`textTight`), y por eso se lee igual que en el duelo, no con un `?? false`.
    const ambienteExtra = [
      { id: 'flash', icon: 'bi-lightning-charge-fill', label: 'Destello', on: !!fx.flash,
        hint: 'Fondo verde al acertar, rojo al fallar.' },
      { id: 'confetti', icon: 'bi-balloon-heart-fill', label: 'Confeti', on: !!fx.confetti,
        hint: 'Lluvia de confeti en cada acierto (desactivado por defecto).' },
      { id: 'anim', icon: 'bi-easel-fill', label: 'Animación', on: animOn(),
        hint: 'El dibujo entre los dos paneles. Apagada, cada jugador gana la mitad del ancho.' },
    ];

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
      </div>`;

    renderAntesala(host, {
      activity: a,
      icon: 'bi-fire', color: 'danger', title: 'Duelo VS',
      subtitle: `${a.title} · ${sessionItems(a).length} preguntas`,
      bodyHtml: body, backHref,
      // LA ANIMACIÓN, DECISIÓN DEL DOCENTE Y EN LA ANTESALA (dueño, 2026-08-22).
      // El dibujo central se lleva la mitad del ancho, así que los dos paneles
      // se quedan con un cuarto cada uno: en una ventana de 908px eso son 209px
      // por alumno. Apagarla es la diferencia entre una calculadora cómoda y una
      // estrecha, y esa decisión la toma quien monta la clase.
      ambienteExtra,
      onAmbiente: (id, encendido) => {
        save(id === 'anim' ? setVsAnimacion(a, encendido) : setVsFeedback(a, id, encendido));
      },
      // Opciones de partida de la plantilla (p.ej. Pelotas: tiempo o
      // movimientos). Se aplican a la copia de juego al arrancar, no a la
      // actividad guardada.
      playOpts: { T, activity: a, choices: playChoices, onChange: (id, v) => { playChoices = { ...playChoices, [id]: v }; } },
      note: 'Cada jugador responde en su lado. Gana quien sume más puntos.',
      onMount: () => {
        // Los interruptores de ambiente los cablea la antesala (onAmbiente):
        // aquí solo queda lo que es del duelo y de nadie más — los avatares.
        // Avatar upload — validate size, read as data-URL, cache in localStorage.
        // DELEGADO con on() (idempotente por raíz+evento+selector): renderSetup se
        // re-ejecuta en "Otra vez" y el addEventListener directo apilaba un listener
        // por pasada (leak + disparos duplicados).
        // La foto de móvil pasa por el MISMO camino que toda imagen de la app
        // (core/upload.js: reescala + WebP hasta entrar en el tope) — antes
        // había un FileReader propio que rebotaba a 150 KB sin comprimir.
        on(host, 'change', 'input[id^="vs-file-"]', async (e, input) => {
          const side = input.id.endsWith('left') ? 'left' : 'right';
          const file = input.files[0];
          if (!file) return;
          const errEl = document.getElementById(`vs-av-err-${side}`);
          try {
            const data = await uploadMedia(file, { maxBytes: AVATAR_MAX_BYTES, ladoMax: AVATAR_LADO_MAX });
            if (errEl) errEl.hidden = true;
            saveAvatar(a.id, side, data);
            const preview = document.getElementById(`vs-av-${side}`);
            if (preview) preview.innerHTML = `<img src="${escapeHtml(data)}" class="vs-av-thumb" alt="">`;
          } catch (err) {
            if (errEl) { errEl.textContent = err?.message || 'No se pudo leer la imagen.'; errEl.hidden = false; }
            input.value = '';
          }
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
    // Cómo acaba el duelo lo DECLARA la plantilla en `meta.play.vs` y lo aplica el
    // motor ('race' | 'points'). Antes esta vista forzaba carrera para las 13, así
    // que en Quiz/Emparejar/Tildes el primero en terminar cortaba al otro y le
    // robaba lo que llevaba hecho (bug de QA).
    const session = createSession(applyPlayOptions(T, a, playChoices),
      { format: FORMATS.VS, left: leftName, right: rightName });
    session.start();
    const flashing = { left: false, right: false };
    let finished = false; // guards finish() against double-fire from pending timers
    const fx = fxCfg();
    const avatars = { left: loadAvatar(a.id, 'left'), right: loadAvatar(a.id, 'right') };
    // The central stage is a pluggable animation chosen by the teacher in
    // Presentación (default: the built-in SVG tug-of-war / "cuerda"). The teacher
    // can hide it entirely (presentation.vsAnimationOff) → the two panels take the
    // whole width.
    const animDef = getVsAnimation(a.presentation?.vsAnimation || DEFAULT_VS_ANIMATION);
    // Por defecto la animación central se DESACTIVA en plantillas de texto
    // (Tildes/Comas): el texto necesita el ancho y el carril central lo robaba.
    // Los dos paneles pasan a 50%/50% (vs-no-stage). El profe puede forzar on/off
    // con presentation.vsAnimationOff (si está definido, manda sobre el default).
    const animOff = !animOn();
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
      on(host, 'click', '#vs-again', () => renderSetup());
      if (currentAnim) { currentAnim.destroy(); currentAnim = null; }
      // Skip the central animation entirely when the teacher turned it off.
      if (!animOff) {
        currentAnim = animDef.create(document.getElementById('vs-stage-canvas'), { src: a.presentation?.vsAnimationSrc });
      }
    }

    function vsBarHtml(lName, rName, lAv, rAv) {
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
      ['left', 'right'].forEach(s => {
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
      if (scoreEl) scoreEl.textContent = session.standings()[side].score;
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
          // Carrera: gana quien terminó primero (finishedBy). Solo si no hubiera
          // finisher (estado heredado) cae al criterio de puntos.
          const ws = st.finishedBy || (st.leader !== 'tie' ? st.leader : null);
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

    function finish(st) {
      if (finished) return; // idempotent: both sides' pending timers may call this
      finished = true;
      if (currentAnim) { currentAnim.destroy(); currentAnim = null; }
      // List-orchestrator mode: delegate result handling to the caller.
      if (opts.onFinish) { opts.onFinish(st); return; }
      // Quién gana, según la política declarada por la plantilla:
      //   carrera → quien terminó primero (con los puntos como respaldo).
      //   puntos  → quien más sumó; si empatan, desempata quien acabó antes
      //             (Operaciones: ambos al 100% no debe leerse "empate").
      const byPoints = st.leader !== 'tie' ? st.leader : null;
      const winnerSide = st.race ? (st.finishedBy || byPoints) : (byPoints || st.finishedBy);
      const tie = !winnerSide;
      const winner = tie ? null : st[winnerSide];
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
      const flourish = `<div class="vs-celeb-score">${tie ? `${st.left.score} – ${st.right.score}` : `${winner.score} pts`}</div>`;
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
      on(host, 'click', '#vs-again', () => renderSetup());
    }
  }

  return { dispose() {
    release('vsView');   // drena los timeouts de ritmo (el padre nos desmonta sin hashchange)
    if (currentAnim) { currentAnim.destroy(); currentAnim = null; }
  } };
}
