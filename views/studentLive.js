// Student-side live view. Routes: #/join, #/play/:code.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { joinSession, getOwnAnswer, subscribeRoom, pingPresence, findRoomByCode, fetchSession, leaderboard, setSessionState, submitProgress, submitRaceAttempt } from '../core/liveTransport.js';
import { findAssignmentByCode } from '../core/assignmentsTransport.js';
import { isAcceptableNickname } from '../core/nicknameFilter.js';
import { acquire } from '../core/lifecycle.js';
import { toast } from '../core/toast.js';
import { submit as queuedSubmit, flush as flushQueue, pendingCount } from '../core/submitQueue.js';
import { applyScene, resetScene } from '../core/presentation.js';
import { fullscreenButtonHtml, attachFullscreenButton } from '../core/fullscreen.js';
import { GameEvents, emitGame } from '../core/gameEvents.js';
import * as Streaks from '../core/streaks.js';
import { getTemplate } from '../core/registry.js';
import { sessionItems } from '../kernel/session/engine.js';
import { lsGet, lsSet } from '../core/ls.js';
import { wheelSvg } from '../templates/wheel/render.js';
import { pickIndex } from '../templates/wheel/logic.js';
import { QL_COLORS } from '../core/questionLive.js';
import { RACE_FLASH_MS } from '../core/timings.js';

const NICK_KEY = 'ww.nick';

