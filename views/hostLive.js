// Host view for live mode. Drives the phase machine over sessions.phase.
//
// v1.51.628: partido POR BUCLE (§26, deuda condicionada #2 de CLAUDE.md;
// precedente: views/admin/matrix.js). Este fichero queda de ENSAMBLADOR
// (§23: router/ciclo de vida, suscripción realtime, `scene()`, el switch de
// fases, stageClaim, disposers) + los helpers que USAN VARIOS bucles a la vez
// (`openQuestion`, `maybeAutoEnd`, `startRaceLoop`, `raceClock`, `endBadge`).
// Cada bucle vive en su propio módulo bajo views/live/, con UNA fábrica que
// recibe `rt` — el estado compartido de la sala (session/players/answers,
// ademas de los helpers de arriba) — inyectado aquí:
//   views/live/hostLobby.js    — lobbySetupHtml + paintLobby
//   views/live/hostRondas.js   — paintQuestion + paintReveal + paintLeaderboard
//   views/live/hostCarrera.js  — paintRace
//   views/live/hostTablero.js  — paintLiveBoardHost
//   views/live/hostPalabra.js  — paintQuestionLive (pedir la palabra)
//   views/live/hostInforme.js  — paintPodium + pestañas del informe
import { serverNow } from '../core/serverNow.js';
// §22-5 · el PROFE también es un cliente: los instantes que ESTAMPA en la sala
// nacen en hora común, o su reloj torcido rompe a la clase entera a la vez.
import { startElapsedTicker } from '../core/deadlineTicker.js';
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { get, getAnywhere } from '../core/storage.js';
import { createRoom, findRoomByCode, fetchSession,
         setSessionState, endSession,
         listPlayers, listAnswers, kickPlayer, subscribeRoom, pingHost, fetchSessionKey,
         realtimeKind }
       from '../core/liveTransport.js';
import { getTemplate } from '../core/registry.js';
import { revisarActividad, pantallaNoListaHtml } from '../core/activityCheck.js';
import { sessionItems } from '../kernel/session/engine.js';
import { acquire } from '../core/lifecycle.js';
import { getAuthUserId } from '../core/auth.js';
import { openLoginModal } from './loginModal.js';
import { toast } from '../core/toast.js';
import { sceneToggle, resetScene } from '../core/presentation.js';
import { montarMarcoJuego } from '../core/gameFrame.js';
import { hostPaintDecision } from '../core/livePhases.js';
import { isStudentSnapshot } from '../core/liveSnapshot.js';
import { questionWindowMs, readSeconds, itemWindowMs, mmss } from '../core/timings.js';
import { loopsOf, supportsLoop } from '../core/liveLoops.js';
import { shouldEnd, endPolicyOf } from '../core/liveEnd.js';
import { createHostLobby } from './live/hostLobby.js';
import { createHostRondas } from './live/hostRondas.js';
import { createHostCarrera } from './live/hostCarrera.js';
import { createHostTablero } from './live/hostTablero.js';
import { createHostPalabra } from './live/hostPalabra.js';
import { createHostInforme } from './live/hostInforme.js';


