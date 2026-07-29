// Async assignment: student plays SOLO at their own pace.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { findAssignmentByCode, countOwnAttempts, recordAttempt } from '../core/assignmentsTransport.js';
import { isAcceptableNickname } from '../core/nicknameFilter.js';
import { getTemplate } from '../core/registry.js';
import { ensureIdentity } from '../core/identity.js';
import { runPlayer } from '../core/player.js';
import { packAnswers } from '../core/answerDetail.js';
import { activityItemCount } from '../core/migrate.js';
import { assignmentGate } from '../core/assignmentRules.js';
import { defaultMaxScore } from '../core/scoring/index.js';
import { lsGet, lsSet } from '../core/ls.js';
import { clock } from '../core/clock.js';

const NICK_KEY = 'ww.nick';

export async function renderTask(rootSel, code) {
  await ensureIdentity();
  const t = await findAssignmentByCode(code);
  if (!t) { mount(rootSel, html`<div class="alert alert-warning m-3">Tarea no encontrada.</div>`); return; }
  // Quién puede entregar lo decide UN solo sitio: core/assignmentRules.js (puro,
  // testeado, con reloj inyectable). Esta vista lo reimplementaba a mano y además
  // discrepaba: trataba `max_attempts` nulo como ILIMITADO mientras el módulo lo
  // trata como 1 — dos verdades sobre quién puede entregar.
  const taken = await countOwnAttempts(t.id);
  const gate = assignmentGate(t, taken);
  if (!gate.allowed) {
    const msg = {
      closed:          ['secondary', 'Esta tarea está cerrada.'],
      pastDue:         ['danger',    `Esta tarea venció el ${escapeHtml(new Date(t.due_at).toLocaleString())}.`],
      noAttemptsLeft:  ['info',      `Ya usaste tus ${t.max_attempts ?? 1} intento(s) en esta tarea.`],
    }[gate.reason] || ['warning', 'Esta tarea no está disponible.'];
    mount(rootSel, html`<div class="alert alert-${msg[0]} m-3">${msg[1]}</div>`);
    return;
  }

  // Nickname gate.
  let nick = lsGet(NICK_KEY) || '';
  if (!isAcceptableNickname(nick).ok) nick = '';
  if (!nick) {
    const attemptsInfo = t.max_attempts != null && t.max_attempts > 1
      ? `<p class="text-muted small mb-0 mt-2">Intento ${taken + 1} de ${t.max_attempts}</p>` : '';
    mount(rootSel, html`
      <div class="text-center py-4" style="max-width:420px;margin:0 auto">
        <h2 class="mb-1">${escapeHtml(t.title || '')}</h2>
        ${attemptsInfo}
        <p class="text-muted mt-3 mb-1">Escribe tu nombre para comenzar:</p>
        <input id="f-nick" class="form-control form-control-lg text-center mb-3" placeholder="Tu apodo">
        <button id="btn-go" class="btn btn-warning btn-lg w-100">Empezar</button>
        <div id="err" class="text-danger mt-3"></div>
      </div>
    `);
    on(rootSel, 'click', '#btn-go', () => {
      const v = document.getElementById('f-nick').value.trim();
      const f = isAcceptableNickname(v);
      if (!f.ok) { document.getElementById('err').textContent = 'Apodo: ' + f.reason; return; }
      lsSet(NICK_KEY, f.value);
      renderTask(rootSel, code);
    });
    return;
  }

  // Pre-start screen — always shown so the student sees attempt info before playing.
  const maxAttempts = t.max_attempts ?? null;
  const left = maxAttempts != null ? maxAttempts - taken : null;
  const badgeHtml = maxAttempts === 1
    ? `<span class="badge bg-secondary fs-6">1 intento</span>`
    : maxAttempts == null
    ? `<span class="badge bg-secondary fs-6">Intento ${taken + 1}</span>`
    : `<span class="badge bg-info text-dark fs-6">Intento ${taken + 1} de ${maxAttempts} · te quedan ${left}</span>`;
  const dueHtml = t.due_at
    ? `<p class="text-muted small mb-3">Fecha límite: ${escapeHtml(new Date(t.due_at).toLocaleString())}</p>` : '';

  await new Promise(resolve => {
    mount(rootSel, html`
      <div class="text-center py-4" style="max-width:420px;margin:0 auto">
        <h2 class="mb-2">${escapeHtml(t.title || '')}</h2>
        <p class="mb-3">Hola, <b>${escapeHtml(nick)}</b></p>
        <div class="mb-3">${badgeHtml}</div>
        ${dueHtml}
        <button id="btn-start" class="btn btn-success btn-lg w-100"><i class="bi bi-play-fill"></i> Comenzar</button>
      </div>
    `);
    on(rootSel, 'click', '#btn-start', resolve);
  });

  // Run SOLO player and record attempt at finish.
  const activity = t.activity_snap;
  const tpl = getTemplate(activity.template);
  if (!tpl) { mount(rootSel, html`<div class="alert alert-danger m-3">Plantilla no soportada: ${escapeHtml(activity.template)}</div>`); return; }

  await runPlayer(rootSel, activity, {
    // 'async-tracked' hace DOS cosas en los shells: (1) results.js NO guarda una
    // fila `results` extra (el intento va a assignment_attempts vía recordAttempt
    // de abajo — sin esto cada tarea se guardaba DOBLE); (2) desactiva la
    // reanudación F5 de soloPlayer (una tarea no debe retomarse a medias:
    // recargar = intento limpio, como dicta assignmentRules).
    mode: 'async-tracked',
    onFinish: (state) => {
      // El techo y el tiempo los aporta el SHELL (ambos los calculan ya): así el
      // "X / max" que ve el alumno y el que se registra son el mismo número.
      // El respaldo usa la fórmula común (nunca una copia local).
      const max = state.maxScore ?? defaultMaxScore(activity, activityItemCount(activity));
      const timeUsed = state.timeUsed ?? Math.round((clock.now() - (state.startedAt ?? clock.now())) / 1000);
      // Detalle por ítem para la analítica del docente (F3). Degrada a [] si el
      // player no lo expone (freeform sin detalle) → el informe usa agregados.
      const answers = packAnswers(state.answers || []);
      recordAttempt(t.id, t.activity_id, nick, state.score, max, timeUsed, answers).catch(e => console.warn('record failed', e.message));
      // Override the template's own finish screen (which links to #/home — a
      // teacher-only route absent from the student app, hence "ruta no
      // encontrada"). Show a student-safe completion screen instead.
      mount(rootSel, html`
        <div class="text-center py-5">
          <i class="bi bi-check-circle-fill display-1 text-success"></i>
          <h2 class="mt-3">¡Tarea enviada!</h2>
          <p class="lead">Puntos: <b>${state.score}</b> / ${max}</p>
          <p class="text-muted">Tu profe verá tu resultado. Ya puedes cerrar esta página.</p>
          <a href="#/join" class="btn btn-primary"><i class="bi bi-arrow-left"></i> Volver</a>
        </div>`);
    }
  });
}
