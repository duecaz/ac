// Student-side live view. Routes: #/join, #/play/:code.
import { clock } from '../core/clock.js';
// §22-5 · la HORA COMÚN: todo lo que se compare con un instante de la SALA va
// por aquí, nunca por el reloj de este móvil (docs/handoff-reloj-aparatos.md).
import { serverNow } from '../core/serverNow.js';
import { questionGate } from '../core/liveGate.js';
import { startDeadlineTicker } from '../core/deadlineTicker.js';
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { joinSession, getOwnAnswer, listOwnAnswers, subscribeRoom, pingPresence, findRoomByCode, fetchSession, leaderboard, claimQuestion, submitProgress, submitRaceAttempt } from '../core/liveTransport.js';
import { raceResumeState } from '../core/raceResume.js';
import { findAssignmentByCode } from '../core/assignmentsTransport.js';
import { isAcceptableNickname } from '../core/nicknameFilter.js';
import { acquire } from '../core/lifecycle.js';
import { toast } from '../core/toast.js';
import { submit as queuedSubmit, flush as flushQueue, pendingCount } from '../core/submitQueue.js';
import { sceneToggle, resetScene } from '../core/presentation.js';
import { fullscreenButtonHtml, attachFullscreenButton } from '../core/fullscreen.js';
import { GameEvents, emitGame } from '../core/gameEvents.js';
import * as Streaks from '../core/streaks.js';
import { getTemplate } from '../core/registry.js';
import { sessionItems, roundPayloadOf } from '../kernel/session/engine.js';
import { visibleItem, hasClientKey } from '../core/liveSnapshot.js';
import { VERSION } from '../core/constants.js';
import { getNick, setNick } from '../core/identity.js';
import { wheelSvg } from '../templates/wheel/render.js';
import { pickIndex } from '../templates/wheel/logic.js';
import { spinTarget, normalizeRotation, animateSpin, SPIN_DUR_PICK } from '../templates/wheel/spin.js';
import { qlBoxesHtml } from '../core/questionLive.js';
import { RACE_FLASH_MS, questionWindowMs, readWindowMs, mmss } from '../core/timings.js';
import { supportsLoop, pointsModeFor, racePassed } from '../core/liveLoops.js';
import { standingOf } from '../core/liveRank.js';
import { endPolicyOf, waitingInfo } from '../core/liveEnd.js';


export function renderJoin(rootSel, prefilledCode = '') {
  mount(rootSel, html`
    <div class="text-center py-4" style="max-width:420px;margin:0 auto">
      <h2 class="mb-4">Unirme a la sala</h2>
      <input id="f-code" class="form-control form-control-lg text-center mb-3 ww-pin-input" maxlength="8" placeholder="Código" autocomplete="off" autocapitalize="characters" value="${escapeHtml(prefilledCode)}">
      <input id="f-nick" class="form-control form-control-lg text-center mb-3" placeholder="Tu apodo" value="${escapeHtml(getNick())}">
      <button id="btn-join" class="btn btn-warning btn-lg w-100">Entrar</button>
      <div id="err" class="text-danger mt-3"></div>
    </div>
  `);

  on(rootSel, 'click', '#btn-join', async () => {
    const code = document.getElementById('f-code').value.trim().toUpperCase();
    const nick = document.getElementById('f-nick').value.trim();
    const err = document.getElementById('err');
    err.textContent = '';
    if (code.length < 3) { err.textContent = 'Código inválido'; return; }
    const f = isAcceptableNickname(nick);
    if (!f.ok) { err.textContent = 'Apodo: ' + f.reason; return; }
    document.getElementById('btn-join').disabled = true;
    try {
      // Try assignment first; if the check itself fails (transient network /
      // Supabase-client-not-ready), treat the code as a live session so the
      // student isn't blocked by an unrelated lookup error.
      let task = null;
      try { task = await findAssignmentByCode(code); } catch { /* fall through to live join */ }
      if (task) {
        setNick(f.value);
        location.hash = `#/task/${code}`;
        return;
      }
      const r = await joinSession(code, nick);
      setNick(f.value);
      sessionStorage.setItem(`ww.player.${code}`, JSON.stringify(r));
      location.hash = `#/play/${code}`;
    } catch (e) {
      err.textContent = e.message;
      document.getElementById('btn-join').disabled = false;
    }
  });
}