export async function renderHostLaunch(rootSel, activityId) {
  // Igual que el modo solo (playerView): primero local, y si no está, se trae de
  // la nube. Antes solo miraba local → una actividad que vive en PB pero no en el
  // navegador (otro dispositivo, caché limpiada) daba "Actividad no encontrada"
  // aunque en solo sí abría.
  if (!get(activityId)) mount(rootSel, html`<div class="text-center py-5"><div class="spinner-border"></div><p class="mt-2">Cargando actividad…</p></div>`);
  const a = await getAnywhere(activityId);
  if (!a) { mount(rootSel, html`<div class="alert alert-danger">Actividad no encontrada.</div>`); return; }
  // A MEDIAS NO SE LLEVA A CLASE, y se comprueba AQUÍ y no en el botón de la
  // portada: `#/launch/:id` es una ruta con enlace propio (marcador, atrás,
  // cualquier vista futura con un botón de PIN). La comprobación en el botón
  // deja la puerta de al lado abierta; en la ruta las cubre todas.
  // Sustituye a un «La actividad no tiene preguntas» que era un callejón: ahora
  // se dice QUÉ falta y se ofrece ir a arreglarlo.
  const rev = revisarActividad(a);
  if (!rev.jugable) { mount(rootSel, pantallaNoListaHtml(a, rev)); return; }

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

  // EL MARCO DE JUEGO, TAMBIÉN AQUÍ (core/gameFrame.js). Esta vista es la que se
  // PROYECTA en la pared: es tan «juego» como la del alumno, y sin embargo era la
  // única que se pintaba a página desnuda. El dueño lo vio por su síntoma
  // (2026-08-15, con captura): «la página del docente tiene el fondo de la
  // actividad, ¿por qué?». Porque el tema y el fondo se aplicaban al <body>: el
  // cuaderno se pintaba por toda la web —barra incluida— y el juego no tenía
  // caja, así que la carrera quedaba arriba y debajo un campo de renglones hasta
  // el final del scroll. Con marco, el fondo tiene DÓNDE ponerse.
  // Se monta UNA vez; cada fase pinta en su escenario, así el botón de pantalla
  // completa —imprescindible para proyectar— sobrevive del lobby al podio.
  const marco = montarMarcoJuego(rootSel, activity, { escena: false, caja: false });
  ctx.add(() => marco.dispose());
  rootSel = marco.stageSel;

  // Escena POR FASE (docs/handoff-player-frame.md, Etapa 1): el fondo/skin de la
  // actividad se aplica SOLO en las pantallas de JUEGO; lobby y podio (chrome) van
  // con el fondo neutro de la app. El enrutador paint() decide por rama.
  // El ÁMBITO es el marco, nunca la página (§23): un tema global se queda pegado
  // a la vista siguiente, y aquí además tapaba el chrome del profe.
  const scene = sceneToggle(activity, { target: marco.frame });
  ctx.add(() => resetScene(marco.frame));
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

  // `rt`: el estado COMPARTIDO de la sala + los helpers que usan varios bucles a
  // la vez, inyectado a cada fábrica de views/live/*. Los campos que solo lee UN
  // bucle viven DENTRO de su módulo (p.ej. `loop`/`endPolicy` en hostLobby.js);
  // los que cruzan bucles (autoAdvance/readSecs: los fija el lobby y los lee
  // rondas + openQuestion) viven aquí.
  const rt = {
    ctx, rootSel, code, sessionId, activity, tpl, items, live, timerSec, advanceMode, loops, isBoard, driverKind,
    scene,
    session: await fetchSession(sessionId),
    players: await listPlayers(sessionId),
    answers: [],
    disposed: false,
    loop: 'rounds',                                // hostLobby.js lo fija al crearse
    autoAdvance: advanceMode !== 'manual',          // "avanzar solo" (dentro de rondas)
    readSecs: readSeconds(activity),                // ventana de LECTURA (R-1)
  };
  ctx.add(() => { rt.disposed = true; });

  // Host heartbeat every 10s so cleanup_zombie_sessions doesn't reap us.
  pingHost(sessionId).catch(() => {});
  ctx.setInterval(() => pingHost(sessionId).catch(() => {}), 10000);

  // C-1 · ¿toca cerrar sola la partida? (core/liveEnd.js) La MISMA comprobación
  // para carrera y tablero: cambia solo qué cuenta como "terminado". Dispara una
  // vez (`autoEnding`) y el profe conserva su botón de cortar antes.
  let autoEnding = false;                        // el cierre automático dispara UNA vez
  async function maybeAutoEnd(finished) {
    if (autoEnding || rt.session.status === 'ended') return false;
    const { policy, n, deadlineMs } = endPolicyOf(rt.session);
    if (!shouldEnd({ policy, n, deadlineMs, now: serverNow(), players: rt.players.length, finished })) return false;
    autoEnding = true;
    try { await endSession(sessionId); } catch (e) { autoEnding = false; console.warn('[hostLive] cierre automático:', e); }
    return true;
  }
  rt.maybeAutoEnd = maybeAutoEnd;

  // R-1 · ABRIR UNA PREGUNTA = un solo PATCH con los DOS instantes: cuándo se
  // pueden tocar las respuestas y cuándo cierra. El ritmo se escribe en la SALA
  // (§26 ficha 1b): un temporizador local se desincroniza entre móviles, no
  // sobrevive a recargar ni a entrar tarde, y no es verificable en el servidor.
  function openQuestion(idx) {
    const now = serverNow();
    const openAt = now + rt.readSecs * 1000;
    // R-3 · cada pregunta puede tener SU tiempo; si no lo declara, hereda el de
    // la actividad. Como el cierre viaja como INSTANTE, el alumno no necesita
    // saber los segundos: lee el mismo reloj sea cual sea la ventana.
    const windowMs = itemWindowMs(activity, items[idx]);
    return setSessionState(sessionId, {
      status: 'running', phase: 'question', current_item: idx,
      answers_open_at: new Date(openAt).toISOString(),
      deadline: new Date(openAt + windowMs).toISOString(),
      // §26 · el ritmo va EN LA SALA: el dial del lobby puede subir la lectura
      // por encima de lo que declara la actividad, y el cinturón del alumno
      // (core/liveGate.js) acota la espera con ESTE número — si leyera el de la
      // actividad, subir el dial rompería R-1 (el alumno abriría antes de
      // answers_open_at). Cazado por la revisión de v1.51.429.
      read_secs: rt.readSecs,
    });
  }
  rt.openQuestion = openQuestion;

  // CARRERA: reloj + red de seguridad de refresco. Las DOS pantallas de carrera
  // (lista de progreso y tablero compartido) necesitan exactamente lo mismo —
  // cronómetro ascendente compartido (core/deadlineTicker.js, con clock.now() y
  // auto-parada al cambiar de fase) más un repintado de respaldo por si se pierde
  // un evento de realtime. Estaba copiado en las dos, con su literal cada una.
  function startRaceLoop(repaint, everyMs) {
    startElapsedTicker({
      since: rt.session.started_at, setIntervalFn: ctx.setInterval,
      while: () => rt.session.phase === 'race' && !!document.getElementById('race-timer'),
      onTick: ({ label }) => { const el = document.getElementById('race-timer'); if (el) el.textContent = label; },
    });
    const poll = ctx.setInterval(() => {
      if (rt.session.phase !== 'race') { clearInterval(poll); return; }
      repaint(false);
    }, everyMs);
  }
  rt.startRaceLoop = startRaceLoop;

  // Cómo va a terminar esto, en la pizarra: con tiempo límite el cronómetro es
  // DESCENDENTE (queda X) — el mismo instante que ve el alumno; sin él, se dice
  // la regla ("terminan todos" / "primeros N"), que es lo que la clase pregunta.
  // Valor INICIAL del cronómetro de carrera/tablero: el mismo instante y el mismo
  // formato que luego repinta startElapsedTicker (core/deadlineTicker.js), para
  // que el primer pintado no sea una tercera copia de la aritmética.
  rt.raceClock = () => mmss(rt.session.started_at ? serverNow() - Date.parse(rt.session.started_at) : 0, Math.floor);

  rt.endBadge = function endBadge() {
    const { policy, n, deadlineMs } = endPolicyOf(rt.session);
    if (policy === 'time' && deadlineMs) {
      return `queda ${mmss(Math.max(0, deadlineMs - serverNow()), Math.floor)}`;
    }
    if (policy === 'firstN') return `terminan los ${n} primeros`;
    return 'terminan todos';
  };

  // Un módulo por bucle (§26), con la MISMA `rt`: precedente de carpeta
  // views/admin/matrix.js. onChange/paint (abajo) solo conocen las funciones de
  // pintado que cada fábrica devuelve — nunca reimplementan un bucle.
  const lobby = createHostLobby(rt);
  const rondas = createHostRondas(rt);
  const carrera = createHostCarrera(rt);
  const tablero = createHostTablero(rt);
  const palabra = createHostPalabra(rt);
  const informe = createHostInforme(rt);

  let lastPhaseKey = '';

  async function onChange(ev) {
    if (rt.disposed) return;
    // Some backends deliver a full row diff (Supabase postgres_changes); the
    // local driver sends only { table } as a "something changed" ping. When the
    // payload is missing, re-fetch the affected list so both backends work.
    const hasPayload = ev.new || ev.old;
    if (ev.table === 'sessions') {
      rt.session = ev.new ? { ...rt.session, ...ev.new } : { ...rt.session, ...(await fetchSession(sessionId)) };
      paint();
    }
    else if (ev.table === 'players') {
      if (!hasPayload) rt.players = await listPlayers(sessionId);
      else if (ev.eventType === 'DELETE') rt.players = rt.players.filter(p => p.id !== ev.old.id);
      else if (ev.eventType === 'INSERT') rt.players = [...rt.players, ev.new];
      else rt.players = rt.players.map(p => p.id === ev.new.id ? ev.new : p);
      paint();
    }
    else if (ev.table === 'answers') {
      if (rt.session.phase === 'race') {
        if (isBoard) tablero.paintLiveBoardHost(false); // grid of live mini-boards
        else carrera.paintRace(false); // race view loads its own answer data
      } else {
        if (!hasPayload) rt.answers = await listAnswers(sessionId, rt.session.current_item);
        else if (ev.eventType === 'INSERT') rt.answers = [...rt.answers, ev.new];
        else if (ev.eventType === 'UPDATE') rt.answers = rt.answers.map(a => a.id === ev.new.id ? ev.new : a);
        if (rt.session.phase !== 'question') paint();
      }
    }
  }
  ctx.add(await subscribeRoom(sessionId, onChange));

  function paint() {
    if (rt.disposed) return;
    // question-live bypasses the skip logic: ql_open changes must always repaint.
    if (rt.session.phase === 'question-live') { scene(true); return palabra.paintQuestionLive(); }
    // Always re-render when data changes (e.g. a player joins the lobby), but
    // only re-fire phase sounds/effects when the visible phase actually changes
    // (phaseChanged). `skip` protects an active question from being reset by
    // heartbeats/answers. Decision logic is pure + tested in core/livePhases.js.
    const { key, phaseChanged, skip } = hostPaintDecision(lastPhaseKey, rt.session);
    if (skip) return;
    lastPhaseKey = key;
    if (rt.session.status === 'lobby') { scene(false); return lobby.paintLobby(phaseChanged); }
    if (rt.session.status === 'ended') { scene(false); return informe.paintPodium(phaseChanged); }
    // EN CARRERA, LA PIZARRA NO JUEGA: MONITORIZA (dueño, 2026-08-16, con
    // captura: «el player del docente tiene fondo»). Cada alumno va a su ritmo
    // en su móvil; aquí solo hay un título, el avance y el botón de terminar. El
    // fondo de la actividad —el cuaderno de Tildes— se extendía por toda esa
    // pantalla casi vacía y la hacía parecer un ejercicio que nadie está
    // jugando. El fondo es de las pantallas donde se VE el contenido; esta es
    // chrome, como el lobby y el podio.
    // …salvo el TABLERO, que aunque comparte la fase `race` SÍ pinta contenido
    // de la actividad en la pizarra (paintLiveBoardHost): ahí el fondo es del
    // juego, como en cualquier otra pantalla donde se ve el ejercicio.
    if (rt.session.phase === 'race') {
      scene(isBoard);
      return isBoard ? tablero.paintLiveBoardHost(phaseChanged) : carrera.paintRace(phaseChanged);
    }
    scene(true);
    if (rt.session.phase === 'question') return rondas.paintQuestion(phaseChanged);
    if (rt.session.phase === 'reveal') return rondas.paintReveal(phaseChanged);
    if (rt.session.phase === 'leaderboard') return rondas.paintLeaderboard(phaseChanged);
    scene(false); lobby.paintLobby(phaseChanged);
  }

  paint();
}
