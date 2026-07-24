import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { get } from '../core/storage.js';
import { rowsFromAttempts, rowsFromAttempt } from '../core/answerRows.js';
import { itemStatsHtml } from './itemStatsView.js';
import { sessionTableHtml, sessionTableCsv } from './sessionTable.js';
import { getTemplate } from '../core/registry.js';
import { createAssignment, listAssignmentsForActivity, listAttempts, closeAssignment, rotateAssignmentCode } from '../core/assignmentsTransport.js';
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
        <div class="row g-2 align-items-end">
          <div class="col-md-4">
            <label class="form-label mb-1 small text-muted" for="t-title">Título (opcional)</label>
            <input id="t-title" class="form-control" placeholder="Título de la tarea">
          </div>
          <div class="col-md-4">
            <label class="form-label mb-1 small text-muted" for="t-due">Fecha límite</label>
            <input id="t-due" type="datetime-local" class="form-control">
          </div>
          <div class="col-md-2">
            <label class="form-label mb-1 small text-muted" for="t-max"><i class="bi bi-arrow-repeat"></i> Intentos máximos</label>
            <input id="t-max" type="number" class="form-control" min="1" value="${a.presentation?.taskMaxAttempts || 1}">
          </div>
          <div class="col-md-2">
            <button id="t-create" class="btn btn-primary w-100"><i class="bi bi-plus-lg"></i> Crear</button>
          </div>
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
                  <div class="d-flex gap-2 flex-wrap">
                    <a href="#/task/${t.id}/attempts" class="btn btn-sm btn-outline-primary">Intentos</a>
                    <button class="btn btn-sm btn-outline-secondary copy" data-url="${escapeHtml(url)}" title="Copiar URL"><i class="bi bi-clipboard"></i></button>
                    ${t.status !== 'closed' ? `<button class="btn btn-sm btn-outline-success gclass" data-url="${escapeHtml(url)}" data-title="${escapeHtml(t.title || a.title)}" data-due="${escapeHtml(t.due_at || '')}" title="Enviar a Google Classroom"><i class="bi bi-google"></i> Classroom</button>` : ''}
                    ${t.status !== 'closed' ? `<button class="btn btn-sm btn-outline-warning rotate-t" data-id="${t.id}" title="Rotar PIN"><i class="bi bi-arrow-repeat"></i></button>` : ''}
                    ${t.status !== 'closed' ? `<button class="btn btn-sm btn-outline-danger close-t" data-id="${t.id}" title="Cerrar tarea"><i class="bi bi-x-lg"></i></button>` : ''}
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
    on(rootSel, 'click', '.gclass', async (_, b) => {
      const { listCourses, createCourseworkLink } = await import('../core/classroom.js');
      const { pickCourse } = await import('../core/coursePicker.js');
      b.disabled = true;
      try {
        const courses = await listCourses();
        if (!courses.length) { toast('No tienes cursos activos en Classroom (o tu sesión no ve ninguno).', 'info', 5000); return; }
        const courseId = await pickCourse(courses);
        if (!courseId) return;
        const res = await createCourseworkLink(courseId, {
          title: b.dataset.title,
          description: 'Abre el enlace para hacer la actividad en AulaReto.',
          link: b.dataset.url,
          dueAt: b.dataset.due || null,
        });
        toast('Tarea publicada en Classroom ✓', 'success', 4000);
        if (res.link) window.open(res.link, '_blank');
      } catch (e) {
        toast('Classroom: ' + (e.message || 'no se pudo enviar'), 'danger', 7000);
      } finally { b.disabled = false; }
    });
    on(rootSel, 'click', '.rotate-t', async (_, b) => {
      const ok = await confirmModal('¿Rotar el PIN? El antiguo dejará de funcionar.', { okText: 'Rotar', danger: false });
      if (!ok) return;
      try {
        const code = await rotateAssignmentCode(b.dataset.id);
        toast(`PIN nuevo: ${code}`, 'success', 4000);
        refresh();
      } catch (e) { toast('Error rotando PIN: ' + e.message, 'danger'); }
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

const itemsOf = (a) => { const c = a?.content || {}; return c.items ?? c.entries ?? c.pairs ?? c.groups ?? c.words ?? c.passages ?? []; };

export async function renderAttempts(rootSel, assignmentId) {
  const attempts = await listAttempts(assignmentId);
  const activityId = attempts.find(a => a.activity_id)?.activity_id;
  const activity = activityId ? get(activityId) : null;
  const items = activity ? itemsOf(activity) : [];
  const T = activity ? getTemplate(activity.template) : null;
  const labels = items.map((it, i) => { try { return T?.itemLabel?.(it) || `Pregunta ${i + 1}`; } catch { return `Pregunta ${i + 1}`; } });
  const hasDetail = attempts.some(a => Array.isArray(a.answers) && a.answers.length);
  const isText = T?.meta?.contentModel === 'textCorrection';

  // Agrupa por alumno (nombre): nº intentos, MEJOR puntaje, último intento/tiempo.
  const byName = new Map();
  for (const a of attempts) { const k = a.player_name || '—'; (byName.get(k) || byName.set(k, []).get(k)).push(a); }
  const students = [...byName.entries()].map(([name, atts]) => {
    const sorted = atts.slice().sort((x, y) => (y.created_at || '').localeCompare(x.created_at || ''));
    const best = Math.max(...atts.map(a => a.score_auto ?? 0));
    const bestA = atts.find(a => (a.score_auto ?? 0) === best) || sorted[0];
    return { name, count: atts.length, best, max: bestA?.max_score, lastAt: sorted[0]?.created_at, time: sorted[0]?.time_used, attempts: sorted };
  }).sort((a, b) => b.best - a.best);

  const nStudents = students.length;
  const nAttempts = attempts.length;
  const avgBest = nStudents ? Math.round(students.reduce((s, x) => s + (x.best || 0), 0) / nStudents) : 0;
  // Ítem más fallado (de la analítica, si hay detalle).
  let worst = null;
  if (hasDetail && activity) {
    try {
      const { aggregate } = await import('../core/itemStats.js');
      const st = aggregate({ items, template: T, rows: rowsFromAttempts(attempts), activity });
      worst = st.items.filter(i => i.n).sort((a, b) => a.pctCorrect - b.pctCorrect)[0] || null;
    } catch {}
  }

  const studentsTable = `<div class="st-wrap"><table class="st-table">
    <thead><tr><th class="st-name">Alumno</th><th>Intentos</th><th>Mejor</th><th>Tiempo</th><th>Último</th>${hasDetail ? '<th></th>' : ''}</tr></thead>
    <tbody>${students.map((s, i) => `<tr>
      <td class="st-name">${i < 3 ? ['🥇','🥈','🥉'][i] + ' ' : ''}${escapeHtml(s.name)}</td>
      <td>${s.count}</td>
      <td><b>${s.best}</b>${s.max ? ` / ${s.max}` : ''}</td>
      <td>${s.time ?? '—'}s</td>
      <td class="small text-muted">${s.lastAt ? new Date(s.lastAt).toLocaleString() : '—'}</td>
      ${hasDetail ? `<td><button class="btn btn-sm btn-outline-primary st-who" data-name="${escapeHtml(s.name)}"><i class="bi bi-person-lines-fill"></i> Ver</button></td>` : ''}
    </tr>`).join('')}</tbody></table></div>`;

  mount(rootSel, html`
    <a href="#/home" class="btn btn-link"><i class="bi bi-arrow-left"></i> Inicio</a>
    <h2 class="mb-2">Intentos${activity ? ` — ${escapeHtml(activity.title || '')}` : ''}</h2>
    ${attempts.length === 0 ? `<p class="text-muted">Sin intentos todavía.</p>` : `
      <div class="row g-2 mb-3" style="max-width:640px">
        <div class="col-4"><div class="card text-center"><div class="card-body p-2"><div class="small text-muted">Alumnos</div><div class="h4 mb-0">${nStudents}</div></div></div></div>
        <div class="col-4"><div class="card text-center"><div class="card-body p-2"><div class="small text-muted">Intentos</div><div class="h4 mb-0">${nAttempts}</div></div></div></div>
        <div class="col-4"><div class="card text-center"><div class="card-body p-2"><div class="small text-muted">Media (mejor)</div><div class="h4 mb-0">${avgBest}</div></div></div></div>
      </div>
      ${worst ? `<p class="small"><i class="bi bi-exclamation-triangle text-warning"></i> Ítem más fallado: <b>${escapeHtml(worst.label)}</b> (${Math.round(worst.pctCorrect * 100)}% acierto)</p>` : ''}

      <div class="ll-tabs">
        <button class="ll-tab is-active" data-tab="alumnos"><i class="bi bi-people"></i> Alumnos</button>
        <button class="ll-tab" data-tab="tabla"><i class="bi bi-table"></i> Tabla</button>
        ${hasDetail ? `<button class="ll-tab" data-tab="item"><i class="bi bi-bar-chart-line-fill"></i> Por ${isText ? 'palabra' : 'ítem'}</button>` : ''}
      </div>
      <div id="at-tabout" class="mt-1"></div>
      <div class="mt-3"><button id="at-csv" class="btn btn-outline-success btn-sm"><i class="bi bi-download"></i> Exportar CSV</button></div>`}
  `);

  if (!attempts.length) return;
  const out = document.getElementById('at-tabout');
  const rows = rowsFromAttempts(attempts);
  function showTab(tab) {
    document.querySelectorAll('.ll-tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
    if (tab === 'alumnos') out.innerHTML = studentsTable;
    else if (tab === 'tabla') out.innerHTML = activity ? sessionTableHtml(rows, items.length, { labels, items, template: T }) : '<p class="text-muted">Sin actividad local para la tabla.</p>';
    else out.innerHTML = (activity && hasDetail) ? itemStatsHtml(activity, rows) : '<p class="text-muted small">Sin detalle por ítem (crea el campo <code>answers</code> en #/admin).</p>';
  }
  document.querySelectorAll('.ll-tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  // B2 — ficha por alumno: su heatmap individual.
  on(rootSel, 'click', '.st-who', (_, b) => {
    const name = b.dataset.name;
    const mine = attempts.filter(a => (a.player_name || '—') === name);
    const myRows = mine.flatMap(rowsFromAttempt);
    out.innerHTML = `<div class="mb-2"><button class="btn btn-sm btn-link" id="at-back"><i class="bi bi-arrow-left"></i> Volver</button> <b>${escapeHtml(name)}</b></div>`
      + ((activity && myRows.length) ? itemStatsHtml(activity, myRows) : '<p class="text-muted">Sin detalle de este alumno.</p>');
    document.getElementById('at-back')?.addEventListener('click', () => showTab('alumnos'));
    document.querySelectorAll('.ll-tab').forEach(x => x.classList.remove('is-active'));
  });
  document.getElementById('at-csv')?.addEventListener('click', () => {
    const csv = activity ? sessionTableCsv(rows, items.length, { labels, items, template: T }) : '';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `tarea-intentos.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  showTab('alumnos');
}
