// Página ADMIN (protegida con usuario + contraseña). Reúne TODO en un sitio:
// detalles del sistema, la matriz de modos/compatibilidad (core/modeMatrix.js) y
// los self-tests EJECUTABLES (core/selftest.js, con simulación de alumnos
// virtuales VS y En vivo). El login es un candado simple del lado cliente
// (sessionStorage), no seguridad real — la protección de datos es la RLS.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { VERSION } from '../core/constants.js';
import { backendName } from '../adapters/index.js';
import { MODE_DEFS } from '../core/modes.js';
import { templateCapabilities, activityAvailability, CONTRACT_METHODS } from '../core/modeMatrix.js';
import { list, remove } from '../core/storage.js';
import { confirmModal, toast } from '../core/toast.js';
import { activityItemCount } from '../core/migrate.js';
import { runSelfTests } from '../core/selftest.js';
import { canConvert } from '../kernel/content/convert.js';

const ADMIN_PASSWORD = 'fernando';
const SESSION_KEY = 'ww.admin.ok';
const yes = '<span class="text-success fw-bold">✓</span>';
const no = '<span class="text-muted">·</span>';
const mark = (b) => (b ? yes : no);

function isUnlocked() {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}

export function renderAdmin(rootSel) {
  if (!isUnlocked()) return renderGate(rootSel);
  renderPanel(rootSel);
}

function renderGate(rootSel) {
  mount(rootSel, html`
    <div class="container py-5" style="max-width:420px">
      <a href="#/home" class="btn btn-sm btn-link p-0 mb-2"><i class="bi bi-arrow-left"></i> Inicio</a>
      <div class="card shadow-sm"><div class="card-body">
        <h4 class="mb-3"><i class="bi bi-shield-lock"></i> Panel de administración</h4>
        <p class="text-muted small">Introduce la contraseña para ver detalles del sistema y ejecutar los tests.</p>
        <input id="admin-pass" type="password" class="form-control mb-2" placeholder="Contraseña" autofocus>
        <button id="admin-go" class="btn btn-primary w-100">Entrar</button>
        <div id="admin-err" class="text-danger small mt-2"></div>
      </div></div>
    </div>`);
  const submit = () => {
    const v = document.getElementById('admin-pass')?.value || '';
    if (v === ADMIN_PASSWORD) {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
      renderPanel(rootSel);
    } else {
      const err = document.getElementById('admin-err');
      if (err) err.textContent = 'Contraseña incorrecta.';
    }
  };
  on(rootSel, 'click', '#admin-go', submit);
  on(rootSel, 'keydown', '#admin-pass', (e) => { if (e.key === 'Enter') submit(); });
}

