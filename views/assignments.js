import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { get } from '../core/storage.js';
import { createAssignment, listAssignmentsForActivity, listAttempts, closeAssignment } from '../core/transport/assignments.js';
import { toast, confirmModal } from '../core/toast.js';

const STUDENT_BASE = location.origin + location.pathname.replace(/teacher\.html.*/, 'student.html');

export async function renderAssignmentsForActivity(rootSel, activityId) {
  const a = get(activityId);
  if (!a) { mount(rootSel, html`<div class="alert alert-warning">Actividad no encontrada.</div>`); return; }

  async function refresh() {
    const items = await listAssignmentsForActivity(activityId);
    paint(items);
  }

  function paint(items) {
    mount(rootSel, html`
      <a href="#/home" class="btn btn-link"><i class="bi bi-arrow-left"></i> Inicio</a>
      <h2 class="mb-3"><i class="bi bi-clipboard-check"></i> Tareas — ${escapeHtml(a.title)}</h2>

      <div class="card mb-4"><div class="card-body">
        <h5>Crear tarea</h5>
        <div class="row g-2">
          <div class="col-md-4"><input id="t-title" class="form-control" placeholder="Título (opcional)"></div>
          <div class="col-md-4"><input id="t-due" type="datetime-local" class="form-control"></div>
          <div class="col-md-2"><input id="t-max" type="number" class="form-control" min="1" value="1" title="Intentos máx."></div>
          <div class="col-md-2"><button id="t-create" class="btn btn-primary w-100"><i class="bi bi-plus-lg"></i> Crear</button></div>
        </div>
      </div></div>

      ${items.length === 0 ? `<p class="text-muted">No hay tareas todavía.</p>` : `
        <div class="list-group">
          ${items.map(t => {
            const url = `${STUDENT_BASE}#/task/${t.code}`;
            const due = t.due_at ? new Date(t.due_at).toLocaleString() : 'sin fecha límite';
            const past = t.due_at && new Date(t.due_at) < new Date();
            return `
              <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-start">
                  <div>
                    <div><b>${escapeHtml(t.title || a.title)}</b>
                      ${t.status === 'closed' ? '<span class="badge bg-secondary ms-2">cerrada</span>' :
                        past ? '<span class="badge bg-danger ms-2">vencida</span>' :
                        '<span class="badge bg-success ms-2">abierta</span>'}
                    </div>
                    <div class="small text-muted">PIN <code>${escapeHtml(t.code)}</code> · ${escapeHtml(due)} · máx ${t.max_attempts} intento(s)</div>
                    <div class="small"><a href="${url}" target="_blank">${url}</a></div>
                  </div>
                  <div class="d-flex gap-2">
                    <a href="#/task/${t.id}/attempts" class="btn btn-sm btn-outline-primary">Intentos</a>
                    <button class="btn btn-sm btn-outline-secondary copy" data-url="${escapeHtml(url)}"><i class="bi bi-clipboard"></i></button>
                    ${t.status !== 'closed' ? `<button class="btn btn-sm btn-outline-danger close-t" data-id="${t.id}"><i class="bi bi-x-lg"></i></button>` : ''}
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>`}
    `);

    on(rootSel, 'click', '#t-create', async () => {
      const title = document.getElementById('t-title').value.trim();
      const due = document.getElementById('t-due').value;
      const max = +document.getElementById('t-max').value || 1;
      try {
        await createAssignment(a, { title, dueAt: due ? new Date(due).toISOString() : null, maxAttempts: max });
        toast('Tarea creada.', 'success');
        refresh();
      } catch (e) { toast('Error: ' + e.message, 'danger', 5000); }
    });
    on(rootSel, 'click', '.copy', (_, b) => {
      navigator.clipboard?.writeText(b.dataset.url);
      b.innerHTML = '<i class="bi bi-check"></i>';
      setTimeout(() => b.innerHTML = '<i class="bi bi-clipboard"></i>', 1200);
    });
    on(rootSel, 'click', '.close-t', async (_, b) => {
      const ok = await confirmModal('¿Cerrar esta tarea?', { okText: 'Cerrar tarea', danger: true });
      if (!ok) return;
      await closeAssignment(b.dataset.id);
      toast('Tarea cerrada.', 'info');
      refresh();
    });
  }

  refresh();
}

export async function renderAttempts(rootSel, assignmentId) {
  const attempts = await listAttempts(assignmentId);
  mount(rootSel, html`
    <a href="#/home" class="btn btn-link"><i class="bi bi-arrow-left"></i> Inicio</a>
    <h2 class="mb-3">Intentos</h2>
    ${attempts.length === 0 ? `<p class="text-muted">Sin intentos todavía.</p>` : `
      <table class="table table-hover">
        <thead><tr><th>Alumno</th><th>Puntos</th><th>Tiempo</th><th>Fecha</th></tr></thead>
        <tbody>
          ${attempts.map(r => `
            <tr>
              <td>${escapeHtml(r.player_name || '')}</td>
              <td>${r.score_auto ?? 0} / ${r.max_score ?? '?'}</td>
              <td>${r.time_used ?? 0}s</td>
              <td>${new Date(r.created_at).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`}
  `);
}
