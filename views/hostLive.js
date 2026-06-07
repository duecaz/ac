// Host view for live mode. Drives the phase machine over sessions.phase.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { get } from '../core/storage.js';
import { createRoom, findRoomByCode, fetchSession,
         startSession, setSessionState, endSession, settleItem,
         listPlayers, listAnswers, leaderboard, kickPlayer, subscribeRoom, pingHost, fetchSessionKey }
       from '../core/liveTransport.js';
import { getTemplate } from '../core/registry.js';
import { acquire } from '../core/lifecycle.js';
import { toast, confirmModal } from '../core/toast.js';
import { applySkin } from '../core/skins.js';
import { applyBackground } from '../core/backgrounds.js';
import { fullscreenButtonHtml, attachFullscreenButton } from '../core/fullscreen.js';
import { GameEvents, emitGame } from '../core/gameEvents.js';
import { hostPaintDecision } from '../core/livePhases.js';
import { podiumHtml } from '../core/podium.js';

const SHAPE_ICONS = ['bi-triangle-fill', 'bi-diamond-fill', 'bi-circle-fill', 'bi-square-fill'];

const STUDENT_BASE = location.origin + location.pathname.replace(/teacher\.html.*/, 'student.html');

export async function renderHostLaunch(rootSel, activityId) {
  const a = get(activityId);
  if (!a) { mount(rootSel, html`<div class="alert alert-danger">Actividad no encontrada.</div>`); return; }
  if (!a.content.items.length) { mount(rootSel, html`<div class="alert alert-warning">La actividad no tiene preguntas.</div>`); return; }

  mount(rootSel, html`<div class="text-center py-5"><div class="spinner-border"></div><p class="mt-2">Creando sala…</p></div>`);
  try {
    const room = await createRoom(a);
    // Just navigate. The router will pick #/host/:code and call renderHostByCode.
    location.hash = `#/host/${room.code}`;
  } catch (e) {
    mount(rootSel, html`<div class="alert alert-danger">No se pudo crear la sala: ${escapeHtml(e.message)}</div>`);
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
  // Apply per-activity skin during the host live view.
  applySkin(activity.presentation?.skin || 'kahoot');
  applyBackground(activity.presentation?.background || 'none');
  ctx.add(() => { applySkin('default'); applyBackground('none'); });
  // Stage class for big-screen typography.
  document.body.classList.add('ww-stage');
  ctx.add(() => document.body.classList.remove('ww-stage'));

  const tpl = getTemplate(activity.template);
  const live = activity.live || {};
  const timerSec = Math.max(5, live.questionTimer || 20);
  const advanceMode = live.advanceMode || 'manual';
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
      if (!hasPayload) answers = await listAnswers(sessionId, session.current_item);
      else if (ev.eventType === 'INSERT') answers = [...answers, ev.new];
      else if (ev.eventType === 'UPDATE') answers = answers.map(a => a.id === ev.new.id ? ev.new : a);
      // While in question phase, don't repaint (the ticker updates count).
      if (session.phase !== 'question') paint();
    }
  }
  ctx.add(await subscribeRoom(sessionId, onChange));

  function joinUrl() { return `${STUDENT_BASE}#/play/${code}`; }
  function qrUrl() { return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(joinUrl())}`; }

  function paint() {
    if (disposed) return;
    // Always re-render when data changes (e.g. a player joins the lobby), but
    // only re-fire phase sounds/effects when the visible phase actually changes
    // (phaseChanged). `skip` protects an active question from being reset by
    // heartbeats/answers. Decision logic is pure + tested in core/livePhases.js.
    const { key, phaseChanged, skip } = hostPaintDecision(lastPhaseKey, session);
    if (skip) return;
    lastPhaseKey = key;
    if (session.status === 'lobby') return paintLobby(phaseChanged);
    if (session.status === 'ended') return paintPodium(phaseChanged);
    if (session.phase === 'question') return paintQuestion(phaseChanged);
    if (session.phase === 'reveal') return paintReveal(phaseChanged);
    if (session.phase === 'leaderboard') return paintLeaderboard(phaseChanged);
    paintLobby(phaseChanged);
  }

  function paintLobby(phaseChanged = true) {
    if (phaseChanged) emitGame(GameEvents.LOBBY_START, { sessionId });
    const now = Date.now();
    mount(rootSel, html`
      <div class="text-center py-3">
        <div class="d-flex justify-content-end mb-2">${fullscreenButtonHtml()}</div>
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
        <button class="btn btn-success btn-lg mt-4 px-5" id="btn-start" ${players.length===0?'disabled':''}>
          <i class="bi bi-play-fill"></i> Empezar
        </button>
        <button class="btn btn-link text-muted ms-2" id="btn-cancel">Cancelar sala</button>
      </div>
    `);
    attachFullscreenButton(rootSel);
    on(rootSel, 'click', '#btn-start', async () => {
      const deadline = new Date(Date.now() + timerSec * 1000).toISOString();
      await setSessionState(sessionId, { status: 'running', phase: 'question', current_item: 0, started_at: new Date().toISOString(), deadline });
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
    const item = activity.content.items[idx];
    if (phaseChanged) {
      emitGame(GameEvents.LOBBY_END);
      emitGame(GameEvents.QUESTION_SHOWN, { idx, total: activity.content.items.length, item });
    }
    answers = await listAnswers(sessionId, idx);
    const total = players.length;
    const answered = answers.length;
    const deadline = session.deadline ? new Date(session.deadline).getTime() : Date.now() + timerSec * 1000;
    mount(rootSel, html`
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-secondary fs-6">Pregunta ${idx + 1} / ${activity.content.items.length}</span>
        <span id="time-left" class="badge bg-warning text-dark fs-5"></span>
        <span class="badge bg-info text-dark fs-6"><i class="bi bi-check2-circle"></i> <span id="ans-count">${answered}</span> / ${total}</span>
      </div>
      <div class="progress mb-3" style="height:8px"><div id="time-bar" class="progress-bar bg-warning" style="width:100%"></div></div>
      <h2 class="text-center my-4">${escapeHtml(item.question)}</h2>
      ${item.image ? `<div class="text-center mb-3"><img src="${escapeHtml(item.image)}" class="img-fluid" style="max-height:240px"></div>` : ''}
      <div class="ww-kahoot-grid mb-4">
        ${(item.options||[]).map((o, i) => `
          <button class="btn btn-lg ww-shape-${(i % 4) + 1}" disabled>
            <i class="bi ${SHAPE_ICONS[i % 4]} me-2"></i>${escapeHtml(o)}
          </button>
        `).join('')}
      </div>
      <div class="text-center d-flex gap-2 justify-content-center flex-wrap">
        <button class="btn btn-warning btn-lg" id="btn-reveal"><i class="bi bi-stop-fill"></i> Bloquear y revelar</button>
        <button class="btn btn-outline-secondary btn-lg" id="btn-pause"><i class="bi ${paused?'bi-play-fill':'bi-pause-fill'}"></i> ${paused?'Reanudar':'Pausa'}</button>
        <button class="btn btn-outline-secondary btn-lg" id="btn-skip" title="Saltar pregunta sin puntuar"><i class="bi bi-skip-forward-fill"></i> Saltar</button>
        ${fullscreenButtonHtml()}
      </div>
    `);
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
      const isLast = idx + 1 >= activity.content.items.length;
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
    const item = activity.content.items[idx];
    if (phaseChanged) emitGame(GameEvents.REVEAL, { idx, item });
    answers = await listAnswers(sessionId, idx);
    const counts = (item.options||[]).map(o => answers.filter(a => a.value === o).length);
    const max = Math.max(1, ...counts);
    mount(rootSel, html`
      <h3 class="text-center mb-3">${escapeHtml(item.question)}</h3>
      <p class="text-center text-success fw-bold fs-4"><i class="bi bi-check-circle-fill"></i> ${escapeHtml(item.answer ?? '')}</p>
      <div class="mb-4">
        ${(item.options||[]).map((o, i) => {
          const isOk = String(o) === String(item.answer);
          const w = Math.round(100 * counts[i] / max);
          return `
            <div class="mb-2">
              <div class="d-flex justify-content-between"><span>${'ABCD'[i]}. ${escapeHtml(o)} ${isOk?'<i class="bi bi-check-circle-fill text-success"></i>':''}</span><b>${counts[i]}</b></div>
              <div class="progress" style="height:24px"><div class="progress-bar ${isOk?'bg-success':'bg-secondary'}" style="width:${w}%"></div></div>
            </div>`;
        }).join('')}
      </div>
      <div class="text-center">
        <button class="btn btn-primary btn-lg" id="btn-lb"><i class="bi bi-bar-chart-fill"></i> Ver clasificación</button>
      </div>
    `);
    on(rootSel, 'click', '#btn-lb', () => setSessionState(sessionId, { phase: 'leaderboard' }));
  }

  async function paintLeaderboard(/* phaseChanged */) {
    const lb = await leaderboard(sessionId, 10);
    const idx = session.current_item;
    const isLast = idx + 1 >= activity.content.items.length;
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
          : `<button class="btn btn-primary btn-lg" id="btn-next"><i class="bi bi-arrow-right"></i> Siguiente pregunta</button>`}
      </div>
    `);
    on(rootSel, 'click', '#btn-next', () => {
      const deadline = new Date(Date.now() + timerSec * 1000).toISOString();
      setSessionState(sessionId, { phase: 'question', current_item: idx + 1, deadline });
    });
    on(rootSel, 'click', '#btn-end', () => endSession(sessionId));
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

