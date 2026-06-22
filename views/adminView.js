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
import { runSelfTests, TOTAL_TESTS } from '../core/selftest.js';
import { diagnoseDb } from '../core/dbDiag.js';
import { canConvert } from '../kernel/content/convert.js';
import { listVsAnimations } from '../core/vsAnimations.js';
import { loadCustomAnims, addCustomAnim, removeCustomAnim } from '../core/vsAnimStore.js';
import { DEFAULT_WORDS, getWordList, setWordList, resetWordList } from '../core/liveWords.js';

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

      <h5 class="mt-4">PocketBase — configuración de colecciones</h5>
      <p class="small text-muted mb-2">Crea automáticamente las colecciones <code>live_sessions</code>, <code>assignments</code> y <code>assignment_attempts</code> en tu instancia de PocketBase. Solo se necesita una vez.</p>
      <div class="d-flex gap-2 align-items-end flex-wrap mb-1">
        <div>
          <label class="form-label small mb-1">Email admin PocketBase</label>
          <input id="pb-email" type="email" class="form-control form-control-sm" placeholder="admin@ejemplo.com" style="width:220px">
        </div>
        <div>
          <label class="form-label small mb-1">Contraseña admin</label>
          <input id="pb-pass" type="password" class="form-control form-control-sm" style="width:180px">
        </div>
        <button id="pb-setup" class="btn btn-warning btn-sm"><i class="bi bi-database-add"></i> Crear colecciones</button>
      </div>
      <div id="pb-setup-out" class="mt-2"></div>

      <h5 class="mt-4">Mantenimiento</h5>
      <button id="admin-wipe" class="btn btn-outline-danger"><i class="bi bi-trash"></i> Borrar TODAS mis actividades (este dispositivo + nube)</button>
      <p class="small text-muted mt-1">Empieza de cero. No se puede deshacer. Mantiene tu identidad (no hace falta borrar la caché).</p>

      <h5 class="mt-4">Base de datos <small class="text-muted">(conexión, latencia y ciclo lectura/escritura/borrado real)</small></h5>
      <button id="admin-db" class="btn btn-primary"><i class="bi bi-database-check"></i> Probar base de datos</button>
      <div id="admin-db-out" class="mt-2"></div>

      <h5 class="mt-4">Tests en vivo <small class="text-muted">(${TOTAL_TESTS} comprobaciones · la suite CI es <code>node tests/run.mjs</code>)</small></h5>
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

      <h5 class="mt-4">Palabras Live <small class="text-muted">(códigos de sala — 4 letras, se reciclan al cerrar la sesión)</small></h5>
      <p class="small text-muted mb-2">
        Los alumnos se unen con una <b>palabra de 4 letras</b> (ej. <code>GATO</code>) en vez de un PIN alfanumérico largo.
        Escribe las palabras separadas por comas o saltos de línea, en mayúsculas y sin tildes. Mínimo 4 palabras.
        Por defecto hay <b>${DEFAULT_WORDS.length}</b> palabras disponibles.
      </p>
      <div class="card border-0 bg-light p-3 mb-3" style="max-width:540px">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <label class="form-label small fw-bold mb-0">Lista activa <span id="lw-count" class="text-muted fw-normal"></span></label>
          <button id="lw-reset" class="btn btn-sm btn-outline-secondary">Restaurar por defecto</button>
        </div>
        <textarea id="lw-words" class="form-control font-monospace mb-2" rows="6"
          placeholder="${DEFAULT_WORDS.slice(0, 8).join(', ')}…"></textarea>
        <div class="d-flex gap-2">
          <button id="lw-save" class="btn btn-primary btn-sm"><i class="bi bi-floppy"></i> Guardar</button>
          <span id="lw-feedback" class="small align-self-center text-muted"></span>
        </div>
      </div>

      <h5 class="mt-4">Animaciones VS <small class="text-muted">(selector en Presentación → Animación)</small></h5>
      <div id="va-list" class="mb-3"></div>
      <div class="card border-0 bg-light p-3" style="max-width:540px">
        <h6 class="mb-3"><i class="bi bi-plus-circle"></i> Añadir animación</h6>
        <div class="mb-2">
          <label class="form-label small fw-bold mb-1">Nombre <span class="text-danger">*</span></label>
          <input id="va-label" class="form-control form-control-sm" placeholder="Ej: Cohetes espaciales">
        </div>
        <div class="mb-2">
          <label class="form-label small fw-bold mb-1">Descripción</label>
          <input id="va-desc" class="form-control form-control-sm" placeholder="Breve descripción">
        </div>
        <div class="mb-2">
          <label class="form-label small fw-bold mb-1">Archivo .json <span class="text-muted">(o pega una URL abajo)</span></label>
          <input id="va-file" type="file" accept=".json" class="form-control form-control-sm">
        </div>
        <div class="mb-3">
          <label class="form-label small fw-bold mb-1">URL del .json <span class="text-muted">(alternativa al archivo)</span></label>
          <input id="va-url" class="form-control form-control-sm" placeholder="https://…/animacion.json">
        </div>
        <button id="va-add" class="btn btn-primary btn-sm"><i class="bi bi-plus-lg"></i> Añadir</button>
        <div id="va-err" class="text-danger small mt-2"></div>
      </div>
      <p class="small text-muted mt-2">
        Las animaciones subidas se guardan en este dispositivo (localStorage). Las bundleadas (integradas en el código) están disponibles para todos.
        La timeline debe tener frame 0 = derecha gana · frame central = empate · último frame = izquierda gana.
      </p>
    </div>`);

  // Live Words — populate textarea and wire buttons
  function paintLwEditor() {
    const list = getWordList();
    const ta = document.getElementById('lw-words');
    const cnt = document.getElementById('lw-count');
    if (ta) ta.value = list.join(', ');
    if (cnt) cnt.textContent = `(${list.length} palabras)`;
  }
  paintLwEditor();

  on(rootSel, 'click', '#lw-reset', async () => {
    const ok = await confirmModal(`¿Restaurar el diccionario por defecto (${DEFAULT_WORDS.length} palabras)?`, { okText: 'Restaurar' });
    if (!ok) return;
    resetWordList();
    paintLwEditor();
    const fb = document.getElementById('lw-feedback');
    if (fb) { fb.textContent = 'Restaurado.'; fb.className = 'small align-self-center text-success'; }
  });

  on(rootSel, 'click', '#lw-save', () => {
    const raw = document.getElementById('lw-words')?.value || '';
    const words = raw.split(/[\s,;]+/).map(w => w.trim().toUpperCase()).filter(w => /^[A-Z]{3,6}$/.test(w));
    const fb = document.getElementById('lw-feedback');
    if (words.length < 4) {
      if (fb) { fb.textContent = 'Mínimo 4 palabras válidas (3-6 letras A–Z).'; fb.className = 'small align-self-center text-danger'; }
      return;
    }
    setWordList(words);
    paintLwEditor();
    if (fb) { fb.textContent = `Guardadas ${words.length} palabras.`; fb.className = 'small align-self-center text-success'; }
  });

  // VS animations list
  function paintVaList() {
    const all = listVsAnimations();
    const custom = new Set(loadCustomAnims().map(a => a.id));
    const box = document.getElementById('va-list');
    if (!box) return;
    if (!all.length) { box.innerHTML = '<p class="text-muted small">Sin animaciones registradas.</p>'; return; }
    box.innerHTML = `<div class="table-responsive"><table class="table table-sm table-bordered align-middle" style="max-width:640px">
      <thead class="table-light"><tr><th>Nombre</th><th>Descripción</th><th>Tipo</th><th></th></tr></thead>
      <tbody>
        ${all.map(a => `<tr>
          <td><b>${escapeHtml(a.label)}</b><div class="small text-muted font-monospace">${escapeHtml(a.id)}</div></td>
          <td class="small">${escapeHtml(a.description || '—')}</td>
          <td><span class="badge ${custom.has(a.id) ? 'bg-info' : 'bg-secondary'}">${custom.has(a.id) ? 'custom' : a.kind === 'builtin' ? 'builtin' : 'bundled'}</span></td>
          <td>${custom.has(a.id) ? `<button class="btn btn-sm btn-outline-danger va-del" data-id="${escapeHtml(a.id)}"><i class="bi bi-trash"></i></button>` : ''}</td>
        </tr>`).join('')}
      </tbody></table></div>`;
  }
  paintVaList();

  on(rootSel, 'click', '.va-del', async (_, b) => {
    const ok = await confirmModal(`¿Eliminar la animación "${b.dataset.id}"?`, { okText: 'Eliminar', danger: true });
    if (!ok) return;
    removeCustomAnim(b.dataset.id);
    toast('Animación eliminada. Recarga para que desaparezca del selector.', 'success');
    paintVaList();
  });

  on(rootSel, 'click', '#va-add', async () => {
    const label = document.getElementById('va-label')?.value.trim();
    const desc  = document.getElementById('va-desc')?.value.trim();
    const url   = document.getElementById('va-url')?.value.trim();
    const file  = document.getElementById('va-file')?.files?.[0];
    const errEl = document.getElementById('va-err');
    if (errEl) errEl.textContent = '';
    if (!label) { if (errEl) errEl.textContent = 'El nombre es obligatorio.'; return; }
    if (!file && !url) { if (errEl) errEl.textContent = 'Sube un archivo .json o pega una URL.'; return; }
    const id = 'custom-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
    try {
      if (file) {
        const jsonStr = await file.text();
        JSON.parse(jsonStr); // validate it's real JSON
        addCustomAnim({ id, label, description: desc, jsonStr });
      } else {
        addCustomAnim({ id, label, description: desc, src: url });
      }
      toast(`Animación "${label}" añadida. Recarga la página para usarla en VS.`, 'success');
      // Clear form
      ['va-label','va-desc','va-url'].forEach(i => { const el = document.getElementById(i); if (el) el.value = ''; });
      const fi = document.getElementById('va-file'); if (fi) fi.value = '';
      paintVaList();
    } catch (e) {
      if (errEl) errEl.textContent = e.message;
    }
  });

  on(rootSel, 'click', '#admin-lock', () => { try { sessionStorage.removeItem(SESSION_KEY); } catch {} renderGate(rootSel); });
  on(rootSel, 'click', '#admin-wipe', async () => {
    const ok = await confirmModal('¿Borrar TODAS tus actividades de este dispositivo y de la nube? No se puede deshacer.', { okText: 'Borrar todo', danger: true });
    if (!ok) return;
    const ids = list().map(a => a.id);
    for (const id of ids) { try { await remove(id); } catch {} }
    toast(`Listo: ${ids.length} actividades borradas.`, 'success');
    renderPanel(rootSel);
  });
  on(rootSel, 'click', '#admin-db', async () => {
    const box = document.getElementById('admin-db-out');
    const btn = document.getElementById('admin-db');
    btn.disabled = true;
    box.innerHTML = `
      <div class="d-flex align-items-center gap-2 mb-2 text-muted">
        <span class="spinner-border spinner-border-sm"></span><small>Probando conexión…</small>
      </div>
      <ul id="db-list" class="list-group list-group-flush" style="font-size:.875rem"></ul>`;
    const ul = document.getElementById('db-list');
    let failed = 0;

    const fmtMs = (ms) => ms == null ? '' :
      `<span class="badge ${ms < 300 ? 'bg-success' : ms < 1000 ? 'bg-warning text-dark' : 'bg-danger'}">${ms} ms</span>`;

    const results = await diagnoseDb((r) => {
      if (!r.pass) failed++;
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center py-1 px-2';
      li.innerHTML = `
        <span>
          ${r.pass ? '<span class="text-success fw-semibold me-1">✓</span>' : '<span class="text-danger fw-semibold me-1">✗</span>'}
          ${escapeHtml(r.name)}
          ${r.info ? `<small class="text-muted ms-1">${escapeHtml(r.info)}</small>` : ''}
        </span>
        <span class="ms-2 text-nowrap">${fmtMs(r.ms)}</span>`;
      ul.appendChild(li);
    });

    const okCount = results.filter(r => r.pass).length;
    const allOk = failed === 0;
    const banner = document.createElement('div');
    banner.className = `alert ${allOk ? 'alert-success' : 'alert-danger'} py-1 px-2 mb-2 small`;
    banner.innerHTML = allOk
      ? `<b>Conexión OK</b> · ${okCount}/${results.length} chequeos pasaron`
      : `<b>${failed} fallo(s)</b> · ${okCount}/${results.length} pasaron — revisa los detalles`;
    box.querySelector('.d-flex')?.remove();
    box.insertBefore(banner, ul);
    btn.disabled = false;
  });

  on(rootSel, 'click', '#admin-run', async () => {
    const box = document.getElementById('admin-tests');
    const btn = document.getElementById('admin-run');
    btn.disabled = true;

    // Build streaming UI: progress bar + live list.
    box.innerHTML = `
      <div class="mb-2">
        <div class="d-flex justify-content-between mb-1">
          <small id="at-status" class="text-muted">Ejecutando…</small>
          <small id="at-count" class="text-muted">0 / ${TOTAL_TESTS}</small>
        </div>
        <div class="progress" style="height:6px">
          <div id="at-bar" class="progress-bar progress-bar-striped progress-bar-animated bg-primary"
               role="progressbar" style="width:0%"></div>
        </div>
      </div>
      <ul id="at-list" class="list-group list-group-flush" style="font-size:.875rem"></ul>`;

    const bar   = document.getElementById('at-bar');
    const count = document.getElementById('at-count');
    const statusEl = document.getElementById('at-status');
    const ul    = document.getElementById('at-list');
    let failed  = 0;

    const results = await runSelfTests((r, done, total) => {
      if (!r.pass) failed++;
      // Update progress.
      const pct = Math.round(done / total * 100);
      if (bar)   bar.style.width   = pct + '%';
      if (count) count.textContent = `${done} / ${total}`;
      if (bar && failed > 0) bar.className = 'progress-bar bg-danger';
      // Append result row (streaming).
      if (ul) {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center py-1 px-2';
        li.innerHTML = `
          <span>
            <span class="badge bg-secondary me-1" style="font-size:.7rem">${escapeHtml(r.group)}</span>
            ${escapeHtml(r.name)}
          </span>
          <span class="ms-2 text-nowrap">
            ${r.pass
              ? '<span class="text-success fw-semibold">✓</span>'
              : `<span class="text-danger fw-semibold" title="${escapeHtml(r.error || '')}">✗ <small>${escapeHtml((r.error||'').slice(0, 60))}</small></span>`}
          </span>`;
        ul.appendChild(li);
        li.scrollIntoView({ block: 'nearest' });
      }
    });

    // Final summary banner above the list.
    const passed = results.filter(r => r.pass).length;
    const allOk  = passed === results.length;
    if (bar) {
      bar.className = `progress-bar ${allOk ? 'bg-success' : 'bg-danger'}`;
      bar.style.width = '100%';
    }
    if (statusEl) statusEl.className = allOk ? 'text-success fw-semibold' : 'text-danger fw-semibold';
    if (statusEl) statusEl.textContent = allOk ? `✓ Todos pasaron` : `✗ ${failed} fallaron`;

    const banner = document.createElement('div');
    banner.className = `alert ${allOk ? 'alert-success' : 'alert-danger'} py-1 px-2 mb-2 small`;
    banner.innerHTML = `<b>${passed} / ${results.length}</b> tests pasados ${allOk ? '✓' : '— revisa los detalles abajo'}`;
    box.insertBefore(banner, box.querySelector('div'));

    btn.disabled = false;
  });

  on(rootSel, 'click', '#pb-setup', async () => {
    const email = document.getElementById('pb-email')?.value?.trim();
    const pass  = document.getElementById('pb-pass')?.value;
    const out   = document.getElementById('pb-setup-out');
    if (!email || !pass) { out.innerHTML = '<div class="alert alert-warning py-1 px-2 small">Introduce email y contraseña de admin de PocketBase.</div>'; return; }

    out.innerHTML = '<div class="text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Autenticando…</div>';
    const btn = document.getElementById('pb-setup');
    btn.disabled = true;

    try {
      // 1. Authenticate as PocketBase admin
      const { PB_URL } = await import('../pocketbase.config.js');
      const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password: pass }),
      });
      if (!authRes.ok) {
        const b = await authRes.json().catch(() => ({}));
        throw new Error(b.message || 'Credenciales incorrectas');
      }
      const { token } = await authRes.json();
      const headers = { 'Content-Type': 'application/json', 'Authorization': token };

      // 2. Collection schemas
      const COLLECTIONS = [
        {
          name: 'live_sessions',
          type: 'base',
          schema: [
            { name: 'code',     type: 'text',   required: true },
            { name: 'activity', type: 'json',   required: false },
            { name: 'state',    type: 'json',   required: false },
          ],
          listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
        },
        {
          name: 'assignments',
          type: 'base',
          schema: [
            { name: 'code',          type: 'text',   required: true },
            { name: 'activity_id',   type: 'text',   required: false },
            { name: 'activity_snap', type: 'json',   required: false },
            { name: 'author_id',     type: 'text',   required: false },
            { name: 'title',         type: 'text',   required: false },
            { name: 'due_at',        type: 'text',   required: false },
            { name: 'max_attempts',  type: 'number', required: false },
            { name: 'status',        type: 'text',   required: false },
            { name: 'created_at',    type: 'text',   required: false },
          ],
          listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
        },
        {
          name: 'assignment_attempts',
          type: 'base',
          schema: [
            { name: 'assignment_id', type: 'text',   required: false },
            { name: 'activity_id',   type: 'text',   required: false },
            { name: 'user_id',       type: 'text',   required: false },
            { name: 'player_name',   type: 'text',   required: false },
            { name: 'score_auto',    type: 'number', required: false },
            { name: 'score_final',   type: 'number', required: false },
            { name: 'max_score',     type: 'number', required: false },
            { name: 'time_used',     type: 'number', required: false },
            { name: 'created_at',    type: 'text',   required: false },
          ],
          listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
        },
      ];

      // 3. Create each collection (skip if already exists)
      const results = [];
      for (const col of COLLECTIONS) {
        out.innerHTML = `<div class="text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Creando <code>${col.name}</code>…</div>`;
        try {
          const r = await fetch(`${PB_URL}/api/collections`, {
            method: 'POST', headers,
            body: JSON.stringify(col),
          });
          if (r.ok) {
            results.push({ name: col.name, ok: true, msg: 'creada' });
          } else {
            const b = await r.json().catch(() => ({}));
            // 400 with "already exists" is fine
            if (b.data?.name?.code === 'validation_not_unique' || b.message?.includes('already exists')) {
              results.push({ name: col.name, ok: true, msg: 'ya existía' });
            } else {
              results.push({ name: col.name, ok: false, msg: b.message || `error ${r.status}` });
            }
          }
        } catch (e) {
          results.push({ name: col.name, ok: false, msg: e.message });
        }
      }

      const allOk = results.every(r => r.ok);
      out.innerHTML = `
        <div class="alert ${allOk ? 'alert-success' : 'alert-warning'} py-2 px-3 small">
          ${results.map(r => `<div>${r.ok ? '✓' : '✗'} <code>${r.name}</code> — ${r.msg}</div>`).join('')}
          ${allOk ? '<div class="mt-1 fw-semibold">Listo. Recarga la página para activar Live y Tareas en PocketBase.</div>' : ''}
        </div>`;
    } catch (e) {
      out.innerHTML = `<div class="alert alert-danger py-1 px-2 small">Error: ${escapeHtml(e.message)}</div>`;
    } finally {
      btn.disabled = false;
      document.getElementById('pb-pass').value = '';
    }
  });
}