export function renderJoin(rootSel, prefilledCode = '') {
  mount(rootSel, html`
    <div class="text-center py-4" style="max-width:420px;margin:0 auto">
      <h2 class="mb-4">Unirme a la sala</h2>
      <input id="f-code" class="form-control form-control-lg text-center mb-3 ww-pin-input" maxlength="8" placeholder="Código" autocomplete="off" autocapitalize="characters" value="${escapeHtml(prefilledCode)}">
      <input id="f-nick" class="form-control form-control-lg text-center mb-3" placeholder="Tu apodo" value="${escapeHtml(lsGet(NICK_KEY) || '')}">
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
        lsSet(NICK_KEY, f.value);
        location.hash = `#/task/${code}`;
        return;
      }
      const r = await joinSession(code, nick);
      localStorage.setItem(NICK_KEY, f.value);
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
  let questionTickHandle = null;
  let lastPhaseKey = '';
  let myScore = 0;      // estimación local de respaldo (autoritativo = leaderboard del servidor)
  let endedFired = false;
  let endingInProgress = false;
  let raceQueue = null;       // null = not started yet; [] = finished
  let raceCorrectCount = 0;
  let raceFirstSent = new Set();  // ítems cuyo PRIMER intento ya se envió (análisis)
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

  // Escena POR FASE (docs/handoff-player-frame.md, Etapa 1): el fondo de la
  // actividad va SOLO en las pantallas de JUEGO; lobby/espera/resultado (chrome) van
  // neutros. Antes se aplicaba al montar y se apropiaba de toda la página.
  let sceneOn = null;
  function scene(game) {
    if (game === sceneOn) return;
    sceneOn = game;
    if (game) applyScene(activity, null, { defaultSkin: 'kahoot' });
    else resetScene();
  }
  ctx.add(() => resetScene());
  // Prevent overscroll while playing.
  document.body.classList.add('ww-play-noscroll');
  ctx.add(() => document.body.classList.remove('ww-play-noscroll'));

  ctx.add(await subscribeRoom(session.id, async (ev) => {
    if (ev.table === 'sessions') {
      // Full diff (Supabase) or re-fetch on a bare ping (local driver).
      session = ev.new ? { ...session, ...ev.new } : { ...session, ...(await fetchSession(session.id)) };
      paint();
    }
  }));
  ctx.setInterval(() => pingPresence(player.playerId).catch(()=>{}), 15000);
  // Polling fallback: mobile WebSockets drop when the tab goes to background
  // or the network switches. Re-fetch session every 8 s so the student
  // catches up even if the realtime event was missed. paint() is idempotent
  // (the lastPhaseKey dedup skips re-renders when nothing changed).
  ctx.setInterval(async () => {
    try { session = await fetchSession(session.id); paint(); } catch { /* ignore transient */ }
  }, 8000);
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
    const allItems = sessionItems(activity);
    const raw = allItems[idx];
    // Support both new {q, image} format and old flat-string entries format.
    const label = typeof raw === 'string' ? raw : (raw?.question ?? raw?.q ?? '');   // ?? q: sesión en vuelo pre-migración
    // Image is NOT put in session state (data-URLs are heavy) — both host and
    // student already hold the full activity and read it locally by index.
    await setSessionState(session.id, {
      ql_open: idx,
      ql_question: label,
      ql_by: player.playerId,
      ql_by_name: player.name,
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
    const selector = activity.template === 'wheel' ? 'wheel' : (activity.rules?.selector || 'boxes');
    if (selector === 'wheel') return paintQuestionLiveWheel();
    return paintQuestionLiveBoxes();
  }

  function paintQuestionLiveBoxes() {
    const qlOpen     = session.ql_open ?? null;
    const qlQuestion = session.ql_question ?? null;
    const allItems0  = sessionItems(activity);
    const qlImage    = qlOpen !== null ? (typeof allItems0[qlOpen] === 'object' ? allItems0[qlOpen]?.image || null : null) : null;
    const qlPoints   = session.ql_points || {};
    const qlBy       = session.ql_by ?? null;
    const allItems   = sessionItems(activity);
    const cols       = Math.min(4, Math.max(2, Math.ceil(allItems.length / 2)));
    const iMine      = qlBy === player.playerId;
    const canPick    = qlOpen === null; // only 1 box open at a time

    const boxesHtml = allItems.map((_, idx) => {
      const isDone = qlPoints[idx] != null;
      const isOpen = qlOpen === idx;
      const color  = QL_COLORS[idx % QL_COLORS.length];
      let style, cls = 'ql-sbox';
      if (isDone)      { style = `background:#198754;`; cls += ' ql-done'; }
      else if (isOpen) { style = `background:#fff;border:3px solid ${color};`; cls += ' ql-open'; }
      else             style = `background:${color};`;
      const clickable = !isDone && canPick && !isOpen;
      return `<button class="${cls}" data-idx="${idx}" ${!clickable ? 'disabled' : ''} style="${style};border-radius:8px;cursor:${clickable?'pointer':'default'}">
        ${isDone
          ? `<span>+${qlPoints[idx]}</span>`
          : isOpen ? `<span style="color:#1f2937;font-weight:700">${idx + 1}</span>` : `<b>${idx + 1}</b>`}
      </button>`;
    }).join('');

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
    const qlImage    = qlOpen !== null ? (typeof allItems[qlOpen] === 'object' ? allItems[qlOpen]?.image || null : null) : null;
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
    const dur = 3500;
    const target = pickIndex(count);
    const realIdx = available[target];
    const arc = 360 / count;
    const SPIN_TURNS = 5;
    // Spin forward from the current angle; pointer is on the left (−90°).
    const base = Math.ceil((qlRotation + 1) / 360) * 360;
    qlRotation = base + 360 * SPIN_TURNS + (360 - (target * arc + arc / 2)) - 90;

    const svg = rootEl()?.querySelector('.ql-wheel svg');
    const btn = rootEl()?.querySelector('#ql-spin');
    if (btn) btn.disabled = true;
    if (svg) {
      svg.style.transition = `transform ${dur}ms cubic-bezier(.17,.67,.21,.99)`;
      svg.getBoundingClientRect?.(); // force reflow so the transition fires
      svg.style.transform = `rotate(${qlRotation}deg)`;
    }

    // ctx.setTimeout: si el alumno abandona la vista mientras gira la ruleta, este
    // callback ESCRIBE en el servidor (qlOpenQuestion → setSessionState). Con
    // setTimeout desnudo disparaba tras navegar; ctx lo cancela en disposeAll.
    ctx.setTimeout(async () => {
      qlSpinning = false;
      qlRotation = ((qlRotation % 360) + 360) % 360;
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
    lastQuestionShownAt = Date.now();
    const deadlineMs = session.deadline ? new Date(session.deadline).getTime() : 0;
    // MISMO default que el host (hostLive.js timerSec = max(5, questionTimer||20)):
    // antes, sin `questionTimer` definido, total=0 → el alumno NO veía cuenta atrás
    // aunque el host liquidara a los 20 s. Ahora el reloj del alumno coincide con
    // la ventana real del deadline del servidor.
    const total = Math.max(5, activity?.live?.questionTimer || 20) * 1000;
    // The DEVICE renders the round via the template contract (same as VS),
    // so every template — quiz, tildes, comas, math… — works without a
    // per-template branch here. The host's projector shows the prompt.
    const tpl = getTemplate(activity.template);
    const payload = tpl.getRoundPayload ? tpl.getRoundPayload(activity, { itemIndex: idx }) : item;
    mount(rootSel, html`
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-info text-dark">Pregunta ${idx+1} / ${items.length}</span>
        ${streak >= 2 ? `<span class="badge bg-warning text-dark fs-5">🔥 ${streak}</span>` : ''}
        <span id="s-time" class="badge bg-warning text-dark fs-5"></span>
      </div>
      <div class="progress mb-3" style="height:6px"><div id="s-bar" class="progress-bar bg-warning" style="width:100%"></div></div>
      <div id="s-round"></div>
    `);
    let sent = false;
    tpl.renderRound(document.getElementById('s-round'), payload, {
      mode: 'live',
      onSubmit: async (value) => {
        if (sent) return;
        sent = true;
        const ms = Date.now() - lastQuestionShownAt;
        const r = await queuedSubmit(session.id, player.playerId, idx, value, ms);
        emitGame(GameEvents.PLAYER_ANSWERED, { idx });
        paintWaiting(r.queued ? 'Respuesta guardada (sin red). Se enviará al reconectar.' : '¡Respuesta enviada!');
      }
    });

    if (questionTickHandle) clearInterval(questionTickHandle);
    if (deadlineMs) {
      questionTickHandle = ctx.setInterval(() => {
        if (session.phase !== 'question') { clearInterval(questionTickHandle); questionTickHandle = null; return; }
        const remain = Math.max(0, deadlineMs - Date.now());
        const pct = Math.max(0, Math.min(100, 100 * remain / total));
        const t = document.getElementById('s-time');
        const b = document.getElementById('s-bar');
        if (t) t.textContent = `${Math.ceil(remain / 1000)}s`;
        if (b) b.style.width = pct + '%';
        if (remain <= 0) { clearInterval(questionTickHandle); questionTickHandle = null; }
      }, 250);
    }
  }

  async function paintRevealOwn() {
    const idx = session.current_item;
    const own = await getOwnAnswer(session.id, player.playerId, idx);
    const ok = own?.correct === true;
    const skipped = !own;
    // Bump streak ONCE per item. No per-question sounds or confetti in live
    // mode — celebration happens only at the end. Subsequent paints for the
    // same idx (caused by unrelated session UPDATEs) skip the side effects.
    if (own && !revealedItems.has(idx)) {
      revealedItems.add(idx);
      myScore += own.points || 0;
      Streaks.bump(session.id, player.playerId, ok);
    }
    const streak = Streaks.get(session.id, player.playerId);
    mount(rootSel, html`
      <div class="text-center py-5">
        ${skipped
          ? `<i class="bi bi-dash-circle display-1 text-secondary"></i><h2 class="mt-3">Sin respuesta</h2>`
          : ok
            ? `<i class="bi bi-check-circle-fill display-1 text-success"></i><h2 class="mt-3">¡Correcto!</h2>`
            : `<i class="bi bi-x-circle-fill display-1 text-danger"></i><h2 class="mt-3">Incorrecto</h2>`}
        <p class="lead">+${own?.points || 0} puntos</p>
        ${ok && streak >= 2 ? `<p class="h4">🔥 Racha de ${streak}</p>` : ''}
      </div>
    `);
  }

  function paintRace() {
    const allItems = sessionItems(activity);
    const tpl = getTemplate(activity.template);

    if (raceQueue === null) {
      raceQueue = allItems.map((_, i) => i);
      raceCorrectCount = 0;
      raceFirstSent = new Set();
    }

    if (raceQueue.length === 0) {
      mount(rootSel, html`
        <div class="text-center py-5">
          <i class="bi bi-trophy-fill display-1 text-warning"></i>
          <h2 class="mt-3">¡Terminaste!</h2>
          <p class="lead">${raceCorrectCount} / ${allItems.length} correctas</p>
          <p class="text-muted">Esperando que el profesor cierre la carrera…</p>
          <div class="spinner-border text-warning mt-2"></div>
        </div>
      `);
      return;
    }

    const idx = raceQueue[0];
    const payload = tpl.getRoundPayload ? tpl.getRoundPayload(activity, { itemIndex: idx }) : allItems[idx];
    const streak = Streaks.get(session.id, player.playerId);
    lastQuestionShownAt = Date.now();
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
        const ms = Date.now() - lastQuestionShownAt;

        // Score locally (activity_snap contains full answers on PocketBase).
        let ok = false;
        let pts = 0;
        try {
          const r = tpl.scoreSubmission({ value, item: allItems[idx], msTaken: ms, activity, mode: 'live' });
          ok = !!r.correct;
          pts = r.points || 0;
        } catch { /* keep ok=false if activity_snap lacks answers */ }

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

        // Analítica opción A: el PRIMER intento de cada ítem (bien o mal) se envía
        // SIEMPRE → captura v0/c0 (el error real) para el análisis de clase. Los
        // reintentos posteriores solo se envían si son CORRECTOS, para avanzar el
        // progreso del host. submitRaceAttempt no cambia el juego: preserva v0/c0
        // (inmutable) y solo mueve value/correct al acertar. Ver docs/handoff-analitica-items.md.
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
    try { return !!getTemplate(activity.template)?.meta?.liveBoard; } catch { return false; }
  }

  // LIVE "board" templates (Ball Sort): ONE shared board the student solves at
  // their own pace. Every move is broadcast (throttled) so the host sees the
  // board move-by-move; the final solve is sent immediately. Rides the 'race'
  // phase — lobby/podium are unchanged. The board is mounted once and kept
  // (paint() dedups identical phase keys, so host pings don't remount it).
  function paintLiveBoard() {
    const tpl = getTemplate(activity.template);
    const payload = tpl.getRoundPayload ? tpl.getRoundPayload(activity, { itemIndex: 0 }) : null;
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
      lastSent = Date.now();
      pendingSnap = null;
      submitProgress(session.id, player.playerId, snap).catch(() => {});
    };
    const onProgress = (snap) => {
      if (solved) return;
      const now = Date.now();
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
        toast('¡Resuelto! Espera a que el profesor cierre la partida.', 'success', 4000);
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
    const rankMsg  = rank === 1 ? '¡Ganaste!' : rank === 2 ? '¡Segundo lugar!' : rank === 3 ? '¡Tercer lugar!' : '¡Fin de la partida!';
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