function renderPanel(rootSel) {
  const caps = templateCapabilities();
  const acts = list();
  const avail = activityAvailability(acts);
  const countById = Object.fromEntries(acts.map(a => [a.id, activityItemCount(a)]));

  const conv = caps.map(src => ({
    label: src.label, color: src.color, icon: src.icon,
    targets: caps.filter(dst => dst.name !== src.name && canConvert(src.contentModel, dst.contentModel))
      .map(dst => ({ label: dst.label, kind: dst.contentModel === src.contentModel ? 'directo' : 'conversión' })),
  }));
  const convRows = conv.map(c => `<tr>
      <td><span class="badge bg-${c.color || 'secondary'}"><i class="bi ${c.icon}"></i> ${escapeHtml(c.label)}</span></td>
      <td>${c.targets.length ? c.targets.map(t => `<span class="badge ${t.kind === 'directo' ? 'bg-success' : 'bg-info'} me-1 mb-1">${escapeHtml(t.label)} · ${t.kind}</span>`).join('') : '<span class="text-muted">—</span>'}</td>
    </tr>`).join('');

  const capRows = caps.map(c => `
    <tr>
      <td><span class="badge bg-${c.color || 'secondary'}"><i class="bi ${c.icon}"></i> ${escapeHtml(c.label)}</span>
        <div class="small text-muted">${escapeHtml(c.name)} · ${escapeHtml(c.contentModel || '—')}</div></td>
      ${c.modes.map(m => `<td class="text-center" title="${escapeHtml(m.reason)}">${mark(m.supported)}</td>`).join('')}
      ${CONTRACT_METHODS.map(me => `<td class="text-center">${mark(c.methods[me])}</td>`).join('')}
    </tr>`).join('');

  const actRows = avail.map(r => `
    <tr>
      <td>${escapeHtml(r.title)}<div class="small text-muted">${escapeHtml(r.template)} · ${countById[r.id] ?? 0} elementos</div></td>
      ${r.modes.map(m => `<td class="text-center">${mark(m.available)}</td>`).join('')}
      <td><a class="btn btn-sm btn-outline-primary" href="#/play/${r.id}">Abrir</a></td>
    </tr>`).join('');

  mount(rootSel, html`
    <div class="container py-3">
      <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <a href="#/home" class="btn btn-sm btn-link p-0"><i class="bi bi-arrow-left"></i> Inicio</a>
        <button id="admin-lock" class="btn btn-sm btn-outline-secondary"><i class="bi bi-lock"></i> Bloquear</button>
      </div>
      <h3><i class="bi bi-shield-lock"></i> Panel de administración</h3>

      <h5 class="mt-3">Sistema</h5>
      <table class="table table-sm w-auto">
        <tbody>
          <tr><th class="pe-3">Versión</th><td>v${escapeHtml(VERSION)}</td></tr>
          <tr><th class="pe-3">Backend</th><td>${escapeHtml(backendName())}</td></tr>
          <tr><th class="pe-3">Plantillas</th><td>${caps.length}</td></tr>
          <tr><th class="pe-3">Actividades (locales)</th><td>${acts.length}</td></tr>
        </tbody>
      </table>

      <h5 class="mt-4">Mantenimiento</h5>
      <button id="admin-wipe" class="btn btn-outline-danger"><i class="bi bi-trash"></i> Borrar TODAS mis actividades (este dispositivo + nube)</button>
      <p class="small text-muted mt-1">Empieza de cero. No se puede deshacer. Mantiene tu identidad (no hace falta borrar la caché).</p>

      <h5 class="mt-4">Tests <small class="text-muted">(humo en vivo; la suite completa es <code>node tests/run.mjs</code>)</small></h5>
      <button id="admin-run" class="btn btn-success"><i class="bi bi-play-circle"></i> Ejecutar tests</button>
      <div id="admin-tests" class="mt-2"></div>

      <h5 class="mt-4">Capacidad por plantilla <small class="text-muted">(¿qué modos puede ofrecer?)</small></h5>
      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle">
          <thead class="table-light"><tr><th>Plantilla</th>
            ${MODE_DEFS.map(m => `<th class="text-center" title="${escapeHtml(m.label)}">${escapeHtml(m.short)}</th>`).join('')}
            ${CONTRACT_METHODS.map(me => `<th class="text-center small">${me.replace('render', 'r·').replace('Submission', '')}</th>`).join('')}
          </tr></thead>
          <tbody>${capRows}</tbody>
        </table>
      </div>
      <p class="small text-muted">Pasa el cursor sobre una celda de modo para ver el motivo. La derecha = métodos del contrato implementados.</p>

      <h5 class="mt-4">Tus actividades <small class="text-muted">(modos disponibles ahora)</small></h5>
      ${acts.length ? `<div class="table-responsive"><table class="table table-sm table-bordered align-middle">
        <thead class="table-light"><tr><th>Actividad</th>${MODE_DEFS.map(m => `<th class="text-center">${escapeHtml(m.short)}</th>`).join('')}<th></th></tr></thead>
        <tbody>${actRows}</tbody></table></div>` : '<p class="text-muted">No hay actividades guardadas.</p>'}

      <h5 class="mt-4">Conversiones de formato <small class="text-muted">(¿a qué puede cambiar cada plantilla conservando el contenido?)</small></h5>
      <div class="table-responsive"><table class="table table-sm table-bordered align-middle">
        <thead class="table-light"><tr><th>Plantilla</th><th>Puede convertirse a</th></tr></thead>
        <tbody>${convRows}</tbody></table></div>
      <div class="small text-muted">
        <b>directo</b> = mismo modelo de contenido (no transforma). <b>conversión</b> = transforma el contenido (puede perder datos).<br>
        <b>Matemáticas ⇄ Quiz</b> (modelo <code>qa</code>): de <b>Matemáticas → Quiz</b> se generan opciones automáticamente
        (la respuesta + distractores numéricos); de <b>Quiz → Matemáticas</b> se conserva pregunta y respuesta y se quitan las opciones.
        Reglas en <code>kernel/content/qaAdapt.js</code> · grafo por modelo en <code>kernel/content/convert.js</code>.
      </div>
    </div>`);

  on(rootSel, 'click', '#admin-lock', () => { try { sessionStorage.removeItem(SESSION_KEY); } catch {} renderGate(rootSel); });
  on(rootSel, 'click', '#admin-wipe', async () => {
    const ok = await confirmModal('¿Borrar TODAS tus actividades de este dispositivo y de la nube? No se puede deshacer.', { okText: 'Borrar todo', danger: true });
    if (!ok) return;
    const ids = list().map(a => a.id);
    for (const id of ids) { try { await remove(id); } catch {} }
    toast(`Listo: ${ids.length} actividades borradas.`, 'success');
    renderPanel(rootSel);
  });
  on(rootSel, 'click', '#admin-run', async () => {
    const box = document.getElementById('admin-tests');
    box.innerHTML = '<span class="text-muted"><span class="spinner-border spinner-border-sm"></span> Ejecutando…</span>';
    const results = await runSelfTests();
    const passed = results.filter(r => r.pass).length;
    const allOk = passed === results.length;
    box.innerHTML = `
      <div class="alert ${allOk ? 'alert-success' : 'alert-danger'} py-2">
        <b>${passed}/${results.length}</b> tests pasados ${allOk ? '✓' : '— revisa los fallos'}
      </div>
      <ul class="list-group">
        ${results.map(r => `<li class="list-group-item d-flex justify-content-between align-items-start">
          <span><span class="badge bg-secondary me-2">${escapeHtml(r.group)}</span>${escapeHtml(r.name)}</span>
          <span>${r.pass ? '<span class="text-success fw-bold">✓ pasó</span>'
            : `<span class="text-danger fw-bold">✗ ${escapeHtml(r.error || 'falló')}</span>`}</span>
        </li>`).join('')}
      </ul>`;
  });
}