export async function renderPlay(rootSel, code) {
  const ctx = acquire('studentLive');
  const cached = sessionStorage.getItem(`ww.player.${code}`);
  if (!cached) return renderJoin(rootSel, code);
  const player = JSON.parse(cached);

  let session = null;
  let activity = null;
  let lastQuestionShownAt = 0;
  let questionTicker = null;   // cronómetro de pregunta (core/deadlineTicker.js)
  let lecturaHechaEn = -1;     // §22-5 · índice del ítem cuya ventana de lectura ya cumplió ESTE móvil
  let lastPhaseKey = '';
  let autoFlushQuestion = null;  // capturar el trazo en curso al avanzar sin "Listo"
  let rescuedIdx = -1;           // ítem cuyo trazo se rescató (su POST puede ir en vuelo)
  let rescuedSubmit = null;      // promesa de ese POST — paintRevealOwn la espera
  let myScore = 0;      // estimación local de respaldo (autoritativo = leaderboard del servidor)
  let endedFired = false;
  let endingInProgress = false;
  let raceQueue = null;       // null = not started yet; [] = finished
  let raceCorrectCount = 0;
  let raceFirstSent = new Set();  // ítems cuyo PRIMER intento ya se envió (análisis)
  let raceSeed = null;        // promesa de la siembra de la cola (una sola vez)
  let qlSpinning = false;      // guards the question-live wheel mid-spin
  let qlRotation = 0;          // persisted wheel angle across spins
  // Tracks items we've already bumped streak for. Without this, host_seen_at
  // pings re-trigger paintRevealOwn and would replay every ~10 s.
  const revealedItems = new Set();

  try {
    const sess = await findRoomByCode(code);
    if (!sess) { mount(rootSel, html`<div class="alert alert-warning m-3">Sala no encontrada.</div>`); return; }
    session = sess;
    activity = sess.activity_snap;
  } catch (e) {
    mount(rootSel, html`<div class="alert alert-danger m-3">${escapeHtml(e.message)}</div>`); return;
  }

  // ── VERSIÓN DESFASADA → recarga DURA del grafo (una vez) ───────────────────
  // La sala lleva la versión del profe (core/liveSnapshot.js). Si este móvil
  // corre otra, el grafo de módulos está MEZCLADO (GitHub Pages sirve con
  // max-age=600: tras un deploy conviven módulos nuevos y cacheados) y la
  // mezcla rompe al pasar de lobby a pregunta — el bug real de las partidas en
  // producción. Un reload/cache-buster de página NO refresca los ES modules:
  // hay que re-pedir cada módulo con `cache:'reload'` (core/appRefresh.js) y
  // LUEGO recargar. Una vez por sala (flag en sessionStorage): si tras eso el
  // CDN aún sirve la versión anterior, el grafo al menos queda COHERENTE y es
  // mejor jugar que ciclar recargas.
  if (activity?.appVersion && activity.appVersion !== VERSION) {
    const onceKey = `ww.vreload.${code}`;
    if (!sessionStorage.getItem(onceKey)) {
      sessionStorage.setItem(onceKey, '1');
      mount(rootSel, html`<div class="text-center py-5"><div class="spinner-border"></div>
        <p class="mt-3">Actualizando a la versión del profesor…</p></div>`);
      const { refreshAppGraph } = await import('../core/appRefresh.js');
      await refreshAppGraph();
      location.replace(location.pathname + '?_=' + clock.now() + location.hash);
      return;
    }
    console.warn(`[studentLive] versión desfasada tras recargar (app ${VERSION} vs sala ${activity.appVersion}) — se intenta jugar igual`);
  }

  // Escena POR FASE (docs/handoff-player-frame.md, Etapa 1): el fondo de la
  // actividad va SOLO en las pantallas de JUEGO; lobby/espera/resultado (chrome)
  // van neutros. Toggle compartido con hostLive (core/presentation.js).
  const scene = sceneToggle(activity);
  ctx.add(() => resetScene());
  // Prevent overscroll while playing.
  document.body.classList.add('ww-play-noscroll');
  ctx.add(() => document.body.classList.remove('ww-play-noscroll'));

  // Re-lectura de la sesión COALESCIDA: el evento realtime y el poll de 8 s piden
  // lo mismo; si una petición ya va en vuelo (que con los reintentos de pbFetch
  // puede tardar), ambos comparten esa promesa en vez de apilar cadenas de
  // reintentos concurrentes contra el servidor caído. Fail-soft: un fallo
  // transitorio se ignora (el siguiente tick recupera) — sin try/catch, esa
  // promesa rechazaba sin capturar y dejaba al alumno con un error en el lobby.
  let refetching = null;

  // La ACTIVIDAD también cambia a mitad de partida, no solo el estado. Al
  // arrancar la carrera la sala pasa del snapshot saneado a la actividad
  // COMPLETA (§22-2), y el móvil se quedaba con la del lobby para siempre:
  // jugaba sin clave y daba por fallada hasta una hoja perfecta. Toda entrada de
  // sesión pasa por aquí para que `activity` y `session` no puedan desfasarse.
  function adoptSession(next) {
    if (!next) return;
    const snap = next.activity_snap;
    // Solo se adopta si TRAE actividad: un diff parcial de realtime sin ese
    // campo no puede borrar la que ya tenemos.
    if (snap && snap !== activity) {
      const gainedKey = !hasClientKey(activity) && hasClientKey(snap);
      activity = snap;
      // Llegó la clave estando ya en carrera → repintar para salir de la espera.
      if (gainedKey && session?.phase === 'race') lastPhaseKey = null;
    }
    session = { ...session, ...next };
    paint();
  }

  async function refreshSession() {
    refetching ??= fetchSession(session.id).finally(() => { refetching = null; });
    try { adoptSession(await refetching); }
    catch { /* transitorio: el próximo evento/poll recupera */ }
  }
  ctx.add(await subscribeRoom(session.id, async (ev) => {
    if (ev.table === 'sessions') {
      // Full diff (Supabase) or re-fetch on a bare ping (local driver).
      if (ev.new) adoptSession(ev.new);
      else await refreshSession();
    }
  }));
  ctx.setInterval(() => pingPresence(player.playerId).catch(()=>{}), 15000);
  // Polling fallback: mobile WebSockets drop when the tab goes to background
  // or the network switches. Re-fetch session every 8 s so the student
  // catches up even if the realtime event was missed. paint() is idempotent
  // (the lastPhaseKey dedup skips re-renders when nothing changed).
  ctx.setInterval(refreshSession, 8000);
  // Try to flush any pending submissions (in case we just regained network).
  flushQueue().catch(() => {});

  function paint() {
    // Short-circuit: ignore session UPDATEs that don't change the visible
    // state (e.g. host_seen_at heartbeats every 10 s). Without this, every
    // ping repaints, replays sounds, and bumps streaks.
    const key = `${session.status}-${session.phase}-${session.current_item}-${session.deadline||''}-${session.ql_open??''}-${Object.keys(session.ql_points||{}).length}`;
    if (qlSpinning) return; // don't repaint over an in-progress wheel spin
    if (key === lastPhaseKey) return;
    lastPhaseKey = key;
    // Al SALIR de la fase 'question' (el profe reveló/avanzó) sin que el alumno
    // pulsara "Listo": captura su trazo EN CURSO en vez de descartarlo. En Tildes/
    // Comas dibujar lleva su tiempo; antes, si el profe avanzaba mientras el alumno
    // aún colocaba tildes, su respuesta se perdía → salía "Sin respuesta" pese a
    // tener buenas tildes (aunque no todas). autoFlushQuestion solo está armado
    // mientras hay una pregunta pendiente; hace clic en "Listo" con lo dibujado.
    if (autoFlushQuestion && session.phase !== 'question') {
      try { autoFlushQuestion(); } catch { /* best-effort */ }
      autoFlushQuestion = null;
    }
    if (session.status === 'lobby') { scene(false); return paintLobby(); }
    if (session.status === 'ended') { scene(false); return paintEnded(); }
    if (session.phase === 'question-live') { scene(true); return paintQuestionLive(); }
    if (session.phase === 'race') { scene(true); return isLiveBoard() ? paintLiveBoard() : paintRace(); }
    if (session.phase === 'question') { scene(true); return paintQuestion(); }
    if (session.phase === 'reveal') { scene(true); return paintRevealOwn(); }
    if (session.phase === 'leaderboard') { scene(false); return paintWaiting('Mira la pizarra del profesor.'); }
    scene(false); paintWaiting('Esperando…');
  }

  function paintLobby() {
    mount(rootSel, html`
      <div class="text-center py-5">
        <div class="d-flex justify-content-end mb-2">${fullscreenButtonHtml()}</div>
        <h1 class="display-4">${escapeHtml(player.name)}</h1>
        <p class="lead">¡Estás dentro!</p>
        <p>PIN: <b>${escapeHtml(code)}</b></p>
        <p>Esperando a que el profesor empiece…</p>
        <div class="spinner-border"></div>
      </div>
    `);
    attachFullscreenButton(rootSel);
  }

  const rootEl = () => (typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel);

  async function qlOpenQuestion(idx) {
    if (session.ql_open !== null) return; // race — someone beat us
    // §22-2 — lo que el alumno puede leer de un ítem sale de su PAYLOAD (ya sin
    // solución), no del contenido: el snapshot de la sala ya no lo lleva.
    const raw = visibleItem(activity, idx);
    // Support both new {q, image} format and old flat-string entries format.
    const label = typeof raw === 'string' ? raw : (raw?.question ?? raw?.q ?? '');   // ?? q: sesión en vuelo pre-migración
    // Image is NOT put in session state (data-URLs are heavy) — both host and
    // student already hold the full activity and read it locally by index.
    // Pedir la palabra escribe SOLO el campo `ql` de la sala: el alumno no
    // puede tocar fase/ítem/deadline/puntajes (ley de confianza §22).
    await claimQuestion(session.id, {
      open: idx,
      question: label,
      by: player.playerId,
      byName: player.name,
    });
  }

  // Card shown to everyone once a question is open (the picker sees "¡Tu pregunta!").
  function qlOpenCardHtml(qlQuestion, qlImage, iMine) {
    return `<div class="card bg-dark text-light p-4 mx-auto mt-2" style="max-width:500px">
       <p class="text-muted small mb-1">${iMine ? '<i class="bi bi-hand-index-fill text-warning"></i> ¡Tu pregunta!' : '<i class="bi bi-hand-index-fill"></i> Pregunta en curso'}</p>
       ${qlImage ? `<div class="text-center mb-2"><img src="${escapeHtml(qlImage)}" class="img-fluid rounded" style="max-height:180px"></div>` : ''}
       <h3 class="text-center">${escapeHtml(qlQuestion || '')}</h3>
     </div>`;
  }

  function paintQuestionLive() {
    // wheel template always spins; question-live reads its selector rule.
    // La ruleta la declara la ACTIVIDAD (rules.selector), no el nombre de la
    // plantilla: 'wheel' trae ese selector por defecto en sus reglas.
    const selector = activity.rules?.selector || 'boxes';
    if (selector === 'wheel') return paintQuestionLiveWheel();
    return paintQuestionLiveBoxes();
  }

  function paintQuestionLiveBoxes() {
    const qlOpen     = session.ql_open ?? null;
    const qlQuestion = session.ql_question ?? null;
    const qlImage    = qlOpen !== null ? (visibleItem(activity, qlOpen)?.image ?? null) : null;
    const qlPoints   = session.ql_points || {};
    const qlBy       = session.ql_by ?? null;
    const allItems   = sessionItems(activity);
    const cols       = Math.min(4, Math.max(2, Math.ceil(allItems.length / 2)));
    const iMine      = qlBy === player.playerId;
    const canPick    = qlOpen === null; // only 1 box open at a time

    // El tablero, de su dueño (core/questionLive.js). Lo propio de esta pantalla
    // es solo QUÉ puede tocar el alumno: una caja libre, y solo si le toca.
    const boxesHtml = qlBoxesHtml(allItems.length, {
      done: qlPoints, open: qlOpen, cls: 'ql-sbox',
      pickable: () => canPick, extraStyle: 'border-radius:8px',
    });

    mount(rootSel, html`
      <div class="text-center py-3">
        <div class="ql-student-grid mb-3" style="grid-template-columns:repeat(${cols},1fr)">${boxesHtml}</div>
        ${qlOpen !== null
          ? qlOpenCardHtml(qlQuestion, qlImage, iMine)
          : `<p class="text-muted mt-3"><i class="bi bi-hand-index"></i> Elige una caja</p>`}
      </div>
    `);

    on(rootSel, 'click', '.ql-sbox:not([disabled])', (_, btn) => qlOpenQuestion(+btn.dataset.idx));
  }

  function paintQuestionLiveWheel() {
    const qlOpen     = session.ql_open ?? null;
    const qlQuestion = session.ql_question ?? null;
    const qlPoints   = session.ql_points || {};
    const qlBy       = session.ql_by ?? null;
    const allItems   = sessionItems(activity);
    const qlImage    = qlOpen !== null ? (visibleItem(activity, qlOpen)?.image ?? null) : null;
    const iMine      = qlBy === player.playerId;

    // A question is open → show the question card, no wheel.
    if (qlOpen !== null) {
      mount(rootSel, html`<div class="text-center py-3">${qlOpenCardHtml(qlQuestion, qlImage, iMine)}</div>`);
      return;
    }

    // Available = questions not yet scored. Wheel slices are their numbers.
    const available = allItems.map((_, i) => i).filter(i => qlPoints[i] == null);
    if (available.length === 0) {
      mount(rootSel, html`
        <div class="text-center py-5">
          <i class="bi bi-check2-all display-1 text-success"></i>
          <h3 class="mt-3">¡Todas respondidas!</h3>
          <p class="text-muted">Espera a que el profesor termine.</p>
        </div>`);
      return;
    }

    const entries = available.map(i => String(i + 1));
    mount(rootSel, html`
      <div class="text-center py-3">
        <div class="ql-wheel d-inline-block" style="position:relative">
          ${wheelSvg(entries, { rotation: qlRotation, dur: 0, spinning: false, size: 300 })}
          <div style="position:absolute;top:50%;left:-14px;transform:translateY(-50%);font-size:30px;color:#e53935;line-height:1">▶</div>
        </div>
        <div class="mt-3">
          <button class="btn btn-warning btn-lg px-5" id="ql-spin"><i class="bi bi-arrow-repeat"></i> Girar</button>
        </div>
        <p class="text-muted small mt-2">Gira la rueda y responde la pregunta que te toque.</p>
      </div>
    `);

    on(rootSel, 'click', '#ql-spin', () => qlSpin(available, entries.length));
  }

  function qlSpin(available, count) {
    if (qlSpinning || count === 0) return;
    qlSpinning = true;
    const dur = SPIN_DUR_PICK;
    const target = pickIndex(count);
    const realIdx = available[target];
    qlRotation = spinTarget(qlRotation, count, target);

    const btn = rootEl()?.querySelector('#ql-spin');
    if (btn) btn.disabled = true;
    animateSpin(rootEl()?.querySelector('.ql-wheel svg'), qlRotation, dur);

    // ctx.setTimeout: si el alumno abandona la vista mientras gira la ruleta, este
    // callback ESCRIBE en el servidor (qlOpenQuestion → setSessionState). Con
    // setTimeout desnudo disparaba tras navegar; ctx lo cancela en disposeAll.
    ctx.setTimeout(async () => {
      qlSpinning = false;
      qlRotation = normalizeRotation(qlRotation);
      // Someone may have opened a question while we spun — bail and repaint.
      if (session.ql_open !== null) { lastPhaseKey = ''; paint(); return; }
      await qlOpenQuestion(realIdx);
    }, dur);
  }

  async function paintQuestion() {
    const idx = session.current_item;
    const items = sessionItems(activity);
    const item = items[idx];
    const own = await getOwnAnswer(session.id, player.playerId, idx);
    if (own) return paintWaiting('Respuesta enviada. Espera al resto.');
    emitGame(GameEvents.QUESTION_SHOWN, { idx, total: items.length, item });
    const streak = Streaks.get(session.id, player.playerId);
    // R-1 · LECTURA (§26 ficha 1b): hasta el instante que manda la SALA, la
    // pregunta se ve pero no se puede tocar. El instante es del servidor, no un
    // temporizador de este móvil: quien entra tarde o recarga no gana tiempo, y
    // el reloj de respuesta (y con él el bonus de velocidad) empieza igual para
    // todos — antes ganaba quien clicaba antes de leer.
    const openAtMs = session.answers_open_at ? new Date(session.answers_open_at).getTime() : 0;
    const deadlineMs = session.deadline ? new Date(session.deadline).getTime() : 0;
    // §22-5 · LA PUERTA, con hora común Y con tope (core/liveGate.js): un móvil
    // desfasado ya no puede quedarse encerrado en «Preparados…» mientras la
    // pregunta se liquida sin su respuesta. La espera nunca supera la ventana
    // de lectura declarada por la actividad, y si la pregunta ya cerró no se
    // hace leer a nadie.
    // Ya esperé MI ventana de lectura de esta pregunta: no se vuelve a esperar.
    // Sin esto, un reloj muy desfasado repetiría la espera acotada una y otra
    // vez (el instante de la sala sigue "en el futuro" para este aparato) y el
    // alumno no llegaría a responder nunca — que es el fallo que veníamos a
    // arreglar, disfrazado de cuentas atrás cortas.
    const readMs = lecturaHechaEn === idx ? 0 : readWindowMs(activity);
    const { reading, waitMs } = questionGate({
      openAtMs, deadlineMs, now: serverNow(), readMs,
    });
    // El ms se mide desde la apertura REAL de respuestas (no desde que este
    // móvil pintó): misma referencia que el sello del servidor (§22-1).
    lastQuestionShownAt = openAtMs || serverNow();
    // MISMA ventana que el host y que el bonus de velocidad (core/timings.js):
    // antes cada uno tenía su copia y award.js omitía el piso de 5 → el reloj del
    // alumno podía no coincidir con el deadline real del servidor.
    // La barra mide la ventana REAL de esta pregunta: la distancia entre los dos
    // instantes de la sala. Con tiempo por pregunta (R-3) leer la ventana de la
    // actividad daría una barra que no cuadra con el reloj — y además así el
    // alumno no necesita que los segundos viajen en el snapshot (§22-2).
    const total = (deadlineMs && openAtMs && deadlineMs > openAtMs)
      ? deadlineMs - openAtMs
      : questionWindowMs(activity);
    // The DEVICE renders the round via the template contract (same as VS),
    // so every template — quiz, tildes, comas, math… — works without a
    // per-template branch here. The host's projector shows the prompt.
    const tpl = getTemplate(activity.template);
    const payload = roundPayloadOf(tpl, activity, idx, item);
    mount(rootSel, html`
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-info text-dark">Pregunta ${idx+1} / ${items.length}</span>
        ${streak >= 2 ? `<span class="badge bg-warning text-dark fs-5">🔥 ${streak}</span>` : ''}
        <span id="s-time" class="badge bg-warning text-dark fs-5"></span>
      </div>
      <div class="progress mb-3" style="height:6px"><div id="s-bar" class="progress-bar bg-warning" style="width:100%"></div></div>
      <div id="s-round"></div>
    `);
    if (reading) {
      // Se pinta la ronda para poder LEERLA, con la interacción bloqueada y la
      // cuenta atrás; al llegar el instante se repinta ya jugable (guard de
      // fase: si el profe avanzó mientras tanto, no se pisa la pantalla nueva).
      const el = document.getElementById('s-round');
      el.classList.add('s-reading');
      try { tpl.renderRound(el, payload, { mode: 'live', onSubmit: () => {} }); } catch { /* payload raro: la cuenta atrás sigue */ }
      const badge = document.getElementById('s-time');
      // El objetivo se fija UNA vez con el reloj de este móvil a partir de la
      // espera ya acotada: así la cuenta atrás siempre llega a 0, aunque el
      // instante de la sala fuera absurdo.
      const abreEn = clock.now() + waitMs;
      const tick = ctx.setInterval(() => {
        const left = Math.ceil((abreEn - clock.now()) / 1000);
        if (badge) badge.textContent = `Preparados… ${Math.max(0, left)}`;
        if (left <= 0) {
          clearInterval(tick);
          lecturaHechaEn = idx;
          if (session.phase === 'question' && session.current_item === idx) paintQuestion();
        }
      }, 200);
      return;
    }
    let sent = false;
    const handle = tpl.renderRound(document.getElementById('s-round'), payload, {
      mode: 'live',
      onSubmit: async (value) => {
        if (sent) return;
        sent = true;
        const ms = serverNow() - lastQuestionShownAt;
        const p = queuedSubmit(session.id, player.playerId, idx, value, ms);
        rescuedSubmit = p;   // paintRevealOwn puede esperar este POST si hizo falta rescatar
        const r = await p;
        emitGame(GameEvents.PLAYER_ANSWERED, { idx });
        // Solo pintar "esperando" si SEGUIMOS en la pregunta: cuando este submit
        // es el rescate de autoFlushQuestion, la fase ya cambió y paint() ya montó
        // el reveal/podio — pintarle "¡Respuesta enviada!" encima lo pisaba.
        if (session.phase === 'question') {
          // `rejected` = el servidor dijo NO (credencial del dispositivo perdida,
          // §22-4). Reintentar no sirve: hay que volver a entrar a la sala. Se
          // dice, en vez de mostrar un "se enviará al reconectar" que no pasará.
          if (r.rejected) {
            sent = false;   // que pueda reintentar tras volver a entrar
            paintWaiting('El servidor no aceptó tu respuesta. Vuelve a entrar a la sala con el PIN.');
          } else {
            paintWaiting(r.queued ? 'Respuesta guardada (sin red). Se enviará al reconectar.' : '¡Respuesta enviada!');
          }
        }
      }
    });
    // Rescate del trazo en curso: si el profe avanza antes de que el alumno pulse
    // "Listo", la plantilla entrega lo dibujado vía el handle `{ flush }` de su
    // renderRound (capacidad del CONTRATO — Tildes/Comas la implementan; quiz no
    // devuelve handle → no-op). Nada de querySelector a clases internas.
    autoFlushQuestion = () => {
      if (sent || !handle?.flush) return;
      rescuedIdx = idx;
      handle.flush();
    };

    // Cronómetro compartido (core/deadlineTicker.js): mismo reloj que el host,
    // con clock.now() y auto-parada cuando la fase cambia — antes era un
    // setInterval propio con clock.now() y limpieza a mano.
    questionTicker?.stop();
    questionTicker = startDeadlineTicker({
      deadline: deadlineMs, totalMs: total,
      while: () => session.phase === 'question',
      setIntervalFn: ctx.setInterval,
      onTick: ({ remainSec, pct }) => {
        const t = document.getElementById('s-time');
        const b = document.getElementById('s-bar');
        if (t) t.textContent = `${remainSec}s`;
        if (b) b.style.width = pct + '%';
      },
    });
  }

  async function paintRevealOwn() {
    const idx = session.current_item;
    let own = await getOwnAnswer(session.id, player.playerId, idx);
    // Si acabamos de RESCATAR el trazo de este ítem (autoFlushQuestion), su POST
    // puede seguir en vuelo mientras este GET ya respondió null → saldría "Sin
    // respuesta" al alumno que sí respondió (y lastPhaseKey no repinta). En vez
    // de un sleep a ciegas, esperamos la promesa REAL del submit y re-leemos.
    if (!own && rescuedIdx === idx && rescuedSubmit) {
      try { await rescuedSubmit; } catch { /* la cola offline ya lo tiene */ }
      rescuedIdx = -1; rescuedSubmit = null;
      if (session.current_item !== idx || session.phase !== 'reveal') return;
      own = await getOwnAnswer(session.id, player.playerId, idx);
    }
    const ok = own?.correct === true;
    const skipped = !own;
    // NO PUNTUABLE (deuda C): el ítem no tiene clave y los puntos los pone el
    // profe. Antes se pintaba "Incorrecto" a toda la clase por no haber respuesta
    // que comparar — decirle a un niño que falló cuando no había nada que acertar.
    const unscored = !!own && own.correct == null;
    // Bump streak ONCE per item. No per-question sounds or confetti in live
    // mode — celebration happens only at the end. Subsequent paints for the
    // same idx (caused by unrelated session UPDATEs) skip the side effects.
    if (own && !revealedItems.has(idx)) {
      revealedItems.add(idx);
      myScore += own.points || 0;
      // Un ítem no puntuable no rompe la racha (ni la sube): no hubo acierto ni
      // fallo que juzgar.
      if (!unscored) Streaks.bump(session.id, player.playerId, ok);
    }
    const streak = Streaks.get(session.id, player.playerId);
    // R-2 · TU PUESTO Y TU DISTANCIA (el motor de enganche de Kahoot): el
    // alumno veía "+80 puntos" y nada más — ni dónde está ni cuánto le falta.
    // Sale del leaderboard DERIVADO del servidor (misma fuente que el podio),
    // así que no puede discrepar de la pizarra. Fail-soft: si no llega, la
    // pantalla se pinta igual sin esa línea.
    let standing = null;
    try {
      // El cálculo vive en el DUEÑO del ranking (§21) y es puro, así que su test
      // comprueba números en vez de citar estas líneas.
      standing = standingOf(await leaderboard(session.id, 100), player.playerId);
    } catch { /* sin marcador: se pinta el resultado igual */ }
    const standingHtml = !standing ? '' : `
      <p class="h5 mt-3 mb-0">${standing.rank}º de ${standing.total} · ${standing.score} pts</p>
      ${standing.aboveName
        ? `<p class="text-muted">${standing.gap === 0
             ? `empatas con ${escapeHtml(standing.aboveName)}`
             : `a ${standing.gap} ${standing.gap === 1 ? 'punto' : 'puntos'} de ${escapeHtml(standing.aboveName)}`}</p>`
        : '<p class="text-muted">¡vas primero!</p>'}`;
    mount(rootSel, html`
      <div class="text-center py-5">
        ${skipped
          ? `<i class="bi bi-dash-circle display-1 text-secondary"></i><h2 class="mt-3">Sin respuesta</h2>`
          : unscored
            ? `<i class="bi bi-hand-thumbs-up display-1 text-info"></i><h2 class="mt-3">¡Respuesta enviada!</h2><p class="text-muted">La valora tu profe.</p>`
            : ok
              ? `<i class="bi bi-check-circle-fill display-1 text-success"></i><h2 class="mt-3">¡Correcto!</h2>`
              : `<i class="bi bi-x-circle-fill display-1 text-danger"></i><h2 class="mt-3">Incorrecto</h2>`}
        <p class="lead">+${own?.points || 0} puntos</p>
        ${ok && streak >= 2 ? `<p class="h4">🔥 Racha de ${streak}</p>` : ''}
        ${standingHtml}
      </div>
    `);
  }

  function paintRace() {
    const allItems = sessionItems(activity);
    const tpl = getTemplate(activity.template);

    // SIN CLAVE NO SE JUZGA (§22). En carrera el veredicto lo da este móvil, así
    // que necesita la actividad completa; la sala la sube al arrancar, pero
    // puede tardar en llegar (o fallar el PATCH). Sin este guard, `scoreSubmission`
    // sobre un ítem vacío devolvía `correct:false` SIEMPRE: la hoja perfecta
    // sonaba a error y volvía a la cola — la carrera no terminaba nunca. Antes
    // que castigar al alumno por un fallo nuestro, se espera.
    if (!hasClientKey(activity)) {
      mount(rootSel, html`
        <div class="text-center py-5">
          <div class="spinner-border text-warning"></div>
          <p class="mt-3">Preparando la carrera…</p>
        </div>`);
      refreshSession();
      return;
    }

    if (raceQueue === null) {
      // REANUDAR, no reiniciar (bug real de la primera partida): una recarga a
      // mitad de carrera (F5, el móvil descartando la página al bloquear, o la
      // auto-actualización de versión) perdía la cola en memoria y el alumno
      // repetía TODO. La cola se siembra desde sus propias filas del servidor:
      // lo ya acertado no vuelve; los fallados y los nuevos sí
      // (core/raceResume.js). Sin red/sin filas → carrera desde cero, como antes.
      if (!raceSeed) {
        raceSeed = listOwnAnswers(session.id, player.playerId)
          .catch(() => [])
          .then((rows) => {
            const s = raceResumeState(sessionItems(activity).length, rows);
            raceQueue = s.queue;
            raceCorrectCount = s.correctCount;
            raceFirstSent = s.firstSent;
            // ctx.setTimeout: si el alumno navegó (o el profe cerró) mientras la
            // siembra estaba en vuelo, no pintar sobre otra vista/fase.
            ctx.setTimeout(() => { if (session.phase === 'race') paintRace(); }, 0);
          });
      }
      mount(rootSel, html`<div class="text-center py-5"><div class="spinner-border text-warning"></div></div>`);
      return;
    }

    if (raceQueue.length === 0) {
      // C-1 · El que termina primero ya no mira un "esperando…" mudo: se le dice
      // QUÉ se espera, según la política declarada en la sala (core/liveEnd.js).
      // Con tiempo límite ve el mismo reloj que la pizarra (instante de la sala,
      // no un contador propio).
      const { policy, n, deadlineMs } = endPolicyOf(session);
      // El alumno no lee la lista de jugadores (§21): se le dice la REGLA, no un
      // número inventado. El conteo exacto lo ve el profe en la pizarra.
      const info = waitingInfo({ policy, n });
      // TU HORA DE META: es lo que decide la carrera (todos acaban con todas
      // bien), así que el alumno tiene que verla — si no, el orden del podio le
      // llega sin explicación. APROXIMADA a propósito: sale del reloj del móvil,
      // mientras que la que ORDENA la mide el servidor (§22). Puede bailar un
      // segundo; por eso se marca como "tu tiempo" y no como el oficial.
      const startMs = session.started_at ? Date.parse(session.started_at) : 0;
      const myFinish = startMs ? mmss(serverNow() - startMs, Math.floor) : null;
      mount(rootSel, html`
        <div class="text-center py-5">
          <i class="bi bi-trophy-fill display-1 text-warning"></i>
          <h2 class="mt-3">¡Terminaste!</h2>
          <p class="lead">${raceCorrectCount} / ${allItems.length} correctas${myFinish ? ` · <strong title="Tu tiempo (aprox.). La clasificación usa el reloj del servidor.">${myFinish}</strong>` : ''}</p>
          <p class="text-muted">${escapeHtml(info.text)}</p>
          ${info.showClock ? '<div class="h3" id="race-left">—</div>' : '<div class="spinner-border text-warning mt-2"></div>'}
        </div>
      `);
      if (info.showClock && deadlineMs) {
        // Primitivo compartido (§23): reloj hasta un instante del servidor, con
        // guard de fase para que no repinte encima del podio.
        startDeadlineTicker({
          deadline: deadlineMs, ctx,
          while: () => session.phase === 'race' && !!document.getElementById('race-left'),
          onTick: (leftMs) => {
            const el = document.getElementById('race-left');
            // `Math.ceil`: en una cuenta atrás, mostrar 0:00 con un segundo aún
            // por correr le dice al alumno que se acabó cuando no se ha acabado.
            if (el) el.textContent = mmss(leftMs, Math.ceil);
          },
        });
      }
      return;
    }

    const idx = raceQueue[0];
    const payload = roundPayloadOf(tpl, activity, idx, allItems[idx]);
    const streak = Streaks.get(session.id, player.playerId);
    lastQuestionShownAt = serverNow();
    const total = allItems.length;
    emitGame(GameEvents.QUESTION_SHOWN, { idx, total, item: allItems[idx] });

    mount(rootSel, html`
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-success fs-6"><i class="bi bi-check2-circle"></i> ${raceCorrectCount}/${total}</span>
        ${streak >= 2 ? `<span class="badge bg-warning text-dark fs-5">🔥 ${streak}</span>` : '<span></span>'}
        <span class="badge bg-info text-dark fs-6">${raceQueue.length} restantes</span>
      </div>
      <div class="progress mb-3" style="height:6px">
        <div class="progress-bar bg-success" style="width:${total > 0 ? Math.round(100*raceCorrectCount/total) : 0}%"></div>
      </div>
      <div id="s-round"></div>
    `);

    let sent = false;
    tpl.renderRound(document.getElementById('s-round'), payload, {
      mode: 'live',
      onSubmit: (value) => {
        if (sent) return;
        sent = true;
        const ms = serverNow() - lastQuestionShownAt;

        // Score locally (activity_snap contains full answers on PocketBase).
        let ok = false;
        let pts = 0;
        let faltan = null;   // detalle de lo que faltó, si la hoja vuelve a la cola
        try {
          // El modelo de puntos lo decide el BUCLE (core/liveLoops.js), igual que
          // el settle del servidor — si aquí se estimara distinto, el alumno
          // vería un puntaje que el podio luego desmiente.
          const r = tpl.scoreSubmission({ value, item: allItems[idx], msTaken: ms, activity, mode: pointsModeFor(session.loop || 'race') });
          // En CARRERA la vara es COMPLETA (§26 · `racePassed`): una hoja de
          // Tildes a medias VUELVE A LA COLA en vez de darse por superada — si
          // no, el podio ordena por hora de meta a gente que no hizo lo mismo.
          ok = racePassed(r);
          pts = ok ? (r.points || 0) : 0;
          faltan = ok ? null : r;
        } catch (err) {
          // No se pudo juzgar (ítem sin clave pese al guard, o scorer roto). NO
          // se puede decir "mal": se deja pasar sin puntos y se avisa. Un fallo
          // nuestro no puede costarle la carrera al alumno.
          console.warn('[studentLive] carrera: no se pudo puntuar en local —', err);
          ok = true; pts = 0;
        }

        // Color the selected button in-place — no DOM replacement, same as solo player.
        const roundEl = document.getElementById('s-round');
        if (roundEl) {
          const picked = [...roundEl.querySelectorAll('.rq-opt')].find(b => b.dataset.value === value)
                        || roundEl.querySelector('.rq-picked');
          if (picked) picked.classList.add(ok ? 'btn-success' : 'btn-danger');
        }

        // Advance queue and score.
        raceQueue.shift();
        if (!ok) raceQueue.push(idx);
        else { raceCorrectCount++; myScore += pts; }
        const newStreak = Streaks.bump(session.id, player.playerId, ok);

        // Sound events (correct/wrong chime).
        if (ok) emitGame(GameEvents.ANSWER_CORRECT, { idx, points: pts, streak: newStreak });
        else    emitGame(GameEvents.ANSWER_WRONG, { idx });

        // POR QUÉ vuelve a la cola. Sin esto, una hoja de Tildes a medias
        // reaparecía sin explicación y el alumno repetía el mismo error a
        // ciegas. El detalle sale del SCORER (aciertos · de más), no de una
        // cuenta propia de esta vista.
        if (!ok && faltan && Number.isFinite(faltan.total) && faltan.total > 1) {
          const sinMarcar = Math.max(0, faltan.total - (faltan.hits || 0));
          const partes = [];
          if (sinMarcar) partes.push(`${sinMarcar} sin marcar`);
          if (faltan.over) partes.push(`${faltan.over} de más`);
          if (partes.length) toast(`Casi: ${partes.join(' · ')}. Vuelve a intentarlo.`, 'warning', 2500);
        }

        // Analítica opción A: el PRIMER intento de cada ítem (bien o mal) se envía
        // SIEMPRE → captura v0/c0 (el error real) para el análisis de clase. Los
        // reintentos posteriores solo se envían si son CORRECTOS, para avanzar el
        // progreso del host. submitRaceAttempt no cambia el juego: preserva v0/c0
        // (inmutable) y solo mueve value/correct al acertar. Ver docs/historico/handoff-analitica-items.md.
        const firstForItem = !raceFirstSent.has(idx);
        if (firstForItem || ok) {
          raceFirstSent.add(idx);
          submitRaceAttempt(session.id, player.playerId, idx, value, ok, pts, ms).catch(() => {});
        }

        // Brief pause to see the color flash, then load next question. Guardia:
        // si el profesor terminó la carrera en esa ventana (p.ej. "Terminar
        // carrera"), `session.phase` ya no es 'race' — no repintar la carrera
        // sobre lo que paint() ya haya mostrado (resultado/podio); el próximo
        // evento real de sesión (subscribeRoom/poll) lo enruta correctamente.
        // (No se puede usar paint() aquí: cachea por `session.*` y el avance de
        // raceQueue es 100% local, así que repintaría la MISMA pregunta.)
        // ctx.setTimeout: paintRace hace mount(rootSel,…) sobre #app; con
        // setTimeout desnudo, si el alumno navega en esta ventana pisaba el #app
        // de otra vista. ctx lo cancela al desmontar.
        ctx.setTimeout(() => { if (session.phase === 'race') paintRace(); }, RACE_FLASH_MS);
      }
    });
  }

  function isLiveBoard() {
    try { return supportsLoop(getTemplate(activity.template), 'board'); } catch { return false; }
  }

  // LIVE "board" templates (Ball Sort): ONE shared board the student solves at
  // their own pace. Every move is broadcast (throttled) so the host sees the
  // board move-by-move; the final solve is sent immediately. Rides the 'race'
  // phase — lobby/podium are unchanged. The board is mounted once and kept
  // (paint() dedups identical phase keys, so host pings don't remount it).
  function paintLiveBoard() {
    const tpl = getTemplate(activity.template);
    const payload = roundPayloadOf(tpl, activity, 0);
    if (!payload?.board) return paintWaiting('Esperando…');
    emitGame(GameEvents.QUESTION_SHOWN, { idx: 0, total: 1, item: payload });

    mount(rootSel, html`
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-info text-dark"><i class="bi bi-droplet-half"></i> Ordena las pelotas</span>
        <span id="bs-status" class="badge bg-secondary">En juego…</span>
      </div>
      <div id="s-round"></div>
    `);

    let lastSent = 0, pendingSnap = null, flushHandle = null, solved = false;
    const SEND_EVERY = 600;   // ms — cap network writes to ~1.7/s per student
    const sendNow = (snap) => {
      lastSent = clock.now();
      pendingSnap = null;
      submitProgress(session.id, player.playerId, snap).catch(() => {});
    };
    const onProgress = (snap) => {
      if (solved) return;
      const now = clock.now();
      const wait = SEND_EVERY - (now - lastSent);
      if (wait <= 0) { sendNow(snap); return; }
      pendingSnap = snap;                       // coalesce: keep only the latest
      if (!flushHandle) {
        flushHandle = ctx.setTimeout(() => { flushHandle = null; if (pendingSnap && !solved) sendNow(pendingSnap); }, wait);
      }
    };

    tpl.renderRound(document.getElementById('s-round'), payload, {
      mode: 'live',
      onProgress,
      onSubmit: (res) => {
        solved = true;
        const finalSnap = {
          tubes: res.tubes,
          tubeCapacity: payload.board.tubeCapacity,
          colors: payload.board.colors,
          moveCount: res.moveCount, elapsedMs: res.elapsedMs, solved: true,
        };
        sendNow(finalSnap);
        emitGame(GameEvents.ANSWER_CORRECT, { idx: 0, points: 0 });
        const st = document.getElementById('bs-status');
        if (st) { st.className = 'badge bg-success'; st.textContent = '🏆 ¡Resuelto!'; }
        toast('¡Resuelto! Espera a que el profesor cierre la sala.', 'success', 4000);
      },
    });
  }

  function paintWaiting(msg) {
    mount(rootSel, html`
      <div class="text-center py-5">
        <div class="spinner-border text-warning mb-3"></div>
        <p class="lead">${escapeHtml(msg)}</p>
      </div>
    `);
  }

  async function paintEnded() {
    if (endingInProgress) return;
    endingInProgress = true;
    scene(false); // resultado = chrome → fondo neutro (Etapa 1)
    Streaks.reset(session.id, player.playerId);
    // La puntuación AUTORITATIVA es la del leaderboard del servidor. `myScore` es
    // solo una ESTIMACIÓN local de respaldo (acumulada en submit/reveal) para el
    // raro caso de que el servidor no responda al terminar — no se muestra durante
    // la partida, así que nunca hay un número local "en desacuerdo" a la vista.
    let finalScore = myScore;
    let rank = 0;
    try {
      const lb = await leaderboard(session.id);
      const meIdx = lb.findIndex(p => p.id === player.playerId);
      // Si el marcador del servidor trae un puntaje real, mándalo; si viene en 0
      // (no se consolidó en state.players), conservamos la estimación local myScore
      // para no mostrar "0 puntos" cuando el alumno sí acertó.
      if (meIdx >= 0) { rank = meIdx + 1; if (lb[meIdx].score) finalScore = lb[meIdx].score; }
    } catch (e) {
      console.warn('[studentLive] leaderboard final no disponible; usando estimación local:', e);
    }
    if (!endedFired) {
      endedFired = true;
      emitGame(GameEvents.PODIUM, { top: [{ name: player.name, score: finalScore }] });
    }
    const rankIcon = rank === 1 ? '🏆' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '<i class="bi bi-trophy-fill display-1 text-warning"></i>';
    const rankMsg  = rank === 1 ? '¡Ganaste!' : rank === 2 ? '¡Segundo lugar!' : rank === 3 ? '¡Tercer lugar!' : '¡Se acabó!';
    mount(rootSel, html`
      <div class="text-center py-5">
        <div class="display-1">${rankIcon}</div>
        <h2 class="mt-3">${rankMsg}</h2>
        ${rank === 1 ? '<p class="lead text-warning fw-bold">¡Eres el primero!</p>' : ''}
        <p class="lead">Tu puntuación: <b class="fs-2">${finalScore}</b> puntos</p>
        ${rank > 1 ? `<p class="text-muted">Posición ${rank} en el ranking</p>` : ''}
        <p class="text-muted small">Mira el ranking completo en la pantalla del profesor.</p>
        <a href="#/join" class="btn btn-warning btn-lg mt-2"><i class="bi bi-arrow-left"></i> Otra sala</a>
      </div>
    `);
  }

  paint();
}
