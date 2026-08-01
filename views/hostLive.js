// Host view for live mode. Drives the phase machine over sessions.phase.
import { clock } from '../core/clock.js';
import { startElapsedTicker } from '../core/deadlineTicker.js';
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { get, getRemote } from '../core/storage.js';
import { createRoom, findRoomByCode, fetchSession, fetchSessionBlob,
         startSession, setSessionState, endSession, settleItem,
         listPlayers, listAnswers, leaderboard, kickPlayer, subscribeRoom, pingHost, fetchSessionKey,
         realtimeKind }
       from '../core/liveTransport.js';
import { getTemplate } from '../core/registry.js';
import { sessionItems, roundPayloadOf } from '../kernel/session/engine.js';
import { rowsFromLiveAnswers, rowsFromLiveState } from '../core/answerRows.js';
import { itemStatsHtml } from './itemStatsView.js';
import { computeMedals } from '../core/itemStats.js';
import { sessionTableHtml, sessionTableCsv, buildSessionTable } from './sessionTable.js';
import { acquire } from '../core/lifecycle.js';
import { getAuthUserId } from '../core/auth.js';
import { openLoginModal } from './loginModal.js';
import { toast, confirmModal } from '../core/toast.js';
import { sceneToggle, resetScene } from '../core/presentation.js';
import { fullscreenButtonHtml, attachFullscreenButton } from '../core/fullscreen.js';
import { GameEvents, emitGame } from '../core/gameEvents.js';
import { hostPaintDecision } from '../core/livePhases.js';
import { isStudentSnapshot } from '../core/liveSnapshot.js';
import { podiumHtml } from '../core/podium.js';
import { QL_COLORS } from '../core/questionLive.js';
import { questionWindowMs, RACE_POLL_MS, BOARD_POLL_MS, readSeconds, READ_SECONDS_MAX, itemWindowMs } from '../core/timings.js';
import { loopsOf, supportsLoop, defaultLoop, LOOP_LABELS, hasAdvanceChoice } from '../core/liveLoops.js';
import { END_LABELS, END_POLICIES, DEFAULT_POLICY, DEFAULT_FIRST_N, DEFAULT_MINUTES, MAX_MINUTES, shouldEnd, endPolicyOf } from '../core/liveEnd.js';

const STUDENT_BASE = location.origin + location.pathname.replace(/teacher\.html.*/, 'student.html');

export async function renderHostLaunch(rootSel, activityId) {
  // Igual que el modo solo (playerView): primero local, y si no está, se trae de
  // la nube. Antes solo miraba local → una actividad que vive en PB pero no en el
  // navegador (otro dispositivo, caché limpiada) daba "Actividad no encontrada"
  // aunque en solo sí abría.
  let a = get(activityId);
  if (!a) {
    mount(rootSel, html`<div class="text-center py-5"><div class="spinner-border"></div><p class="mt-2">Cargando actividad…</p></div>`);
    a = await getRemote(activityId).catch(() => null);
  }
  if (!a) { mount(rootSel, html`<div class="alert alert-danger">Actividad no encontrada.</div>`); return; }
  if (!sessionItems(a).length) { mount(rootSel, html`<div class="alert alert-warning">La actividad no tiene preguntas.</div>`); return; }

  mount(rootSel, html`<div class="text-center py-5"><div class="spinner-border"></div><p class="mt-2">Creando sala…</p></div>`);
  try {
    const room = await createRoom(a);
    // Just navigate. The router will pick #/host/:code and call renderHostByCode.
    location.hash = `#/host/${room.code}`;
  } catch (e) {
    const needsSetup = /live_sessions/.test(e.message || '');
    // Con la fase de reglas live (§22) DIRIGIR una sala exige sesión de profe.
    // Si el 403 llega por eso, dilo con nombre y apellido: descubrirlo con la
    // clase delante es el peor momento posible.
    const needsLogin = !getAuthUserId() && (e?.status === 403 || e?.status === 400);
    mount(rootSel, html`
      <div class="container py-4" style="max-width:560px">
        <div class="alert alert-danger">
          <h5 class="alert-heading"><i class="bi bi-exclamation-octagon"></i> No se pudo crear la sala</h5>
          <p class="mb-2">${needsLogin
            ? 'Para dirigir una sala en vivo tienes que entrar con tu cuenta de profesor (el servidor ya no acepta salas anónimas).'
            : escapeHtml(e.message)}</p>
          ${needsLogin ? html`<button class="btn btn-primary btn-sm" id="hl-login"><i class="bi bi-box-arrow-in-right"></i> Entrar</button>` : ''}
          ${needsSetup ? html`
            <hr>
            <p class="mb-2 small">El servidor de Live necesita la colección <code>live_sessions</code> (solo se crea una vez).</p>
            <a href="#/admin" class="btn btn-warning btn-sm"><i class="bi bi-shield-lock"></i> Ir a Admin → Crear colecciones</a>
          ` : ''}
        </div>
        <a href="#/play/${escapeHtml(a.id)}" class="btn btn-outline-secondary btn-sm"><i class="bi bi-arrow-left"></i> Volver a la actividad</a>
      </div>`);
    on(rootSel, 'click', '#hl-login', () => openLoginModal());
  }
}

export async function renderHostByCode(rootSel, code) {
  const sess = await findRoomByCode(code);
  if (!sess) { mount(rootSel, html`<div class="alert alert-warning">Sala no encontrada.</div>`); return; }
  renderHost(rootSel, sess.code, sess.id, sess.activity_snap);
}

