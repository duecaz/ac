// Host view for live mode. Drives the phase machine over sessions.phase.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { get } from '../core/storage.js';
import { createRoom, findRoomByCode, fetchSession,
         startSession, setSessionState, endSession, settleItem,
         listPlayers, listAnswers, leaderboard, kickPlayer, subscribeRoom, pingHost, fetchSessionKey,
         realtimeKind }
       from '../core/liveTransport.js';
import { getTemplate } from '../core/registry.js';
import { sessionItems } from '../kernel/session/engine.js';
import { acquire } from '../core/lifecycle.js';
import { toast, confirmModal } from '../core/toast.js';
import { applyScene } from '../core/presentation.js';
import { fullscreenButtonHtml, attachFullscreenButton } from '../core/fullscreen.js';
import { GameEvents, emitGame } from '../core/gameEvents.js';
import { hostPaintDecision } from '../core/livePhases.js';
import { podiumHtml } from '../core/podium.js';

const STUDENT_BASE = location.origin + location.pathname.replace(/teacher\.html.*/, 'student.html');

export async function renderHostLaunch(rootSel, activityId) {
  const a = get(activityId);
  if (!a) { mount(rootSel, html`<div class="alert alert-danger">Actividad no encontrada.</div>`); return; }
  if (!sessionItems(a).length) { mount(rootSel, html`<div class="alert alert-warning">La actividad no tiene preguntas.</div>`); return; }

  mount(rootSel, html`<div class="text-center py-5"><div class="spinner-border"></div><p class="mt-2">Creando sala…</p></div>`);
  try {
    const room = await createRoom(a);
    // Just navigate. The router will pick #/host/:code and call renderHostByCode.
    location.hash = `#/host/${room.code}`;
  } catch (e) {
    const needsSetup = /live_sessions/.test(e.message || '');
    mount(rootSel, html`
      <div class="container py-4" style="max-width:560px">
        <div class="alert alert-danger">
          <h5 class="alert-heading"><i class="bi bi-exclamation-octagon"></i> No se pudo crear la sala</h5>
          <p class="mb-2">${escapeHtml(e.message)}</p>
          ${needsSetup ? html`
            <hr>
            <p class="mb-2 small">El servidor de Live necesita la colección <code>live_sessions</code> (solo se crea una vez).</p>
            <a href="#/admin" class="btn btn-warning btn-sm"><i class="bi bi-shield-lock"></i> Ir a Admin → Crear colecciones</a>
          ` : ''}
        </div>
        <a href="#/play/${escapeHtml(a.id)}" class="btn btn-outline-secondary btn-sm"><i class="bi bi-arrow-left"></i> Volver a la actividad</a>
      </div>`);
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
  // Which Live backend is really in use. If it fell back to 'local' (e.g. the
  // PocketBase live_sessions collection doesn't exist), the room only works on
  // THIS device — warn the teacher in the lobby so it's not a silent failure.
  let driverKind = 'unknown';
  try { driverKind = await realtimeKind(); } catch { /* keep unknown */ }

  // Apply per-activity theme during the host live view (Kahoot look by default).
  applyScene(activity, ctx, { defaultSkin: 'kahoot' });
  // Stage class for big-screen typography.
  document.body.classList.add('ww-stage');
  ctx.add(() => document.body.classList.remove('ww-stage'));

  const tpl = getTemplate(activity.template);
  // Template-agnostic item list (quiz→items, tildes/comas→passages, …).
  const items = sessionItems(activity);
  const live = activity.live || {};
  const timerSec = Math.max(5, live.questionTimer || 20);
  const advanceMode = live.advanceMode || 'manual';
  let liveMode = (advanceMode === 'manual') ? 'manual' : 'auto';
  let autoAdvance = liveMode === 'auto';
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
        paintRace(false); // race view loads its own answer data
      } else {
        if (!hasPayload) answers = await listAnswers(sessionId, session.current_item);
        else if (ev.eventType === 'INSERT') answers = [...answers, ev.new];
        else if (ev.eventType === 'UPDATE') answers = answers.map(a => a.id === ev.new.id ? ev.new : a);
        if (session.phase !== 'question') paint();
      }
    }
  }
  ctx.add(await subscribeRoom(sessionId, onChange));

  function joinUrl() { return `${STUDENT_BASE}#/play/${code}`; }
  function qrUrl() { return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(joinUrl())}`; }

  function paint() {
    if (disposed) return;
    // question-live bypasses the skip logic: ql_open changes must always repaint.
    if (session.phase === 'question-live') return paintQuestionLive();
    // Always re-render when data changes (e.g. a player joins the lobby), but
    // only re-fire phase sounds/effects when the visible phase actually changes
    // (phaseChanged). `skip` protects an active question from being reset by
    // heartbeats/answers. Decision logic is pure + tested in core/livePhases.js.
    const { key, phaseChanged, skip } = hostPaintDecision(lastPhaseKey, session);
    if (skip) return;
    lastPhaseKey = key;
    if (session.status === 'lobby') return paintLobby(phaseChanged);
    if (session.status === 'ended') return paintPodium(phaseChanged);
    if (session.phase === 'race') return paintRace(phaseChanged);
    if (session.phase === 'question') return paintQuestion(phaseChanged);
    if (session.phase === 'reveal') return paintReveal(phaseChanged);
    if (session.phase === 'leaderboard') return paintLeaderboard(phaseChanged);
    paintLobby(phaseChanged);
  }

  function paintLobby(phaseChanged = true) {
    if (phaseChanged) emitGame(GameEvents.LOBBY_START, { sessionId });
    const isQL = activity.template === 'question-live' || activity.template === 'wheel';
    const now = Date.now();
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
        ${!isQL ? `<div class="d-flex justify-content-center mt-4 mb-2 gap-3 align-items-center">
          <label class="text-light" for="mode-select">Modo:</label>
          <select id="mode-select" class="form-select form-select-sm" style="max-width:230px">
            <option value="manual" ${liveMode==='manual'?'selected':''}>Manual (tú avanzas)</option>
            <option value="auto" ${liveMode==='auto'?'selected':''}>Automático</option>
            <option value="race" ${liveMode==='race'?'selected':''}>🏁 Carrera libre</option>
          </select>
        </div>` : '<div class="mt-4"></div>'}
        <button class="btn btn-success btn-lg px-5" id="btn-start" ${players.length===0?'disabled':''}>
          <i class="bi bi-play-fill"></i> Empezar
        </button>
        <button class="btn btn-link text-muted ms-2" id="btn-cancel">Cancelar sala</button>
      </div>
    `);
    attachFullscreenButton(rootSel);
    const modeEl = document.getElementById('mode-select');
    if (modeEl) modeEl.onchange = (e) => { liveMode = e.target.value; autoAdvance = (liveMode === 'auto'); };
    on(rootSel, 'click', '#btn-start', async () => {
      if (isQL) {
        await setSessionState(sessionId, { status: 'running', phase: 'question-live', current_item: 0, started_at: new Date().toISOString() });
      } else if (liveMode === 'race') {
        await setSessionState(sessionId, { status: 'running', phase: 'race', current_item: 0, started_at: new Date().toISOString(), deadline: null });
      } else {
        const deadline = new Date(Date.now() + timerSec * 1000).toISOString();
        await setSessionState(sessionId, { status: 'running', phase: 'question', current_item: 0, started_at: new Date().toISOString(), deadline });
      }
    });
    on(rootSel, 'click', '#btn-cancel', async () => {
      const ok = await confirmModal('¿Cancelar sala?', { okText: 'Cancelar sala', danger: true });
      if (!ok) return;
      disposed = true; // stop reacting to the 'ended' echo before it can paint a podium
      try { await endSession(sessionId); } catch {}
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
    const deadline = session.deadline ? new Date(session.deadline).getTime() : Date.now() + timerSec * 1000;
    const payload = tpl.getRoundPayload ? tpl.getRoundPayload(activity, { itemIndex: idx }) : item;
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
    tpl.renderRoundHost(document.getElementById('host-round'), { phase: 'question', item, payload });
    attachFullscreenButton(rootSel);

    on(rootSel, 'click', '#btn-reveal', () => doSettle(idx));
    on(rootSel, 'click', '#btn-pause', async () => {
      if (paused) {
        // Resume: extend deadline by the pauseRemainMs we saved.
        const newDeadline = new Date(Date.now() + pauseRemainMs).toISOString();
        await setSessionState(sessionId, { deadline: newDeadline });
        paused = false;
      } else {
        pauseRemainMs = Math.max(0, deadline - Date.now());
        await setSessionState(sessionId, { deadline: null });
        paused = true;
      }
    });
    on(rootSel, 'click', '#btn-skip', async () => {
      const ok = await confirmModal('¿Saltar esta pregunta? Se cerrará sin puntuar.', { okText: 'Saltar', danger: false });
      if (!ok) return;
      const isLast = idx + 1 >= items.length;
      if (isLast) await endSession(sessionId);
      else {
        const newDeadline = new Date(Date.now() + timerSec * 1000).toISOString();
        await setSessionState(sessionId, { phase: 'question', current_item: idx + 1, deadline: newDeadline });
      }
    });

    if (tickHandle) clearInterval(tickHandle);
    tickHandle = ctx.setInterval(() => {
      if (session.phase !== 'question') { clearInterval(tickHandle); tickHandle = null; return; }
      // If host paused (deadline cleared server-side), freeze the bar.
      if (!session.deadline) {
        const t = document.getElementById('time-left');
        const ac = document.getElementById('ans-count');
        if (t) t.textContent = 'Pausa';
        if (ac) ac.textContent = String(answers.length);
        return;
      }
      const liveDeadline = new Date(session.deadline).getTime();
      const remain = Math.max(0, liveDeadline - Date.now());
      const pct = Math.max(0, Math.min(100, 100 * remain / (timerSec * 1000)));
      const t = document.getElementById('time-left');
      const bar = document.getElementById('time-bar');
      const ac = document.getElementById('ans-count');
      if (t) t.textContent = `${Math.ceil(remain / 1000)}s`;
      if (bar) bar.style.width = pct + '%';
      if (ac) ac.textContent = String(answers.length);
      // Auto-advance triggers.
      const allAnswered = total > 0 && answers.length >= total;
      if (allAnswered && (advanceMode === 'autoOnAllAnswered' || (live.lockAnswersOn === 'allAnswered'))) {
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
    const idx = session.current_item;
    const isLast = idx + 1 >= items.length;
    mount(rootSel, html`
      <h2 class="text-center mb-4"><i class="bi bi-bar-chart-fill"></i> Clasificación</h2>
      <div class="ww-leaderboard mx-auto" style="max-width:600px">
        ${lb.map((p, i) => `
          <div class="row align-items-center bg-dark text-light rounded mb-2 p-2">
            <div class="col-1"><b>${i+1}</b></div>
            <div class="col-7">${escapeHtml(p.name)}</div>
            <div class="col-4 text-end"><b>${p.score}</b> pts</div>
          </div>`).join('')}
      </div>
      <div class="text-center mt-4">
        ${isLast
          ? `<button class="btn btn-warning btn-lg" id="btn-end"><i class="bi bi-trophy-fill"></i> Terminar y mostrar podio</button>`
          : `<button class="btn btn-primary btn-lg" id="btn-next"><i class="bi bi-arrow-right"></i> <span id="btn-next-txt">Siguiente pregunta</span></button>`}
      </div>
    `);
    on(rootSel, 'click', '#btn-next', () => {
      const deadline = new Date(Date.now() + timerSec * 1000).toISOString();
      setSessionState(sessionId, { phase: 'question', current_item: idx + 1, deadline });
    });
    on(rootSel, 'click', '#btn-end', () => endSession(sessionId));

    // Auto-advance to next question after 5s (only between questions, not on the last).
    if (autoAdvance && !isLast && phaseChanged) {
      let secs = 5;
      const tick = ctx.setInterval(() => {
        if (session.phase !== 'leaderboard') { clearInterval(tick); return; }
        secs--;
        const t = document.getElementById('btn-next-txt');
        if (t) t.textContent = `Siguiente pregunta (${secs}s)`;
        if (secs <= 0) {
          clearInterval(tick);
          const deadline = new Date(Date.now() + timerSec * 1000).toISOString();
          setSessionState(sessionId, { phase: 'question', current_item: idx + 1, deadline });
        }
      }, 1000);
    }
  }

  async function loadRaceAnswers() {
    const all = await Promise.all(
      items.map((_, i) => listAnswers(sessionId, i).then(ans => ans.map(a => ({ ...a, itemIndex: i }))))
    );
    return all.flat();
  }

  async function paintRace(phaseChanged = true) {
    if (phaseChanged) emitGame(GameEvents.LOBBY_END);
    let allAnswers;
    try { allAnswers = await loadRaceAnswers(); } catch { allAnswers = []; }

    // During the race answers are unsettled (correct=null), so track unique
    // item indices each player has submitted for — that IS their real progress.
    const prog = {};
    for (const p of players) prog[p.id] = { name: p.name, items: new Set() };
    for (const a of allAnswers) {
      const pid = a.playerId || a.player_id;
      if (prog[pid]) prog[pid].items.add(a.itemIndex);
    }
    const sorted = Object.values(prog).sort((a, b) => b.items.size - a.items.size);
    const total = items.length;
    const elapsed = session.started_at ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000) : 0;
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;

    mount(rootSel, html`
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="mb-0"><i class="bi bi-flag-fill text-warning me-2"></i>Carrera libre</h4>
        <span class="badge bg-secondary fs-6" id="race-timer">${mins}:${String(secs).padStart(2,'0')}</span>
        ${fullscreenButtonHtml()}
      </div>
      <div class="mb-4" style="max-width:700px;margin:0 auto">
        ${sorted.map((p, i) => {
          const n = p.items.size;
          const pct = total > 0 ? Math.round(100 * n / total) : 0;
          const done = n >= total;
          return `<div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="fw-bold text-light fs-5">${i+1}. ${escapeHtml(p.name)}${done ? ' 🏆' : ''}</span>
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

    if (phaseChanged) {
      const timerTick = ctx.setInterval(() => {
        if (session.phase !== 'race') { clearInterval(timerTick); return; }
        const el = document.getElementById('race-timer');
        if (!el) { clearInterval(timerTick); return; }
        const e = session.started_at ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000) : 0;
        const m = Math.floor(e / 60), s = e % 60;
        el.textContent = `${m}:${String(s).padStart(2,'0')}`;
      }, 1000);
      // Polling fallback: refresh progress every 5 s even if SSE is missed.
      const racePoll = ctx.setInterval(() => {
        if (session.phase !== 'race') { clearInterval(racePoll); return; }
        paintRace(false);
      }, 5000);
    }

    on(rootSel, 'click', '#btn-end-race', async () => {
      const ok = await confirmModal('¿Terminar la carrera? Se calculará la clasificación final.', { okText: 'Terminar carrera' });
      if (!ok) return;
      const btn = document.getElementById('btn-end-race');
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Finalizando…'; }
      for (let i = 0; i < items.length; i++) {
        try { await settleItem(sessionId, i); } catch {}
      }
      await endSession(sessionId);
    });
  }

  const QL_COLORS = ['#e74c3c','#e67e22','#d4ac0d','#27ae60','#16a085','#2980b9','#8e44ad','#c0392b'];

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
    const isWheel    = activity.template === 'wheel';
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
      await setSessionState(sessionId, {
        ql_award: { playerId: qlBy, points },
        ql_open: null, ql_question: null, ql_image: null, ql_by: null, ql_by_name: null,
        ql_points: newPoints,
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

  async function paintPodium(phaseChanged = true) {
    const lb = await leaderboard(sessionId, 3);
    if (phaseChanged) emitGame(GameEvents.PODIUM, { top: lb.map(p => ({ name: p.name, score: p.score })) });
    mount(rootSel, html`
      <h2 class="text-center mb-4"><i class="bi bi-trophy-fill text-warning"></i> Podio</h2>
      ${podiumHtml(lb)}
      <div class="text-center">
        <a href="#/home" class="btn btn-outline-primary btn-lg"><i class="bi bi-house"></i> Volver a inicio</a>
      </div>
    `);
  }

  paint();
}

