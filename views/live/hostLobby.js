// HOST · bucle LOBBY (§26): sala de espera, elección de bucle (rondas · carrera ·
// tablero · pedir la palabra) y arranque de la sala. Extraído de
// views/hostLive.js en el corte POR BUCLE (v1.51.628, deuda condicionada #2 de
// CLAUDE.md) — `loop`/`endPolicy`/`endN`/`endMinutes` viven aquí porque solo
// este bucle los toca; `autoAdvance`/`readSecs` viajan en `rt` porque rondas y
// `openQuestion` (en el ensamblador) también los leen.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { studentBase } from '../../core/routing.js';
import { serverNow } from '../../core/serverNow.js';
import { confirmModal } from '../../core/toast.js';
import { setSessionState, endSession, kickPlayer } from '../../core/liveTransport.js';
import { fullscreenButtonHtml, attachFullscreenButton } from '../../core/fullscreen.js';
import { supportsLoop, defaultLoop, LOOP_LABELS, hasAdvanceChoice } from '../../core/liveLoops.js';
import { READ_SECONDS_MAX } from '../../core/timings.js';
import { DEFAULT_POLICY, DEFAULT_FIRST_N, DEFAULT_MINUTES } from '../../core/liveEnd.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';

// Fábrica única (precedente: views/admin/matrix.js). `rt` es el estado
// compartido de la sala (core/liveLoops.js §26, core/livePhases.js) inyectado
// por el ensamblador `views/hostLive.js`.
export function createHostLobby(rt) {
  let loop = defaultLoop(rt.tpl) || 'rounds';    // bucle elegido en el lobby
  rt.loop = loop;   // §26 · lo lee racePassedRow en la carrera (views/live/hostCarrera.js)
  // C-1 · POLÍTICA DE FIN de carrera/tablero (core/liveEnd.js): se LEE de la
  // actividad (editor, pestaña «En vivo»), no del lobby — decisión 2026-09-02:
  // el lobby ya tiene su elección de bucle y R2 (§28) limita a 2 opciones de
  // partida. El profe la deja preparada al crear la clase, no al arrancar la sala.
  const live = rt.activity?.live || {};
  const endPolicy = live.endPolicy || DEFAULT_POLICY;
  const endN = live.endN || DEFAULT_FIRST_N;
  const endMinutes = live.endMinutes || DEFAULT_MINUTES;

  function joinUrl() { return `${studentBase()}#/play/${rt.code}`; }
  function qrUrl() { return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(joinUrl())}`; }

  // Dos preguntas ORDENADAS (§26 ficha 1b): primero "¿cómo juega la clase?"
  // —construido desde los bucles que la PLANTILLA declara, no desde un <select>
  // fijo— y solo entonces los ajustes de ese bucle. Antes eran tres opciones al
  // mismo nivel ("manual · automático · carrera") que mezclaban qué juego con
  // quién avanza, y por eso la carrera se ofrecía hasta donde no tenía sentido.
  function lobbySetupHtml() {
    if (rt.loops.length === 0) return '<div class="mt-4"></div>';
    const chooser = rt.loops.length > 1 ? `
      <div class="mb-3">
        <div class="ll-label small mb-1">¿Cómo juega la clase?</div>
        <div class="btn-group" role="group">
          ${rt.loops.map(l => `<button type="button" class="btn btn-sm ll-pick loop-pick${l === loop ? ' is-on' : ''}" data-loop="${l}">${escapeHtml(LOOP_LABELS[l].label)}</button>`).join('')}
        </div>
        <div class="ll-hint small mt-1">${escapeHtml(LOOP_LABELS[loop]?.hint || '')}</div>
      </div>` : `<div class="ll-hint small mb-3">${escapeHtml(LOOP_LABELS[loop]?.hint || '')}</div>`;
    const rounds = hasAdvanceChoice(loop) ? `
      <div class="d-flex gap-4 justify-content-center flex-wrap align-items-end">
        <div>
          <div class="ll-label small mb-1">Avanzar de pregunta</div>
          <div class="btn-group btn-group-sm" role="group">
            <button type="button" class="btn ll-pick adv-pick${!rt.autoAdvance ? ' is-on' : ''}" data-auto="0">Yo controlo</button>
            <button type="button" class="btn ll-pick adv-pick${rt.autoAdvance ? ' is-on' : ''}" data-auto="1">Solo</button>
          </div>
        </div>
        <div>
          <label class="ll-label small mb-1 d-block" for="read-secs">Tiempo de lectura</label>
          <div class="input-group input-group-sm" style="max-width:130px">
            <input id="read-secs" type="number" class="form-control" min="0" max="${READ_SECONDS_MAX}" value="${rt.readSecs}">
            <span class="input-group-text">s</span>
          </div>
        </div>
      </div>
      <div class="ll-hint small mt-1">Segundos para LEER antes de poder responder. 0 = responder al instante.</div>` : '';
    return `<div class="text-center mt-4 mb-2">${chooser}${rounds}</div>`;
  }

  function paintLobby(phaseChanged = true) {
    if (phaseChanged) emitGame(GameEvents.LOBBY_START, { sessionId: rt.sessionId });
    const isQL = supportsLoop(rt.tpl, 'claim');
    const now = serverNow();   // se compara con `last_seen` de cada jugador (instante de la sala)
    mount(rt.rootSel, html`
      <div class="text-center py-3">
        <div class="d-flex justify-content-end mb-2">${fullscreenButtonHtml()}</div>
        ${rt.driverKind === 'local' ? html`
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
        <div class="h3"><b>${escapeHtml(studentBase().replace(/^https?:\/\//,''))}</b></div>
        <h5 class="text-muted mt-3 mb-1">PIN</h5>
        <div class="ww-pin">${escapeHtml(rt.code)}</div>
        <img src="${qrUrl()}" alt="QR" class="my-3" style="max-width:240px">
        <div>
          <span class="badge bg-info text-dark fs-5"><i class="bi bi-people-fill"></i> ${rt.players.length} jugadores</span>
        </div>
        <div class="row mt-4 g-2 ww-host-players">
          ${rt.players.map(p => {
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
        <button class="btn btn-success btn-lg px-5" id="btn-start" ${rt.players.length===0?'disabled':''}>
          <i class="bi bi-play-fill"></i> Empezar
        </button>
        <button class="btn btn-link text-muted ms-2" id="btn-cancel">Cancelar sala</button>
      </div>
    `);
    attachFullscreenButton(rt.rootSel);
    on(rt.rootSel, 'click', '.loop-pick', (_, b) => { loop = b.dataset.loop; rt.loop = loop; paintLobby(false); });
    on(rt.rootSel, 'click', '.adv-pick', (_, b) => { rt.autoAdvance = b.dataset.auto === '1'; paintLobby(false); });
    const readEl = document.getElementById('read-secs');
    if (readEl) readEl.onchange = (e) => { rt.readSecs = Math.max(0, Math.min(READ_SECONDS_MAX, Math.round(+e.target.value || 0))); };
    on(rt.rootSel, 'click', '#btn-start', async () => {
      const startedAt = new Date(serverNow()).toISOString();
      if (loop === 'claim') {
        await setSessionState(rt.sessionId, { status: 'running', phase: 'question-live', current_item: 0, started_at: startedAt, loop });
      } else if (loop === 'race' || loop === 'board') {
        // El "tiempo límite" viaja como INSTANTE en la sala (§26 ficha 1b), no
        // como un contador del host: así el alumno ve el mismo reloj y sobrevive
        // a que el profe recargue.
        const deadline = endPolicy === 'time'
          ? new Date(serverNow() + endMinutes * 60_000).toISOString() : null;
        await setSessionState(rt.sessionId, {
          status: 'running', phase: 'race', current_item: 0, started_at: startedAt, loop,
          deadline, end_policy: endPolicy, end_n: endN,
        });
      } else {
        await setSessionState(rt.sessionId, { started_at: startedAt, loop });
        await rt.openQuestion(0);
      }
    });
    on(rt.rootSel, 'click', '#btn-cancel', async () => {
      const ok = await confirmModal('¿Cancelar sala?', { okText: 'Cancelar sala', danger: true });
      if (!ok) return;
      rt.disposed = true; // stop reacting to the 'ended' echo before it can paint a podium
      // Best-effort: cancelar sala igual navega a casa aunque el PATCH falle.
      try { await endSession(rt.sessionId); } catch (e) { console.warn('[hostLive] endSession al cancelar:', e); }
      location.hash = '#/home';
    });
    on(rt.rootSel, 'click', '.kick', (_, b) => kickPlayer(rt.sessionId, b.dataset.id));
  }

  return { paintLobby };
}
