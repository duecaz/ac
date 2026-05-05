// Student-side live view. Routes: #/join, #/play/:code.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { joinSession, submitAnswer, getOwnAnswer, subscribeRoom, pingPresence } from '../core/transport/live.js';
import { findRoomByCode } from '../core/transport/room.js';
import { findAssignmentByCode } from '../core/transport/assignments.js';
import { isAcceptableNickname } from '../core/nicknameFilter.js';

const NICK_KEY = 'ww.nick';

export function renderJoin(rootSel, prefilledCode = '') {
  mount(rootSel, html`
    <div class="text-center py-4" style="max-width:420px;margin:0 auto">
      <h2 class="mb-4">Unirme a la sala</h2>
      <input id="f-code" class="form-control form-control-lg text-center mb-3" style="font-size:2.5rem;letter-spacing:.4rem;text-transform:uppercase" maxlength="6" placeholder="PIN" value="${escapeHtml(prefilledCode)}">
      <input id="f-nick" class="form-control form-control-lg text-center mb-3" placeholder="Tu apodo" value="${escapeHtml(localStorage.getItem(NICK_KEY) || '')}">
      <button id="btn-join" class="btn btn-warning btn-lg w-100">Entrar</button>
      <div id="err" class="text-danger mt-3"></div>
    </div>
  `);

  on(rootSel, 'click', '#btn-join', async () => {
    const code = document.getElementById('f-code').value.trim().toUpperCase();
    const nick = document.getElementById('f-nick').value.trim();
    const err = document.getElementById('err');
    err.textContent = '';
    if (code.length !== 6) { err.textContent = 'PIN inválido'; return; }
    const f = isAcceptableNickname(nick);
    if (!f.ok) { err.textContent = 'Apodo: ' + f.reason; return; }
    document.getElementById('btn-join').disabled = true;
    try {
      // Try live session first; if not found, try async assignment.
      const task = await findAssignmentByCode(code);
      if (task) {
        localStorage.setItem(NICK_KEY, f.value);
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
  const cached = sessionStorage.getItem(`ww.player.${code}`);
  if (!cached) return renderJoin(rootSel, code);
  const player = JSON.parse(cached);

  let session = null;
  let activity = null;
  let lastQuestionShownAt = 0;
  let unsub = null;
  let pingTimer = null;

  try {
    const sess = await findRoomByCode(code);
    if (!sess) { mount(rootSel, html`<div class="alert alert-warning m-3">Sala no encontrada.</div>`); return; }
    session = sess;
    activity = sess.activity_snap;
  } catch (e) {
    mount(rootSel, html`<div class="alert alert-danger m-3">${escapeHtml(e.message)}</div>`); return;
  }

  unsub = await subscribeRoom(session.id, (ev) => {
    if (ev.table === 'sessions') { session = { ...session, ...ev.new }; paint(); }
  });
  window.addEventListener('hashchange', () => { if (unsub) unsub(); if (pingTimer) clearInterval(pingTimer); }, { once: true });
  pingTimer = setInterval(() => pingPresence(player.playerId).catch(()=>{}), 15000);

  function paint() {
    if (session.status === 'lobby') return paintLobby();
    if (session.status === 'ended') return paintEnded();
    if (session.phase === 'question') return paintQuestion();
    if (session.phase === 'reveal') return paintRevealOwn();
    if (session.phase === 'leaderboard') return paintWaiting('Mira la pizarra del profesor.');
    paintWaiting('Esperando…');
  }

  function paintLobby() {
    mount(rootSel, html`
      <div class="text-center py-5">
        <h1 class="display-4">${escapeHtml(player.name)}</h1>
        <p class="lead">¡Estás dentro!</p>
        <p class="text-light">PIN: <b>${escapeHtml(code)}</b></p>
        <p class="text-light">Esperando a que el profesor empiece…</p>
        <div class="spinner-border text-warning"></div>
      </div>
    `);
  }

  async function paintQuestion() {
    const idx = session.current_item;
    const item = activity.content.items[idx];
    const own = await getOwnAnswer(session.id, player.playerId, idx);
    if (own) return paintWaiting('Respuesta enviada. Espera al resto.');
    lastQuestionShownAt = Date.now();
    const deadlineMs = session.deadline ? new Date(session.deadline).getTime() : 0;
    const total = activity?.live?.questionTimer ? activity.live.questionTimer * 1000 : 0;
    mount(rootSel, html`
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-info text-dark">Pregunta ${idx+1} / ${activity.content.items.length}</span>
        <span id="s-time" class="badge bg-warning text-dark fs-5"></span>
      </div>
      <div class="progress mb-3" style="height:6px"><div id="s-bar" class="progress-bar bg-warning" style="width:100%"></div></div>
      <h4 class="text-center mb-3">${escapeHtml(item.question)}</h4>
      <div class="ww-kahoot-grid">
        ${(item.options||[]).map((o, i) => `
          <button class="btn btn-lg ww-ans" data-value="${escapeHtml(o)}">
            <div class="small text-start opacity-75">${'ABCD'[i]}</div>
            <div>${escapeHtml(o)}</div>
          </button>`).join('')}
      </div>
    `);
    on(rootSel, 'click', '.ww-ans', async (_, btn) => {
      document.querySelectorAll('.ww-ans').forEach(b => b.disabled = true);
      btn.classList.add('border', 'border-light', 'border-3');
      const ms = Date.now() - lastQuestionShownAt;
      try {
        await submitAnswer(session.id, player.playerId, idx, btn.dataset.value, ms);
        paintWaiting('¡Respuesta enviada!');
      } catch (e) {
        document.querySelectorAll('.ww-ans').forEach(b => b.disabled = false);
        alert('Error: ' + e.message);
      }
    });

    if (deadlineMs && total) {
      const tick = setInterval(() => {
        if (session.phase !== 'question') { clearInterval(tick); return; }
        const remain = Math.max(0, deadlineMs - Date.now());
        const pct = Math.max(0, Math.min(100, 100 * remain / total));
        const t = document.getElementById('s-time');
        const b = document.getElementById('s-bar');
        if (t) t.textContent = `${Math.ceil(remain / 1000)}s`;
        if (b) b.style.width = pct + '%';
        if (remain <= 0) clearInterval(tick);
      }, 250);
    }
  }

  async function paintRevealOwn() {
    const idx = session.current_item;
    const own = await getOwnAnswer(session.id, player.playerId, idx);
    const ok = own?.correct === true;
    const skipped = !own;
    mount(rootSel, html`
      <div class="text-center py-5">
        ${skipped
          ? `<i class="bi bi-dash-circle display-1 text-secondary"></i><h2 class="mt-3">Sin respuesta</h2>`
          : ok
            ? `<i class="bi bi-check-circle-fill display-1 text-success"></i><h2 class="mt-3">¡Correcto!</h2>`
            : `<i class="bi bi-x-circle-fill display-1 text-danger"></i><h2 class="mt-3">Incorrecto</h2>`}
        <p class="lead">+${own?.points || 0} puntos</p>
      </div>
    `);
  }

  function paintWaiting(msg) {
    mount(rootSel, html`
      <div class="text-center py-5">
        <div class="spinner-border text-warning mb-3"></div>
        <p class="lead">${escapeHtml(msg)}</p>
      </div>
    `);
  }

  function paintEnded() {
    mount(rootSel, html`
      <div class="text-center py-5">
        <i class="bi bi-trophy-fill display-1 text-warning"></i>
        <h2 class="mt-3">¡Fin de la partida!</h2>
        <p class="text-light">Mira el podio en la pantalla del profesor.</p>
        <a href="#/join" class="btn btn-outline-light"><i class="bi bi-arrow-left"></i> Otra sala</a>
      </div>
    `);
  }

  paint();
}