async function renderHost(rootSel, code, sessionId, activity) {
  const ctx = acquire('hostLive');
  // sessions.activity_snap is sanitized (no answers) so students can't read the
  // key. The host IS allowed to see answers (to show the correct one on reveal),
  // so swap in the full snapshot from session_keys when available. Falls back to
  // the (possibly full, for older/local sessions) snap we were handed.
  try { const full = await fetchSessionKey(sessionId); if (full) activity = full; } catch { /* keep fallback */ }
  // §22-2 — si aquí seguimos con el snapshot SANEADO, el host no tiene la clave:
  // no podría enunciar ni puntuar. Pasa si `live_keys` no está creada o si la
  // sesión de profe caducó. Se dice AHORA, no al revelar la primera respuesta.
  if (isStudentSnapshot(activity)) {
    toast('No se pudo leer el contenido de la sala (¿sesión caducada o falta la colección live_keys?). '
      + 'Entra de nuevo o crea las colecciones en Admin.', 'warning', 8000);
  }
  // Which Live backend is really in use. If it fell back to 'local' (e.g. the
  // PocketBase live_sessions collection doesn't exist), the room only works on
  // THIS device — warn the teacher in the lobby so it's not a silent failure.
  let driverKind = 'unknown';
  try { driverKind = await realtimeKind(); } catch { /* keep unknown */ }

  // Escena POR FASE (docs/handoff-player-frame.md, Etapa 1): el fondo/skin de la
  // actividad se aplica SOLO en las pantallas de JUEGO; lobby y podio (chrome) van
  // con el fondo neutro de la app. El enrutador paint() decide por rama.
  const scene = sceneToggle(activity);
  ctx.add(() => resetScene());
  // Stage class for big-screen typography.
  // `ww-livestage` (NO `ww-stage`): activa las fuentes grandes de proyector
  // (touch.css) SIN heredar la región de andamio `.ww-stage` (scaffold.css), que
  // en el <body> centraba y encogía la barra superior. Ver styles/touch.css.
  document.body.classList.add('ww-livestage');
  ctx.add(() => document.body.classList.remove('ww-livestage'));

  const tpl = getTemplate(activity.template);
  // Template-agnostic item list (quiz→items, tildes/comas→passages, …).
  const items = sessionItems(activity);
  const live = activity.live || {};
  const timerSec = questionWindowMs(activity) / 1000;   // ventana única (core/timings.js)
  const advanceMode = live.advanceMode || 'manual';
  // LIVE "board" templates (Ball Sort): a single shared board everyone solves at
  // their own pace while the host watches each board live. Always runs as a race.
  // §26 — los bucles salen de lo que la plantilla DECLARA (core/liveLoops.js),
  // no de mirar su nombre ni de un <select> fijo (ley §0).
  const loops = loopsOf(tpl);
  const isBoard = supportsLoop(tpl, 'board');
  let loop = defaultLoop(tpl) || 'rounds';       // bucle elegido en el lobby
  let autoAdvance = advanceMode !== 'manual';    // "avanzar solo" (dentro de rondas)
  let readSecs = readSeconds(activity);          // ventana de LECTURA (R-1)
  let prevRanks = null;                          // puestos de la ronda anterior (R-4)
  // POLÍTICA DE FIN de carrera/tablero (C-1, core/liveEnd.js): sin ella la
  // partida no acaba nunca sola y la clase se queda en el limbo.
  let endPolicy = DEFAULT_POLICY;
  let endN = DEFAULT_FIRST_N;
  let endMinutes = DEFAULT_MINUTES;
  let autoEnding = false;                        // el cierre automático dispara UNA vez
  let session = await fetchSession(sessionId);
  let players = await listPlayers(sessionId);
  let answers = [];
  let tickHandle = null;
  let settling = false;
  let paused = false;
  let pauseRemainMs = 0;
  let lastPhaseKey = '';
  // Once we're leaving (cancel/navigation), ignore late realtime echoes so the
  // 'ended' status change from our own endSession() can't paint a stray podium.
  let disposed = false;
  ctx.add(() => { disposed = true; });

  // Host heartbeat every 10s so cleanup_zombie_sessions doesn't reap us.
  pingHost(sessionId).catch(() => {});
  ctx.setInterval(() => pingHost(sessionId).catch(() => {}), 10000);

  async function onChange(ev) {
    if (disposed) return;
    // Some backends deliver a full row diff (Supabase postgres_changes); the
    // local driver sends only { table } as a "something changed" ping. When the
    // payload is missing, re-fetch the affected list so both backends work.
    const hasPayload = ev.new || ev.old;
    if (ev.table === 'sessions') {
      session = ev.new ? { ...session, ...ev.new } : { ...session, ...(await fetchSession(sessionId)) };
      paint();
    }
    else if (ev.table === 'players') {
      if (!hasPayload) players = await listPlayers(sessionId);
      else if (ev.eventType === 'DELETE') players = players.filter(p => p.id !== ev.old.id);
      else if (ev.eventType === 'INSERT') players = [...players, ev.new];
      else players = players.map(p => p.id === ev.new.id ? ev.new : p);
      paint();
    }
    else if (ev.table === 'answers') {
      if (session.phase === 'race') {
        if (isBoard) paintLiveBoardHost(false); // grid of live mini-boards
        else paintRace(false); // race view loads its own answer data
      } else {
        if (!hasPayload) answers = await listAnswers(sessionId, session.current_item);
        else if (ev.eventType === 'INSERT') answers = [...answers, ev.new];
        else if (ev.eventType === 'UPDATE') answers = answers.map(a => a.id === ev.new.id ? ev.new : a);
        if (session.phase !== 'question') paint();
      }
    }
  }
  ctx.add(await subscribeRoom(sessionId, onChange));

  // C-1 · ¿toca cerrar sola la partida? (core/liveEnd.js) La MISMA comprobación
  // para carrera y tablero: cambia solo qué cuenta como "terminado". Dispara una
  // vez (`autoEnding`) y el profe conserva su botón de cortar antes.
  async function maybeAutoEnd(finished) {
    if (autoEnding || session.status === 'ended') return false;
    const { policy, n, deadlineMs } = endPolicyOf(session);
    if (!shouldEnd({ policy, n, deadlineMs, now: clock.now(), players: players.length, finished })) return false;
    autoEnding = true;
    try { await endSession(sessionId); } catch (e) { autoEnding = false; console.warn('[hostLive] cierre automático:', e); }
    return true;
  }

  // R-1 · ABRIR UNA PREGUNTA = un solo PATCH con los DOS instantes: cuándo se
  // pueden tocar las respuestas y cuándo cierra. El ritmo se escribe en la SALA
  // (§26 ficha 1b): un temporizador local se desincroniza entre móviles, no
  // sobrevive a recargar ni a entrar tarde, y no es verificable en el servidor.
  function openQuestion(idx) {
    const now = clock.now();
    const openAt = now + readSecs * 1000;
    // R-3 · cada pregunta puede tener SU tiempo; si no lo declara, hereda el de
    // la actividad. Como el cierre viaja como INSTANTE, el alumno no necesita
    // saber los segundos: lee el mismo reloj sea cual sea la ventana.
    const windowMs = itemWindowMs(activity, items[idx]);
    return setSessionState(sessionId, {
      status: 'running', phase: 'question', current_item: idx,
      answers_open_at: new Date(openAt).toISOString(),
      deadline: new Date(openAt + windowMs).toISOString(),
    });
  }

  function joinUrl() { return `${STUDENT_BASE}#/play/${code}`; }
  function qrUrl() { return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(joinUrl())}`; }

  function paint() {
    if (disposed) return;
    // question-live bypasses the skip logic: ql_open changes must always repaint.
    if (session.phase === 'question-live') { scene(true); return paintQuestionLive(); }
    // Always re-render when data changes (e.g. a player joins the lobby), but
    // only re-fire phase sounds/effects when the visible phase actually changes
    // (phaseChanged). `skip` protects an active question from being reset by
    // heartbeats/answers. Decision logic is pure + tested in core/livePhases.js.
    const { key, phaseChanged, skip } = hostPaintDecision(lastPhaseKey, session);
    if (skip) return;
    lastPhaseKey = key;
    if (session.status === 'lobby') { scene(false); return paintLobby(phaseChanged); }
    if (session.status === 'ended') { scene(false); return paintPodium(phaseChanged); }
    scene(true); // el resto son pantallas de JUEGO → fondo de la actividad
    if (session.phase === 'race') return isBoard ? paintLiveBoardHost(phaseChanged) : paintRace(phaseChanged);
    if (session.phase === 'question') return paintQuestion(phaseChanged);
    if (session.phase === 'reveal') return paintReveal(phaseChanged);
    if (session.phase === 'leaderboard') return paintLeaderboard(phaseChanged);
    scene(false); paintLobby(phaseChanged);
  }

  // Dos preguntas ORDENADAS (§26 ficha 1b): primero "¿cómo juega la clase?"
  // —construido desde los bucles que la PLANTILLA declara, no desde un <select>
  // fijo— y solo entonces los ajustes de ese bucle. Antes eran tres opciones al
  // mismo nivel ("manual · automático · carrera") que mezclaban qué juego con
  // quién avanza, y por eso la carrera se ofrecía hasta donde no tenía sentido.
  function lobbySetupHtml() {
    if (loops.length === 0) return '<div class="mt-4"></div>';
    const chooser = loops.length > 1 ? `
      <div class="mb-3">
        <div class="ll-label small mb-1">¿Cómo juega la clase?</div>
        <div class="btn-group" role="group">
          ${loops.map(l => `<button type="button" class="btn btn-sm ll-pick loop-pick${l === loop ? ' is-on' : ''}" data-loop="${l}">${escapeHtml(LOOP_LABELS[l].label)}</button>`).join('')}
        </div>
        <div class="ll-hint small mt-1">${escapeHtml(LOOP_LABELS[loop]?.hint || '')}</div>
      </div>` : `<div class="ll-hint small mb-3">${escapeHtml(LOOP_LABELS[loop]?.hint || '')}</div>`;
    const rounds = hasAdvanceChoice(loop) ? `
      <div class="d-flex gap-4 justify-content-center flex-wrap align-items-end">
        <div>
          <div class="ll-label small mb-1">Avanzar de pregunta</div>
          <div class="btn-group btn-group-sm" role="group">
            <button type="button" class="btn ll-pick adv-pick${!autoAdvance ? ' is-on' : ''}" data-auto="0">Yo controlo</button>
            <button type="button" class="btn ll-pick adv-pick${autoAdvance ? ' is-on' : ''}" data-auto="1">Solo</button>
          </div>
        </div>
        <div>
          <label class="ll-label small mb-1 d-block" for="read-secs">Tiempo de lectura</label>
          <div class="input-group input-group-sm" style="max-width:130px">
            <input id="read-secs" type="number" class="form-control" min="0" max="${READ_SECONDS_MAX}" value="${readSecs}">
            <span class="input-group-text">s</span>
          </div>
        </div>
      </div>
      <div class="ll-hint small mt-1">Segundos para LEER antes de poder responder. 0 = responder al instante.</div>` : '';
    return `<div class="text-center mt-4 mb-2">${chooser}${rounds}</div>`;
  }

  function paintLobby(phaseChanged = true) {
    if (phaseChanged) emitGame(GameEvents.LOBBY_START, { sessionId });
    const isQL = supportsLoop(tpl, 'claim');
    const now = clock.now();
    mount(rootSel, html`
      <div class="text-center py-3">
        <div class="d-flex justify-content-end mb-2">${fullscreenButtonHtml()}</div>
        ${driverKind === 'local' ? html`
          <div class="alert alert-warning d-flex align-items-start gap-2 text-start mx-auto mb-3" style="max-width:560px">
            <i class="bi bi-exclamation-triangle-fill fs-4"></i>
            <div>
              <b>Modo local: sin servidor de Live</b><br>
              Esta sala solo funciona en <b>este mismo navegador</b>. Los alumnos en
              otros dispositivos o redes (datos móviles) <b>no podrán entrar</b>.
              Falta crear la colección <code>live_sessions</code> en el servidor.
            </div>
          </div>` : ''}
        <h5 class="text-muted mb-1">Únete en</h5>
        <div class="h3"><b>${escapeHtml(STUDENT_BASE.replace(/^https?:\/\//,''))}</b></div>
        <h5 class="text-muted mt-3 mb-1">PIN</h5>
        <div class="ww-pin">${escapeHtml(code)}</div>
        <img src="${qrUrl()}" alt="QR" class="my-3" style="max-width:240px">
        <div>
          <span class="badge bg-info text-dark fs-5"><i class="bi bi-people-fill"></i> ${players.length} jugadores</span>
        </div>
        <div class="row mt-4 g-2 ww-host-players">
          ${players.map(p => {
            const seen = p.last_seen ? (now - new Date(p.last_seen).getTime()) : Infinity;
            const online = seen < 30000;
            const dot = online ? '<span class="text-success">●</span>' : '<span class="text-muted">○</span>';
            return `
            <div class="col-md-3 col-6">
              <div class="card"><div class="card-body py-2 d-flex justify-content-between align-items-center">
                <span>${dot} ${escapeHtml(p.name)}</span>
                <button class="btn btn-sm btn-outline-danger kick" data-id="${p.id}" title="Expulsar"><i class="bi bi-x"></i></button>
              </div></div>
            </div>`;
          }).join('')}
        </div>
        ${lobbySetupHtml()}
        <button class="btn btn-success btn-lg px-5" id="btn-start" ${players.length===0?'disabled':''}>
          <i class="bi bi-play-fill"></i> Empezar
        </button>
        <button class="btn btn-link text-muted ms-2" id="btn-cancel">Cancelar sala</button>
      </div>
    `);
    attachFullscreenButton(rootSel);
    on(rootSel, 'click', '.loop-pick', (_, b) => { loop = b.dataset.loop; paintLobby(false); });
    on(rootSel, 'click', '.adv-pick', (_, b) => { autoAdvance = b.dataset.auto === '1'; paintLobby(false); });
    on(rootSel, 'click', '.end-pick', (_, b) => { endPolicy = b.dataset.end; paintLobby(false); });
    const nEl = document.getElementById('end-n');
    if (nEl) nEl.onchange = (e) => { endN = Math.max(1, Math.min(60, Math.round(+e.target.value || DEFAULT_FIRST_N))); };
    const minEl = document.getElementById('end-min');
    if (minEl) minEl.onchange = (e) => { endMinutes = Math.max(1, Math.min(MAX_MINUTES, Math.round(+e.target.value || DEFAULT_MINUTES))); };
    const readEl = document.getElementById('read-secs');
    if (readEl) readEl.onchange = (e) => { readSecs = Math.max(0, Math.min(READ_SECONDS_MAX, Math.round(+e.target.value || 0))); };
    on(rootSel, 'click', '#btn-start', async () => {
      const startedAt = new Date(clock.now()).toISOString();
      if (loop === 'claim') {
        await setSessionState(sessionId, { status: 'running', phase: 'question-live', current_item: 0, started_at: startedAt });
      } else if (loop === 'race' || loop === 'board') {
        // El "tiempo límite" viaja como INSTANTE en la sala (§26 ficha 1b), no
        // como un contador del host: así el alumno ve el mismo reloj y sobrevive
        // a que el profe recargue.
        const deadline = endPolicy === 'time'
          ? new Date(clock.now() + endMinutes * 60_000).toISOString() : null;
        await setSessionState(sessionId, {
          status: 'running', phase: 'race', current_item: 0, started_at: startedAt,
          deadline, end_policy: endPolicy, end_n: endN,
        });
      } else {
        await setSessionState(sessionId, { started_at: startedAt });
        await openQuestion(0);
      }
    });
    on(rootSel, 'click', '#btn-cancel', async () => {
      const ok = await confirmModal('¿Cancelar sala?', { okText: 'Cancelar sala', danger: true });
      if (!ok) return;
      disposed = true; // stop reacting to the 'ended' echo before it can paint a podium
      // Best-effort: cancelar sala igual navega a casa aunque el PATCH falle.
      try { await endSession(sessionId); } catch (e) { console.warn('[hostLive] endSession al cancelar:', e); }
      location.hash = '#/home';
    });
    on(rootSel, 'click', '.kick', (_, b) => kickPlayer(sessionId, b.dataset.id));
  }

  async function paintQuestion(phaseChanged = true) {
    const idx = session.current_item;
    const item = items[idx];
    if (phaseChanged) {
      emitGame(GameEvents.LOBBY_END);
      emitGame(GameEvents.QUESTION_SHOWN, { idx, total: items.length, item });
    }
    answers = await listAnswers(sessionId, idx);
    const total = players.length;
    const answered = answers.length;
    const deadline = session.deadline ? new Date(session.deadline).getTime() : clock.now() + timerSec * 1000;
    let payload;
    try {
      payload = roundPayloadOf(tpl, activity, idx, item);
    } catch (err) {
      console.warn('[hostLive] getRoundPayload threw — falling back to item:', err);
      payload = item;
    }
    mount(rootSel, html`
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-secondary fs-6">Pregunta ${idx + 1} / ${items.length}</span>
        <span id="time-left" class="badge bg-warning text-dark fs-5"></span>
        <span class="badge bg-info text-dark fs-6"><i class="bi bi-check2-circle"></i> <span id="ans-count">${answered}</span> / ${total}</span>
      </div>
      <div class="progress mb-3" style="height:8px"><div id="time-bar" class="progress-bar bg-warning" style="width:100%"></div></div>
      <div id="host-round" class="mb-4"></div>
      <div class="text-center d-flex gap-2 justify-content-center flex-wrap">
        <button class="btn btn-warning btn-lg" id="btn-reveal"><i class="bi bi-stop-fill"></i> Bloquear y revelar</button>
        <button class="btn btn-outline-secondary btn-lg" id="btn-pause"><i class="bi ${paused?'bi-play-fill':'bi-pause-fill'}"></i> ${paused?'Reanudar':'Pausa'}</button>
        <button class="btn btn-outline-secondary btn-lg" id="btn-skip" title="Saltar pregunta sin puntuar"><i class="bi bi-skip-forward-fill"></i> Saltar</button>
        ${fullscreenButtonHtml()}
      </div>
    `);
    // R-1 · LECTURA: hasta `answers_open_at` la pizarra muestra el enunciado
    // pero NO las opciones (clase `.hl-reading`), y el badge dice "Preparados".
    // Al llegar el instante se quita la clase — el mismo instante que desbloquea
    // los móviles, así nadie responde antes de que se vea la pregunta.
    const openAtMs = session.answers_open_at ? new Date(session.answers_open_at).getTime() : 0;
    try {
      tpl.renderRoundHost(document.getElementById('host-round'), { phase: 'question', item, payload });
      const hr = document.getElementById('host-round');
      if (hr && openAtMs > clock.now()) {
        hr.classList.add('hl-reading');
        ctx.setTimeout(() => hr.classList.remove('hl-reading'), Math.max(0, openAtMs - clock.now()));
      }
    } catch (err) {
      console.error('[hostLive] renderRoundHost threw:', err);
      const el = document.getElementById('host-round');
      if (el) el.innerHTML = `<div class="alert alert-danger m-3">Error al mostrar pregunta ${idx + 1}: verifique el contenido de la actividad.</div>`;
    }
    attachFullscreenButton(rootSel);

    on(rootSel, 'click', '#btn-reveal', () => doSettle(idx));
    on(rootSel, 'click', '#btn-pause', async () => {
      if (paused) {
        // Resume: extend deadline by the pauseRemainMs we saved.
        const newDeadline = new Date(clock.now() + pauseRemainMs).toISOString();
        await setSessionState(sessionId, { deadline: newDeadline });
        paused = false;
      } else {
        pauseRemainMs = Math.max(0, deadline - clock.now());
        await setSessionState(sessionId, { deadline: null });
        paused = true;
      }
    });
    on(rootSel, 'click', '#btn-skip', async () => {
      const ok = await confirmModal('¿Saltar esta pregunta? Se cerrará sin puntuar.', { okText: 'Saltar', danger: false });
      if (!ok) return;
      const isLast = idx + 1 >= items.length;
      // Saltar abre la siguiente por el MISMO camino que el resto (openQuestion):
      // si no, esa pregunta se abriría sin ventana de lectura y con el reloj ya
      // corriendo — el hueco que cazó tests/roundsLoop.test.mjs.
      if (isLast) await endSession(sessionId);
      else await openQuestion(idx + 1);
    });

    if (tickHandle) clearInterval(tickHandle);
    let pollBusy = false, lastPoll = 0;
    tickHandle = ctx.setInterval(() => {
      if (session.phase !== 'question') { clearInterval(tickHandle); tickHandle = null; return; }
      // Poll the answer count (~every 1.2s). With answers in their own collection,
      // a student's submit no longer touches the session record, so the SSE that
      // drives `answers` doesn't fire — without this the count would freeze and
      // auto-advance-on-all-answered would never trigger. Harmless in blob mode
      // too (covers the occasional coalesced/missed SSE event).
      if (!pollBusy && clock.now() - lastPoll > 1200) {
        pollBusy = true; lastPoll = clock.now();
        listAnswers(sessionId, idx).then(a => { answers = a; }).catch(() => {}).finally(() => { pollBusy = false; });
      }
      // If host paused (deadline cleared server-side), freeze the bar.
      if (!session.deadline) {
        const t = document.getElementById('time-left');
        const ac = document.getElementById('ans-count');
        if (t) t.textContent = 'Pausa';
        if (ac) ac.textContent = String(answers.length);
        return;
      }
      // Durante la LECTURA el reloj de respuesta aún no corre: se muestra la
      // cuenta atrás de "preparados" y no se liquida por tiempo.
      const readLeft = openAtMs - clock.now();
      if (readLeft > 0) {
        const t0 = document.getElementById('time-left');
        if (t0) t0.textContent = `Preparados… ${Math.ceil(readLeft / 1000)}`;
        const b0 = document.getElementById('time-bar');
        if (b0) b0.style.width = '100%';
        return;
      }
      const liveDeadline = new Date(session.deadline).getTime();
      const remain = Math.max(0, liveDeadline - clock.now());
      const pct = Math.max(0, Math.min(100, 100 * remain / (timerSec * 1000)));
      const t = document.getElementById('time-left');
      const bar = document.getElementById('time-bar');
      const ac = document.getElementById('ans-count');
      if (t) t.textContent = `${Math.ceil(remain / 1000)}s`;
      if (bar) bar.style.width = pct + '%';
      if (ac) ac.textContent = String(answers.length);
      // Auto-advance triggers. P2-9: honrar la elección de "Automático" del lobby
      // (`autoAdvance`, runtime) además del `advanceMode` estático de la actividad;
      // antes elegir "Automático" no liquidaba al responder todos porque solo se
      // miraba `advanceMode`, que el <select> del lobby no cambia.
      const allAnswered = total > 0 && answers.length >= total;
      if (allAnswered && (autoAdvance || advanceMode === 'autoOnAllAnswered' || live.lockAnswersOn === 'allAnswered')) {
        return doSettle(idx);
      }
      if (remain <= 0 && (advanceMode === 'autoOnTimer' || advanceMode === 'autoOnAllAnswered' || advanceMode === 'manual')) {
        // Even in manual, expiring the timer settles to avoid stuck rooms.
        return doSettle(idx);
      }
    }, 250);
  }

  async function doSettle(idx) {
    if (settling || session.phase !== 'question') return;
    settling = true;
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
    const btn = document.getElementById('btn-reveal');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Calculando…'; }
    try { await settleItem(sessionId, idx); }
    catch (e) {
      toast('Error al revelar: ' + e.message, 'danger', 5000);
      if (btn) { btn.disabled = false; btn.innerHTML = 'Reintentar'; }
    } finally { settling = false; }
  }

  async function paintReveal(phaseChanged = true) {
    const idx = session.current_item;
    const item = items[idx];
    if (phaseChanged) emitGame(GameEvents.REVEAL, { idx, item });
    answers = await listAnswers(sessionId, idx);

    // Build name map: answer value → [playerName, …] for each option.
    const playerById = Object.fromEntries(players.map(p => [p.id, p.name]));
    const playerMap = {};
    answers.forEach(a => {
      const pid = a.playerId || a.player_id;
      const name = playerById[pid];
      if (name) {
        const val = String(a.value);
        (playerMap[val] = playerMap[val] || []).push(name);
      }
    });

    const isLast = idx + 1 >= items.length;
    mount(rootSel, html`
      <div id="host-round" class="mb-4"></div>
      <div class="text-center">
        <button class="btn btn-primary btn-lg" id="btn-lb">
          <i class="bi bi-bar-chart-fill"></i>
          <span id="btn-lb-txt">${isLast ? 'Ver clasificación final' : 'Ver clasificación'}</span>
        </button>
      </div>
    `);
    tpl.renderRoundHost(document.getElementById('host-round'), { phase: 'reveal', item, answers, playerMap });
    on(rootSel, 'click', '#btn-lb', () => setSessionState(sessionId, { phase: 'leaderboard' }));

    // Auto-advance countdown: tick down in the button text, then trigger leaderboard.
    if (autoAdvance && phaseChanged) {
      let secs = 4;
      const tick = ctx.setInterval(() => {
        if (session.phase !== 'reveal') { clearInterval(tick); return; }
        secs--;
        const t = document.getElementById('btn-lb-txt');
        if (t) t.textContent = isLast ? `Clasificación final (${secs}s)` : `Clasificación (${secs}s)`;
        if (secs <= 0) { clearInterval(tick); setSessionState(sessionId, { phase: 'leaderboard' }); }
      }, 1000);
    }
  }

  async function paintLeaderboard(phaseChanged = true) {
    const lb = await leaderboard(sessionId, 10);
    // R-4 · MOVIMIENTO: la tabla estática no cuenta nada; una flecha sí ("subió
    // dos"). Se compara con el orden de la ronda anterior, que se guarda aquí
    // mismo (nada que persistir: si el host recarga, simplemente no hay flechas
    // en la primera tabla que pinte).
    const move = (id) => {
      if (!prevRanks || !prevRanks.has(id)) return '';
      const before = prevRanks.get(id);
      const now = lb.findIndex(p => p.id === id) + 1;
      if (now < before) return `<span class="text-success" title="subió ${before - now}"><i class="bi bi-caret-up-fill"></i></span>`;
      if (now > before) return `<span class="text-danger" title="bajó ${now - before}"><i class="bi bi-caret-down-fill"></i></span>`;
      return '<span class="text-muted">·</span>';
    };
    const idx = session.current_item;
    const isLast = idx + 1 >= items.length;
    mount(rootSel, html`
      <h2 class="text-center mb-4"><i class="bi bi-bar-chart-fill"></i> Clasificación</h2>
      <div class="ww-leaderboard mx-auto" style="max-width:600px">
        ${lb.map((p, i) => `
          <div class="row align-items-center bg-dark text-light rounded mb-2 p-2">
            <div class="col-1"><b>${i+1}</b></div>
            <div class="col-1">${move(p.id)}</div>
            <div class="col-6">${escapeHtml(p.name)}</div>
            <div class="col-4 text-end"><b>${p.score}</b> pts</div>
          </div>`).join('')}
      </div>
      <div class="text-center mt-4">
        ${isLast
          ? `<button class="btn btn-warning btn-lg" id="btn-end"><i class="bi bi-trophy-fill"></i> Terminar y mostrar podio</button>`
          : `<button class="btn btn-primary btn-lg" id="btn-next"><i class="bi bi-arrow-right"></i> <span id="btn-next-txt">Siguiente pregunta</span></button>`}
      </div>
    `);
    prevRanks = new Map(lb.map((p, i) => [p.id, i + 1]));   // para las flechas de la próxima
    on(rootSel, 'click', '#btn-next', () => openQuestion(idx + 1));
    on(rootSel, 'click', '#btn-end', () => endSession(sessionId));

    // Auto-advance to next question after 5s (only between questions, not on the last).
    if (autoAdvance && !isLast && phaseChanged) {
      let secs = 5;
      const tick = ctx.setInterval(() => {
        if (session.phase !== 'leaderboard') { clearInterval(tick); return; }
        secs--;
        const t = document.getElementById('btn-next-txt');
        if (t) t.textContent = `Siguiente pregunta (${secs}s)`;
        if (secs <= 0) { clearInterval(tick); openQuestion(idx + 1); }
      }, 1000);
    }
  }

  async function loadRaceAnswers() {
    const all = await Promise.all(
      items.map((_, i) => listAnswers(sessionId, i).then(ans => ans.map(a => ({ ...a, itemIndex: i }))))
    );
    return all.flat();
  }

  // CARRERA: reloj + red de seguridad de refresco. Las DOS pantallas de carrera
  // (lista de progreso y tablero compartido) necesitan exactamente lo mismo —
  // cronómetro ascendente compartido (core/deadlineTicker.js, con clock.now() y
  // auto-parada al cambiar de fase) más un repintado de respaldo por si se pierde
  // un evento de realtime. Estaba copiado en las dos, con su literal cada una.
  function startRaceLoop(repaint, everyMs) {
    startElapsedTicker({
      since: session.started_at, setIntervalFn: ctx.setInterval,
      while: () => session.phase === 'race' && !!document.getElementById('race-timer'),
      onTick: ({ label }) => { const el = document.getElementById('race-timer'); if (el) el.textContent = label; },
    });
    const poll = ctx.setInterval(() => {
      if (session.phase !== 'race') { clearInterval(poll); return; }
      repaint(false);
    }, everyMs);
  }

  // Cómo va a terminar esto, en la pizarra: con tiempo límite el cronómetro es
  // DESCENDENTE (queda X) — el mismo instante que ve el alumno; sin él, se dice
  // la regla ("terminan todos" / "primeros N"), que es lo que la clase pregunta.
  function endBadge() {
    const { policy, n, deadlineMs } = endPolicyOf(session);
    if (policy === 'time' && deadlineMs) {
      const left = Math.max(0, deadlineMs - clock.now());
      const m = Math.floor(left / 60000), s2 = Math.floor((left % 60000) / 1000);
      return `queda ${m}:${String(s2).padStart(2, '0')}`;
    }
    if (policy === 'firstN') return `terminan los ${n} primeros`;
    return 'terminan todos';
  }

  async function paintRace(phaseChanged = true) {
    if (phaseChanged) emitGame(GameEvents.LOBBY_END);
    let allAnswers;
    try { allAnswers = await loadRaceAnswers(); } catch { allAnswers = []; }

    // Rank by CORRECT answers, not by how many were submitted. Counting any
    // submission let a student tapping fast through WRONG answers top the board
    // ("responde más → lo cuenta como buena"). Race answers are unsettled
    // (correct=null) during play, so score each here on the host (we hold the
    // answer key) — a settled row's verdict is trusted as-is.
    const prog = {};
    for (const p of players) prog[p.id] = { name: p.name, items: new Set() };
    for (const a of allAnswers) {
      const pid = a.playerId || a.player_id;
      if (!prog[pid]) continue;
      let ok = a.correct === true;
      if (a.correct == null) {
        try { ok = !!tpl.scoreSubmission({ value: a.value, item: items[a.itemIndex], activity, mode: 'race' }).correct; }
        catch { ok = false; }
      }
      if (ok) prog[pid].items.add(a.itemIndex);   // only correct items count as progress
    }
    // POLÍTICA DE EXPOSICIÓN (decisión, docs/estudio-bucles-live.md ficha 2 C-2):
    // durante el juego la pizarra muestra AVANCE, no RANKING. Antes esta lista
    // se ordenaba por aciertos, así que el que menos sabía aparecía el último,
    // con su nombre y su barra vacía, proyectado VARIOS MINUTOS — mucho más
    // tiempo del que dura una revelación. El orden es ahora estable (el de
    // entrada a la sala): cada alumno ve su barra crecer sin compararse en
    // público. La clasificación existe, pero en el PODIO, al final.
    const sorted = players.map(p => prog[p.id]).filter(Boolean);
    // ¿Se cumple la política de fin? (todos · primeros N · tiempo)
    if (await maybeAutoEnd(sorted.filter(p => p.items.size >= items.length).length)) return;
    const total = items.length;
    const elapsed = session.started_at ? Math.floor((clock.now() - new Date(session.started_at).getTime()) / 1000) : 0;
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;

    mount(rootSel, html`
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="mb-0"><i class="bi bi-flag-fill text-warning me-2"></i>Carrera libre
          <span class="badge bg-secondary ms-2">${escapeHtml(endBadge())}</span></h4>
        <span class="badge bg-secondary fs-6" id="race-timer">${mins}:${String(secs).padStart(2,'0')}</span>
        ${fullscreenButtonHtml()}
      </div>
      <div class="mb-4" style="max-width:700px;margin:0 auto">
        ${sorted.map((p) => {
          const n = p.items.size;
          const pct = total > 0 ? Math.round(100 * n / total) : 0;
          const done = n >= total;
          return `<div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="fw-bold text-light fs-5">${escapeHtml(p.name)}${done ? ' 🏆' : ''}</span>
              <span class="badge ${done?'bg-success':'bg-warning text-dark'} fs-6">${n}/${total}</span>
            </div>
            <div class="progress" style="height:20px">
              <div class="progress-bar ${done?'bg-success':'bg-warning text-dark'} fw-bold" style="width:${Math.max(pct,2)}%;transition:width .5s"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="text-center">
        <button class="btn btn-warning btn-lg" id="btn-end-race">
          <i class="bi bi-flag-fill"></i> Terminar carrera y ver podio
        </button>
      </div>
    `);
    attachFullscreenButton(rootSel);

    if (phaseChanged) startRaceLoop(paintRace, RACE_POLL_MS);

    on(rootSel, 'click', '#btn-end-race', async () => {
      const ok = await confirmModal('¿Terminar la carrera? Se calculará la clasificación final.', { okText: 'Terminar carrera' });
      if (!ok) return;
      const btn = document.getElementById('btn-end-race');
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Finalizando…'; }
      // endSession liquida TODO lo pendiente en una pasada (settlePending del
      // adaptador) antes de marcar 'ended' — ya no hace falta el bucle de
      // settleItem por ítem que hacía N viajes redundantes.
      await endSession(sessionId);
    });
  }

  // LIVE "board" dashboard (Ball Sort): a grid of every student's board updating
  // move-by-move. Reads progress rows from live_answers (item 0); each student
  // upserts their own row via submitProgress, so there's no clobber. Rides the
  // 'race' phase, so the lobby/start/podium are the standard ones.
  async function paintLiveBoardHost(phaseChanged = true) {
    if (phaseChanged) emitGame(GameEvents.LOBBY_END);
    const mode = activity.content?.mode || 'moves';
    const initialBoard = roundPayloadOf(tpl, activity, 0)?.board || null;

    let rows = [];
    try { rows = await listAnswers(sessionId, 0); } catch { rows = []; }
    const byPlayer = {};
    for (const r of rows) byPlayer[r.playerId || r.player_id] = r.value;

    // One cell per player; players with no move yet show the starting board.
    const cells = players.map(p => ({
      id: p.id, name: p.name,
      value: byPlayer[p.id] || (initialBoard ? { tubes: initialBoard.tubes, tubeCapacity: initialBoard.tubeCapacity, colors: initialBoard.colors, moveCount: 0, elapsedMs: 0, solved: false } : null),
    }));
    // MISMA política de exposición que la carrera (ficha 3 B-1): durante el
    // juego la rejilla NO se reordena por quién va ganando — cada tablero se
    // queda en su sitio y el alumno ve el suyo donde lo dejó. Reordenar en vivo
    // además hace saltar las celdas bajo el dedo del que está jugando. La
    // clasificación (resuelto → menos movimientos/tiempo) es cosa del PODIO.
    const solvedCount = cells.filter(c => c.value?.solved).length;
    if (await maybeAutoEnd(solvedCount)) return;
    const elapsed = session.started_at ? Math.floor((clock.now() - new Date(session.started_at).getTime()) / 1000) : 0;
    const mins = Math.floor(elapsed / 60), secs = elapsed % 60;

    mount(rootSel, html`
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="mb-0"><i class="bi bi-droplet-half text-info me-2"></i>Ordena las pelotas
          <span class="badge bg-success ms-2">${solvedCount}/${players.length} resueltos</span>
          <span class="badge bg-secondary ms-1">${escapeHtml(endBadge())}</span></h4>
        <span class="badge bg-secondary fs-6" id="race-timer">${mins}:${String(secs).padStart(2,'0')}</span>
        ${fullscreenButtonHtml()}
      </div>
      ${players.length === 0
        ? `<p class="text-center text-light">Esperando jugadores…</p>`
        : `<div class="bs-grid" id="bs-grid"></div>`}
      <div class="text-center mt-4">
        <button class="btn btn-warning btn-lg" id="btn-end-race">
          <i class="bi bi-flag-fill"></i> Terminar y ver podio
        </button>
      </div>
    `);
    attachFullscreenButton(rootSel);

    const grid = document.getElementById('bs-grid');
    if (grid && typeof tpl.renderRaceCell === 'function') {
      for (const c of cells) {
        const cellEl = document.createElement('div');
        cellEl.className = 'bs-grid-cell';
        grid.appendChild(cellEl);
        // Aísla el fallo de UNA celda para no romper la rejilla, pero lo registra
        // (un bug de renderRaceCell de la plantilla era invisible; antes: catch {}).
        try { tpl.renderRaceCell(cellEl, { value: c.value, name: c.name, mode }); }
        catch (e) { console.warn('[hostLive] renderRaceCell falló:', e); }
      }
    }

    if (phaseChanged) startRaceLoop(paintLiveBoardHost, BOARD_POLL_MS);

    on(rootSel, 'click', '#btn-end-race', async () => {
      const ok = await confirmModal('¿Terminar la partida? Se calculará la clasificación final.', { okText: 'Terminar' });
      if (!ok) return;
      const btn = document.getElementById('btn-end-race');
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Finalizando…'; }
      // endSession liquida el tablero pendiente (settlePending) antes de cerrar.
      await endSession(sessionId);
    });
  }


  // CL-1 · QUIÉN HA PARTICIPADO YA (aviso, no regla). El problema real de este
  // bucle es de reparto: el primero que toca se queda la caja, así que los
  // rápidos acaparan y el docente no tiene forma de ver a quién le falta. Esto
  // NO bloquea a nadie —sería una promesa que el cliente no puede garantizar—:
  // pone el dato delante para que el profe reparta con la vista. Los que aún no
  // han participado salen destacados, que es lo accionable.
  function participationHtml() {
    if (!players.length) return '';
    const taken = session.ql_taken || {};
    const count = {};
    for (const pid of Object.values(taken)) if (pid) count[pid] = (count[pid] || 0) + 1;
    const pending = players.filter(p => !count[p.id]);
    return `<div class="ql-participation mb-3">
      <div class="small text-light-emphasis mb-1">
        ${pending.length
          ? `<i class="bi bi-people-fill"></i> Aún no participan: <b>${pending.length}</b> de ${players.length}`
          : '<i class="bi bi-check2-all"></i> Todos han participado al menos una vez'}
      </div>
      <div class="d-flex flex-wrap gap-1 justify-content-center">
        ${players.map(p => {
          const n = count[p.id] || 0;
          return `<span class="badge ${n ? 'bg-secondary' : 'bg-warning text-dark'}">${escapeHtml(p.name)}${n > 1 ? ` ×${n}` : ''}</span>`;
        }).join('')}
      </div>
    </div>`;
  }

  async function paintQuestionLive() {
    const qlOpen     = session.ql_open ?? null;
    const qlQuestion = session.ql_question ?? null;
    // Image stored inline in the activity — read locally by index (not in session state).
    const qlImage    = qlOpen !== null ? (items[qlOpen]?.image || null) : null;
    const qlPoints   = session.ql_points || {};
    const qlBy       = session.ql_by ?? null;
    const qlByName   = session.ql_by_name ?? null;
    const doneCount  = Object.keys(qlPoints).length;
    const cols       = Math.min(6, Math.max(3, Math.ceil(items.length / 2)));
    const isWheel    = (activity.rules?.selector || 'boxes') === 'wheel';
    const viewTitle  = isWheel ? 'Ruleta Live' : 'Pregunta Live';
    const viewIcon   = isWheel ? 'bi-bullseye' : 'bi-chat-square-text-fill';

    const boxesHtml = items.map((_, idx) => {
      const isDone = qlPoints[idx] != null;
      const isOpen = qlOpen === idx;
      const color  = QL_COLORS[idx % QL_COLORS.length];
      let style, cls = 'ql-box';
      if (isDone)      { style = `background:#198754;border-color:#198754;`; }
      else if (isOpen) { style = `background:#fff;border-color:${color};`; cls += ' ql-open'; }
      else             { style = `background:${color};border-color:${color};`; }
      // Host board is status-only — students pick. Boxes are not interactive.
      return `<button class="${cls}" data-idx="${idx}" disabled style="${style};opacity:1">
        ${isDone
          ? `<span class="ql-num">+${qlPoints[idx]}</span>`
          : isOpen ? `<span class="ql-num" style="color:#1f2937">${idx + 1}</span>`
                   : `<span class="ql-num">${idx + 1}</span>`}
      </button>`;
    }).join('');

    mount(rootSel, html`
      <div class="py-3">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h4 class="mb-0 text-light"><i class="bi ${viewIcon} text-warning me-2"></i> ${escapeHtml(viewTitle)}</h4>
          <span class="badge bg-secondary fs-6">${doneCount} / ${items.length} respondidas</span>
          ${fullscreenButtonHtml()}
        </div>
        <div class="ql-grid mb-4" style="grid-template-columns:repeat(${cols},1fr)">${boxesHtml}</div>
        ${participationHtml()}
        ${qlOpen !== null ? `
          <div class="card bg-dark text-light p-4 mb-3 mx-auto" style="max-width:700px">
            <p class="text-warning fw-bold mb-2 fs-5"><i class="bi bi-hand-index-fill"></i> ${escapeHtml(qlByName || '—')} eligió esta caja</p>
            ${qlImage ? `<div class="text-center mb-3"><img src="${escapeHtml(qlImage)}" class="img-fluid rounded" style="max-height:240px"></div>` : ''}
            <h3 class="text-center mb-4">${escapeHtml(qlQuestion || '')}</h3>
            <div class="d-flex justify-content-center gap-3 flex-wrap">
              <button class="btn btn-outline-success btn-lg ql-award" data-pts="10">+10 pts</button>
              <button class="btn btn-success btn-lg ql-award" data-pts="50">+50 pts</button>
              <button class="btn btn-outline-secondary btn-lg" id="ql-close">
                <i class="bi bi-x-circle"></i> Sin puntos
              </button>
            </div>
          </div>` : `<p class="text-center text-muted">Los alumnos eligen una caja…</p>`}
        <div class="text-center mt-3">
          <button class="btn btn-danger btn-lg" id="ql-end">
            <i class="bi bi-stop-circle-fill"></i> Terminar y ver clasificación
          </button>
        </div>
      </div>
    `);
    attachFullscreenButton(rootSel);

    on(rootSel, 'click', '.ql-award', async (_, btn) => {
      if (!qlBy || qlOpen === null) return;
      const points    = +btn.dataset.pts;
      const newPoints = { ...qlPoints, [qlOpen]: points };
      // CL-1 · queda registrado quién se llevó la caja, para la tira de
      // participación (antes solo se sabía CUÁNTO valió, no QUIÉN respondió).
      const newTaken = { ...(session.ql_taken || {}), [qlOpen]: qlBy };
      await setSessionState(sessionId, {
        // `item`: sin la caja, el adaptador no puede escribir la fila de
        // live_answers y los puntos se quedarían solo en el blob (podio a 0).
        ql_award: { playerId: qlBy, points, item: qlOpen },
        ql_open: null, ql_question: null, ql_image: null, ql_by: null, ql_by_name: null,
        ql_points: newPoints, ql_taken: newTaken,
      });
    });

    // "Sin puntos" closes the box as if it was never opened — it stays available.
    on(rootSel, 'click', '#ql-close', async () => {
      await setSessionState(sessionId, { ql_open: null, ql_question: null, ql_image: null, ql_by: null, ql_by_name: null });
    });

    on(rootSel, 'click', '#ql-end', async () => {
      const ok = await confirmModal('¿Terminar la sesión?', { okText: 'Terminar' });
      if (!ok) return;
      await endSession(sessionId);
    });
  }

  // Junta TODAS las respuestas de la sesión (live_answers por ítem + respaldo del
  // blob state.answers), con el nombre del alumno resuelto. Fuente única para las
  // 3 pestañas del informe post-partida (A1) — se calcula una sola vez (cache).
  let _rowsCache = null;
  async function gatherSessionRows() {
    if (_rowsCache) return _rowsCache;
    // El blob PRIMERO: lleva el sello de apertura de cada ítem (§22-1), y sin él
    // la tabla mostraría el `ms` que afirmó el móvil mientras los puntos salen del
    // reloj del servidor — dos tiempos distintos para la misma respuesta.
    let blob = null;
    try { blob = await fetchSessionBlob(sessionId); } catch { /* respaldo best-effort */ }
    const msOpts = { itemOpenedAt: blob?.itemOpenedAt, phase: blob?.phase };
    const all = await Promise.all(items.map((_, i) => listAnswers(sessionId, i).then(a => rowsFromLiveAnswers(a, i, msOpts)).catch(() => [])));
    let rows = all.flat();
    try {
      const seen = new Set(rows.map(r => `${r.player} ${r.itemIndex}`));
      for (const r of rowsFromLiveState(blob || {})) if (!seen.has(`${r.player} ${r.itemIndex}`)) rows.push(r);
    } catch { /* respaldo best-effort */ }
    try {
      const ps = await listPlayers(sessionId);
      const nameOf = new Map((ps || []).map(p => [p.id, p.name]));
      rows = rows.map(r => ({ ...r, name: r.name || nameOf.get(r.player) || r.player }));
    } catch { /* si no hay nombres, se muestran ids */ }
    _rowsCache = rows;
    return rows;
  }

  const itemLabels = () => items.map((it, i) => { try { return tpl?.itemLabel?.(it) || `Pregunta ${i + 1}`; } catch { return `Pregunta ${i + 1}`; } });

  async function paintPodium(phaseChanged = true) {
    scene(false); // el podio es chrome → fondo neutro (Etapa 1)
    // Ya montado y sin cambio de fase → no re-montar: con la sala 'ended' cada
    // evento (pings de presencia cada 15 s, heartbeats) repintaba el podio
    // entero, re-puntuando la tabla y re-cableando listeners sin motivo.
    if (!phaseChanged && document.getElementById('ll-tabout')) return;
    // Ranking desde los PUNTOS REALES por respuesta (misma fuente que la Tabla →
    // podio y tabla SIEMPRE coinciden). Si no hay filas (colección vacía), cae al
    // marcador oficial de la sesión (state.players[].score).
    const rows = await gatherSessionRows().catch(() => []);
    let lb = buildSessionTable(rows, items.length, { items, template: tpl, activity }).players.map(p => ({ name: p.name, score: p.total, marks: p.marks, nCorrect: p.nCorrect }));
    if (!lb.length) { try { lb = await leaderboard(sessionId, 100); } catch { lb = []; } }
    if (phaseChanged) emitGame(GameEvents.PODIUM, { top: lb.slice(0, 3).map(p => ({ name: p.name, score: p.score })) });
    const isText = tpl?.meta?.contentModel === 'textCorrection';
    mount(rootSel, html`
      <h2 class="text-center mb-3"><i class="bi bi-trophy-fill text-warning"></i> Podio</h2>
      ${podiumHtml(lb.slice(0, 3))}
      <div id="ll-medals" class="ll-medals"></div>
      <div class="text-center"><div class="ll-tabs">
        <button class="ll-tab is-active" data-tab="podio"><i class="bi bi-trophy"></i> Ranking</button>
        <button class="ll-tab" data-tab="tabla"><i class="bi bi-table"></i> Tabla</button>
        <button class="ll-tab" data-tab="palabra"><i class="bi bi-bar-chart-line-fill"></i> Por ${isText ? 'palabra' : 'ítem'}</button>
      </div></div>
      <div id="ll-tabout" class="mt-1"></div>
      <div class="text-center mt-3 d-flex gap-2 justify-content-center flex-wrap">
        <button id="ll-csv" class="btn btn-outline-success btn-sm"><i class="bi bi-download"></i> Exportar CSV</button>
        <a href="#/home" class="btn btn-outline-secondary btn-sm"><i class="bi bi-house"></i> Volver a inicio</a>
      </div>
    `);

    const out = document.getElementById('ll-tabout');
    const spin = () => { out.innerHTML = '<div class="text-center py-4"><div class="spinner-border"></div></div>'; };
    const rankingHtml = () => `<div class="ll-rank">${lb.map((p, i) =>
      `<div class="ll-rank__row"><span class="ll-rank__pos">${i < 3 ? ['🥇','🥈','🥉'][i] : (i + 1) + '.'}</span><span class="ll-rank__name">${escapeHtml(p.name)}</span><span class="ll-rank__pts">${p.score ?? 0}</span></div>`).join('')}</div>`;

    async function showTab(tab) {
      document.querySelectorAll('.ll-tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
      if (tab === 'podio') { out.innerHTML = rankingHtml(); return; }
      spin();
      try {
        const rows = await gatherSessionRows();
        out.innerHTML = tab === 'tabla'
          ? sessionTableHtml(rows, items.length, { labels: itemLabels(), items, template: tpl, activity })
          : itemStatsHtml(activity, rows);
      } catch (e) { out.innerHTML = `<div class="alert alert-warning">No se pudo cargar: ${escapeHtml(e.message)}</div>`; }
    }
    document.querySelectorAll('.ll-tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    document.getElementById('ll-csv')?.addEventListener('click', async () => {
      try {
        const rows = await gatherSessionRows();
        const csv = sessionTableCsv(rows, items.length, { labels: itemLabels(), items, template: tpl, activity });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `sesion-${code}.csv`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch { toast('No se pudo exportar el CSV.', 'danger'); }
    });
    showTab('podio');
    // Medallas de aula (A2): se pintan al cargar las respuestas (no bloquea el podio).
    gatherSessionRows().then(rows => {
      const m = computeMedals(rows);
      const el = document.getElementById('ll-medals');
      if (el && m.length) el.innerHTML = m.map(x => `<span class="ll-medal">${x.icon} ${x.label}: <b>${escapeHtml(x.name)}</b></span>`).join('');
    }).catch(() => {});
  }

  paint();
}

