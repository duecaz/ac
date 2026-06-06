// Async assignment: student plays SOLO at their own pace.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { findAssignmentByCode, countOwnAttempts, recordAttempt } from '../core/assignmentsTransport.js';
import { isAcceptableNickname } from '../core/nicknameFilter.js';
import { getTemplate } from '../core/registry.js';
import { ensureIdentity } from '../core/identity.js';
import { runPlayer } from '../core/player.js';

const NICK_KEY = 'ww.nick';

export async function renderTask(rootSel, code) {
  await ensureIdentity();
  const t = await findAssignmentByCode(code);
  if (!t) { mount(rootSel, html`<div class="alert alert-warning m-3">Tarea no encontrada.</div>`); return; }
  if (t.status === 'closed') { mount(rootSel, html`<div class="alert alert-secondary m-3">Esta tarea está cerrada.</div>`); return; }
  if (t.due_at && new Date(t.due_at) < new Date()) {
    mount(rootSel, html`<div class="alert alert-danger m-3">Esta tarea venció el ${escapeHtml(new Date(t.due_at).toLocaleString())}.</div>`);
    return;
  }

  const taken = await countOwnAttempts(t.id);
  if (taken >= t.max_attempts) {
    mount(rootSel, html`<div class="alert alert-info m-3">Ya usaste tus ${t.max_attempts} intento(s) en esta tarea.</div>`);
    return;
  }

  // Nickname gate.
  let nick = localStorage.getItem(NICK_KEY) || '';
  if (!isAcceptableNickname(nick).ok) nick = '';
  if (!nick) {
    mount(rootSel, html`
      <div class="text-center py-4" style="max-width:420px;margin:0 auto">
        <h2 class="mb-3">${escapeHtml(t.title || '')}</h2>
        <p class="text-light-50">Escribe tu nombre para comenzar:</p>
        <input id="f-nick" class="form-control form-control-lg text-center mb-3" placeholder="Tu apodo">
        <button id="btn-go" class="btn btn-warning btn-lg w-100">Empezar</button>
        <div id="err" class="text-danger mt-3"></div>
      </div>
    `);
    on(rootSel, 'click', '#btn-go', () => {
      const v = document.getElementById('f-nick').value.trim();
      const f = isAcceptableNickname(v);
      if (!f.ok) { document.getElementById('err').textContent = 'Apodo: ' + f.reason; return; }
      localStorage.setItem(NICK_KEY, f.value);
      renderTask(rootSel, code);
    });
    return;
  }

  // Run SOLO player and record attempt at finish.
  const activity = t.activity_snap;
  const tpl = getTemplate(activity.template);
  if (!tpl) { mount(rootSel, html`<div class="alert alert-danger m-3">Plantilla no soportada: ${escapeHtml(activity.template)}</div>`); return; }

  await runPlayer(rootSel, activity, {
    onFinish: (state) => {
      const max = activity.scoring?.maxScore || ((activity.scoring?.pointsPerCorrect || 1) * activity.content.items.length);
      const timeUsed = Math.round((Date.now() - state.startedAt) / 1000);
      recordAttempt(t.id, t.activity_id, nick, state.score, max, timeUsed).catch(e => console.warn('record failed', e.message));
    }
  });
}
