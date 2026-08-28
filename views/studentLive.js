// Student-side live view. Routes: #/join, #/play/:code.
//
// v1.51.628: partido POR BUCLE (§26, deuda condicionada #2 de CLAUDE.md;
// precedente: views/admin/matrix.js). Este fichero queda de ENSAMBLADOR (§23:
// router/ciclo de vida, suscripción realtime, `paint()`, disposers) + lo que
// usan VARIOS bucles a la vez (`paintWaiting`, `isLiveBoard`, `refreshSession`/
// `adoptSession`). Cada bucle vive en su propio módulo bajo views/live/, con
// UNA fábrica que recibe `rt` — el estado compartido de la sala
// (session/activity/player, además de los helpers de arriba) — inyectado aquí:
//   views/live/studentLobby.js   — paintLobby
//   views/live/studentRondas.js  — paintQuestion + paintRevealOwn
//   views/live/studentCarrera.js — paintRace
//   views/live/studentTablero.js — paintLiveBoard
//   views/live/studentPalabra.js — paintQuestionLive (pedir la palabra)
//   views/live/studentFin.js     — paintEnded
import { clock } from '../core/clock.js';
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { joinSession, subscribeRoom, pingPresence, findRoomByCode, fetchSession } from '../core/liveTransport.js';
import { findAssignmentByCode } from '../core/assignmentsTransport.js';
import { isAcceptableNickname } from '../core/nicknameFilter.js';
import { acquire } from '../core/lifecycle.js';
import { flush as flushQueue } from '../core/submitQueue.js';
import { resetScene } from '../core/presentation.js';
import { montarMarcoJuego } from '../core/gameFrame.js';
import { getTemplate } from '../core/registry.js';
import { hasClientKey } from '../core/liveSnapshot.js';
import { VERSION } from '../core/constants.js';
import { getNick, setNick } from '../core/identity.js';
import { supportsLoop } from '../core/liveLoops.js';
import { createStudentLobby } from './live/studentLobby.js';
import { createStudentRondas } from './live/studentRondas.js';
import { createStudentCarrera } from './live/studentCarrera.js';
import { createStudentTablero } from './live/studentTablero.js';
import { createStudentPalabra } from './live/studentPalabra.js';
import { createStudentFin } from './live/studentFin.js';


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

  // EL MARCO DEL ALUMNO (core/gameFrame.js): el mismo marco de juego del
  // profe — esquina de pantalla completa incluida — con el tema y el fondo que
  // viajan en el snapshot. Se monta UNA vez; cada fase pinta en su escenario,
  // así el botón sobrevive del lobby al podio. A partir de aquí `rootSel` ES el
  // escenario: las diecinueve pantallas de esta vista no cambian ni una línea.
  const marco = montarMarcoJuego(rootSel, activity);
  rootSel = marco.stageSel;

  // Escena POR FASE (docs/handoff-player-frame.md, Etapa 1): el fondo de la
  // actividad va SOLO en las pantallas de JUEGO; lobby/espera/resultado (chrome)
  // van neutros. Toggle compartido con hostLive (core/presentation.js).
  // El tema y el fondo viven en el MARCO (core/gameFrame.js), no en la
  // página: aquí había un sceneToggle que tematizaba <body> en las fases de
  // juego — tenía sentido cuando el alumno jugaba a página desnuda, pero con el
  // marco el fondo se pintaba DOS veces y la web entera parecía el cuaderno de
  // la actividad (hallazgo del dueño, 2026-08-14, con captura).
  ctx.add(() => resetScene());
  // Prevent overscroll while playing.
  document.body.classList.add('ww-play-noscroll');
  ctx.add(() => document.body.classList.remove('ww-play-noscroll'));

  // `rt`: el estado COMPARTIDO de la sala + los helpers que usan varios bucles a
  // la vez, inyectado a cada fábrica de views/live/*. Los campos que solo lee UN
  // bucle viven DENTRO de su módulo (p.ej. `qlRotation` en studentPalabra.js);
  // los que cruzan bucles (p.ej. `myScore`: lo suman rondas y carrera, lo lee el
  // fin) viven aquí.
  const rt = {
    ctx, rootSel, code, player,
    session, activity,
    lastQuestionShownAt: 0,   // §22-5 · hora común, no el reloj de este móvil
    lastPhaseKey: '',
    autoFlushQuestion: null,  // capturar el trazo en curso al avanzar sin "Listo"
    myScore: 0,      // estimación local de respaldo (autoritativo = leaderboard del servidor)
    raceQueue: null,       // null = not started yet; [] = finished
    raceCorrectCount: 0,
    raceFinishMs: null,    // mi hora de meta (aprox., reloj común) — se congela al vaciar la cola
    qlSpinning: false,      // guards the question-live wheel mid-spin
  };

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
    if (snap && snap !== rt.activity) {
      const gainedKey = !hasClientKey(rt.activity) && hasClientKey(snap);
      rt.activity = snap;
      // Llegó la clave estando ya en carrera → repintar para salir de la espera.
      if (gainedKey && rt.session?.phase === 'race') rt.lastPhaseKey = null;
    }
    rt.session = { ...rt.session, ...next };
    paint();
  }

  async function refreshSession() {
    refetching ??= fetchSession(rt.session.id).finally(() => { refetching = null; });
    try { adoptSession(await refetching); }
    catch { /* transitorio: el próximo evento/poll recupera */ }
  }
  rt.refreshSession = refreshSession;
  ctx.add(await subscribeRoom(rt.session.id, async (ev) => {
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

  function paintWaiting(msg) {
    mount(rt.rootSel, html`
      <div class="text-center py-5">
        <div class="spinner-border text-warning mb-3"></div>
        <p class="lead">${escapeHtml(msg)}</p>
      </div>
    `);
  }
  rt.paintWaiting = paintWaiting;

  function isLiveBoard() {
    try { return supportsLoop(getTemplate(rt.activity.template), 'board'); } catch { return false; }
  }

  // Un módulo por bucle (§26), con la MISMA `rt`: precedente de carpeta
  // views/admin/matrix.js. paint() (abajo) solo conoce las funciones de pintado
  // que cada fábrica devuelve — nunca reimplementa un bucle.
  const lobby = createStudentLobby(rt);
  const rondas = createStudentRondas(rt);
  const carrera = createStudentCarrera(rt);
  const tablero = createStudentTablero(rt);
  const palabra = createStudentPalabra(rt);
  const fin = createStudentFin(rt);

  function paint() {
    // Short-circuit: ignore session UPDATEs that don't change the visible
    // state (e.g. host_seen_at heartbeats every 10 s). Without this, every
    // ping repaints, replays sounds, and bumps streaks.
    const key = `${rt.session.status}-${rt.session.phase}-${rt.session.current_item}-${rt.session.deadline||''}-${rt.session.ql_open??''}-${Object.keys(rt.session.ql_points||{}).length}`;
    if (rt.qlSpinning) return; // don't repaint over an in-progress wheel spin
    if (key === rt.lastPhaseKey) return;
    rt.lastPhaseKey = key;
    // Al SALIR de la fase 'question' (el profe reveló/avanzó) sin que el alumno
    // pulsara "Listo": captura su trazo EN CURSO en vez de descartarlo. En Tildes/
    // Comas dibujar lleva su tiempo; antes, si el profe avanzaba mientras el alumno
    // aún colocaba tildes, su respuesta se perdía → salía "Sin respuesta" pese a
    // tener buenas tildes (aunque no todas). autoFlushQuestion solo está armado
    // mientras hay una pregunta pendiente; hace clic en "Listo" con lo dibujado.
    if (rt.autoFlushQuestion && rt.session.phase !== 'question') {
      try { rt.autoFlushQuestion(); } catch { /* best-effort */ }
      rt.autoFlushQuestion = null;
    }
    if (rt.session.status === 'lobby') { return lobby.paintLobby(); }
    if (rt.session.status === 'ended') { return fin.paintEnded(); }
    if (rt.session.phase === 'question-live') { return palabra.paintQuestionLive(); }
    if (rt.session.phase === 'race') { return isLiveBoard() ? tablero.paintLiveBoard() : carrera.paintRace(); }
    if (rt.session.phase === 'question') { return rondas.paintQuestion(); }
    if (rt.session.phase === 'reveal') { return rondas.paintRevealOwn(); }
    if (rt.session.phase === 'leaderboard') { return paintWaiting('Mira la pizarra del profesor.'); }
    paintWaiting('Esperando…');
  }
  rt.paint = paint;   // studentPalabra.js lo llama al cerrarse un giro de ruleta

  paint();
}
