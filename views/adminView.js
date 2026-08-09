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
import { CONTRACT_METHODS } from '../core/modeMatrix.js';
import { list, remove } from '../core/storage.js';
import { QUOTAS, checkActivityCount, checkActivitySize, liveRetentionCutoff } from '../core/quotas.js';
import { purgeOldLive } from '../core/liveTransport.js';
import { clock } from '../core/clock.js';
import { confirmModal, toast } from '../core/toast.js';
import { downloadActivitiesJson, pickAndImport } from '../core/io.js';
import { runSelfTests, TOTAL_TESTS } from '../core/selftest.js';
import { diagnoseDb } from '../core/dbDiag.js';
import { runStressTest } from '../core/stressTest.js';
import { rulesFor as pbRulesFor } from '../core/pbRules.js';
import { PB_URL } from '../pocketbase.config.js';
import { buildAdminMatrix } from './admin/matrix.js';
import { listVsAnimations } from '../core/vsAnimations.js';
import { loadCustomAnims, addCustomAnim, removeCustomAnim } from '../core/vsAnimStore.js';
import { DEFAULT_WORDS, getWordList, setWordList, resetWordList } from '../core/liveWords.js';
import { recentErrors, clearErrors } from '../core/errorLog.js';
import { isAdmin, createTeacher, getAuthUserId } from '../core/auth.js';
import { listTeachers, setTeacherRole, countActivitiesByOwner } from '../core/teachers.js';

// Admin UNIFICADO (auth v2): el acceso es por ROL de Google (isAdmin), no por
// contraseña local. Solo un profe con role='admin' entra. La contraseña 'fernando'
// se retiró — había un candado paralelo que confundía (dos "admin" distintos).
export function renderAdmin(rootSel) {
  if (!isAdmin()) return renderGate(rootSel);
  renderPanel(rootSel);
}

function renderGate(rootSel) {
  mount(rootSel, html`
    <div class="auth-gate"><div class="auth-gate__card">
      <div class="auth-gate__icon"><i class="bi bi-shield-lock"></i></div>
      <h1 class="auth-gate__title">Panel de administración</h1>
      <p class="auth-gate__sub">Esta sección es solo para administradores. Inicia sesión con una cuenta con rol admin.</p>
      <div class="auth-gate__cta" id="admin-gate-slot"></div>
      <a href="#/" class="auth-gate__back"><i class="bi bi-arrow-left"></i> Volver a la portada</a>
    </div></div>`);
  import('../core/authWidget.js').then(m => m.mountAuthSlot('#admin-gate-slot').catch(() => {}));
}

function renderPanel(rootSel) {
  // Tablas de diagnóstico (capacidad/actividades/conversiones) → views/admin/matrix.js
  const { caps, acts, capRows, actRows, convRows } = buildAdminMatrix();
  const errLog = recentErrors();

  mount(rootSel, html`
    <div class="container py-3">
      <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <a href="#/home" class="btn btn-sm btn-link p-0"><i class="bi bi-arrow-left"></i> Inicio</a>
        <a href="#/moderar" class="btn btn-sm btn-outline-warning"><i class="bi bi-flag"></i> Moderación</a>
      </div>
      <h3><i class="bi bi-shield-lock"></i> Panel de administración</h3>

      <h5 class="mt-3"><i class="bi bi-people"></i> Profesores</h5>
      <p class="text-muted small mb-2">Crea una cuenta con correo + contraseña para que un profe entre en una pizarra sin cuenta de Google. Da o quita <b>admin</b> desde la tabla (moderación global).</p>
      <div class="d-flex flex-wrap gap-2 mb-1" style="max-width:640px">
        <input id="teach-name" class="form-control form-control-sm" style="width:150px" placeholder="Nombre">
        <input id="teach-email" class="form-control form-control-sm" style="width:200px" type="email" placeholder="Correo">
        <input id="teach-pass" class="form-control form-control-sm" style="width:150px" type="text" placeholder="Contraseña (mín 8)">
        <button id="teach-create" class="btn btn-primary btn-sm"><i class="bi bi-person-plus"></i> Crear profesor</button>
      </div>
      <div id="teach-msg" class="small mb-2"></div>
      <div id="teach-list" class="table-responsive mb-3">
        <div class="text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Cargando profesores…</div>
      </div>

      <h5 class="mt-3">Datos</h5>
      <div class="d-flex flex-wrap gap-2 mb-3">
        <button id="admin-import" class="btn btn-outline-secondary btn-sm"><i class="bi bi-file-earmark-arrow-up"></i> Importar actividades</button>
        <button id="admin-export" class="btn btn-outline-secondary btn-sm"><i class="bi bi-file-earmark-arrow-down"></i> Exportar todas</button>
      </div>

      <h5 class="mt-3">Sistema</h5>
      <table class="table table-sm w-auto">
        <tbody>
          <tr><th class="pe-3">Versión</th><td>v${escapeHtml(VERSION)}</td></tr>
          <tr><th class="pe-3">Backend</th><td>${escapeHtml(backendName())}</td></tr>
          <tr><th class="pe-3">Plantillas</th><td>${caps.length}</td></tr>
          <tr><th class="pe-3">Actividades (locales)</th><td>${acts.length}</td></tr>
        </tbody>
      </table>
      <div class="d-flex gap-2 flex-wrap mb-1">
        <button id="admin-refresh" class="btn btn-sm btn-outline-primary"><i class="bi bi-arrow-clockwise"></i> Borrar caché y recargar</button>
        <button id="admin-nuke-sw" class="btn btn-sm btn-outline-danger"><i class="bi bi-radioactive"></i> Eliminar Service Worker (agresivo)</button>
      </div>
      <p class="small text-muted">Si tras actualizar sigues viendo la versión vieja, usa el botón rojo: desregistra el SW, borra toda la caché y recarga. Mantiene tus datos.</p>

      <h5 class="mt-4">PocketBase — configuración de colecciones</h5>
      <p class="small text-muted mb-2">Crea/actualiza TODAS las colecciones (activities, live_sessions, <code>live_players</code>, live_answers, assignments, results…) y aplica sus reglas de acceso. Append-only: añade lo que falte sin borrar datos. Re-córrelo tras cada actualización que toque el esquema (p.ej. reglas endurecidas). Necesita tu superadmin de PocketBase.</p>
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

      <h5 class="mt-4">Capacidad <small class="text-muted">(§25 · el servidor es una Pi COMPARTIDA con otros proyectos)</small></h5>
      <div id="admin-quota" class="mb-2"></div>
      <div class="d-flex gap-2 align-items-end flex-wrap">
        <button id="admin-purge-scan" class="btn btn-outline-secondary btn-sm"><i class="bi bi-search"></i> Ver qué salas caducaron</button>
        <span class="small text-muted">Salas en vivo de más de ${QUOTAS.liveRetentionDays} días. No toca resultados ni intentos de tarea.</span>
      </div>
      <div id="admin-purge-out" class="mt-2"></div>

      <h5 class="mt-4">Mantenimiento</h5>
      <button id="admin-wipe" class="btn btn-outline-danger"><i class="bi bi-trash"></i> Borrar TODAS mis actividades (este dispositivo + nube)</button>
      <p class="small text-muted mt-1">Empieza de cero. No se puede deshacer. Mantiene tu identidad (no hace falta borrar la caché).</p>

      <h5 class="mt-4">Base de datos <small class="text-muted">(conexión, latencia y ciclo lectura/escritura/borrado real)</small></h5>
      <button id="admin-db" class="btn btn-primary"><i class="bi bi-database-check"></i> Probar base de datos</button>
      <div id="admin-db-out" class="mt-2"></div>

      <h5 class="mt-4">Prueba de carga <small class="text-muted">(N alumnos entrando y respondiendo A LA VEZ · live + tareas, contra el servidor real)</small></h5>
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <button id="admin-stress" class="btn btn-primary"><i class="bi bi-lightning-charge"></i> Simular carga</button>
        <select id="admin-stress-n" class="form-select form-select-sm" style="width:auto">
          <option value="10">10 alumnos</option>
          <option value="20" selected>20 alumnos</option>
          <option value="30">30 alumnos</option>
          <option value="50">50 alumnos</option>
          <option value="100">100 alumnos</option>
        </select>
        <small class="text-muted">Crea datos desechables (prefijo <code>stress_</code>) y los borra al terminar.</small>
      </div>
      <div id="admin-stress-out" class="mt-2"></div>

      <h5 class="mt-4">Tests en vivo <small class="text-muted">(${TOTAL_TESTS} comprobaciones · la suite CI es <code>node tests/run.mjs</code>)</small></h5>
      <button id="admin-run" class="btn btn-success"><i class="bi bi-play-circle"></i> Ejecutar tests</button>
      <div id="admin-tests" class="mt-2"></div>

      <h5 class="mt-4">Errores recientes <small class="text-muted">(últimos ${errLog.length} en este dispositivo · anillo local, sin red)</small></h5>
      ${errLog.length ? `
        <button id="admin-err-clear" class="btn btn-sm btn-outline-secondary mb-2"><i class="bi bi-x-circle"></i> Limpiar registro</button>
        <div class="table-responsive"><table class="table table-sm table-bordered align-middle small">
          <thead class="table-light"><tr><th style="width:11rem">Cuándo</th><th>Mensaje</th><th style="width:5rem">Página</th></tr></thead>
          <tbody>${errLog.slice().reverse().map(e => `<tr>
            <td class="text-nowrap text-muted">${escapeHtml((e.at || '').replace('T', ' ').replace(/\.\d+Z$/, ''))}</td>
            <td><code class="text-danger">${escapeHtml(e.message || '')}</code>${e.stack ? `<details><summary class="small text-muted" style="cursor:pointer">stack</summary><pre class="small mb-0" style="white-space:pre-wrap">${escapeHtml(e.stack)}</pre></details>` : ''}</td>
            <td>${escapeHtml(e.page || '')}</td>
          </tr>`).join('')}</tbody>
        </table></div>`
        : '<p class="text-muted">Sin errores registrados. 🎉</p>'}

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

  // Tabla de profesores (U5): lista users + nº de actividades + dar/quitar admin.
  async function paintTeachers() {
    const box = document.getElementById('teach-list');
    if (!box) return;
    const [teachers, counts] = await Promise.all([listTeachers(), countActivitiesByOwner()]);
    if (!teachers.length) {
      box.innerHTML = `<p class="text-muted small mb-0">No se pudo listar (¿sin permiso admin?) o no hay profesores todavía.</p>`;
      return;
    }
    const me = getAuthUserId();
    teachers.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    box.innerHTML = `<table class="table table-sm table-bordered align-middle mb-0">
      <thead class="table-light"><tr><th>Nombre</th><th>Correo</th><th class="text-center">Actividades</th><th class="text-center">Rol</th><th></th></tr></thead>
      <tbody>${teachers.map(t => {
        const isA = t.role === 'admin';
        const self = t.id === me;
        return `<tr>
          <td>${escapeHtml(t.name || '—')}</td>
          <td class="small text-muted">${escapeHtml(t.email)}</td>
          <td class="text-center">${counts[t.id] || 0}</td>
          <td class="text-center">${isA ? '<span class="badge bg-warning text-dark">admin</span>' : '<span class="badge bg-light text-dark border">profe</span>'}</td>
          <td class="text-end">
            <button class="btn btn-sm ${isA ? 'btn-outline-secondary' : 'btn-outline-warning'} teach-role"
              data-id="${escapeHtml(t.id)}" data-role="${isA ? '' : 'admin'}" ${self ? 'disabled title="No te cambies el rol a ti mismo"' : ''}>
              ${isA ? '<i class="bi bi-shield-minus"></i> Quitar admin' : '<i class="bi bi-shield-plus"></i> Hacer admin'}
            </button>
          </td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }
  paintTeachers().catch(() => {});

  on(rootSel, 'click', '.teach-role', async (_, b) => {
    const id = b.dataset.id, role = b.dataset.role;
    b.disabled = true;
    try {
      await setTeacherRole(id, role);
      toast(role === 'admin' ? 'Ahora es admin.' : 'Admin retirado.', 'success');
      await paintTeachers();
    } catch (e) {
      toast('No se pudo cambiar el rol: ' + e.message, 'danger', 5000);
      b.disabled = false;
    }
  });

  on(rootSel, 'click', '#teach-create', async () => {
    const name = document.getElementById('teach-name')?.value.trim();
    const email = document.getElementById('teach-email')?.value.trim();
    const pass = document.getElementById('teach-pass')?.value || '';
    const msg = document.getElementById('teach-msg');
    if (!email || pass.length < 8) { if (msg) { msg.className = 'small mb-2 text-danger'; msg.textContent = 'Correo válido y contraseña de al menos 8 caracteres.'; } return; }
    try {
      await createTeacher(email, pass, name);
      if (msg) { msg.className = 'small mb-2 text-success'; msg.textContent = `Profesor creado: ${email} (contraseña: ${pass}). Apúntala.`; }
      ['teach-name','teach-email','teach-pass'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      await paintTeachers();
    } catch (e) {
      if (msg) { msg.className = 'small mb-2 text-danger'; msg.textContent = 'No se pudo crear: ' + e.message; }
    }
  });
  on(rootSel, 'click', '#admin-export', () => downloadActivitiesJson());
  on(rootSel, 'click', '#admin-import', () => {
    pickAndImport({ strategy: 'duplicate' }, (r) => {
      if (r.ok) toast(`Importadas ${r.count} actividades.`, 'success');
      else if (r.count) toast(`${r.count} importadas, ${r.errors.length} fallaron.`, 'warning', 6000);
      else toast('Error al importar: ' + r.errors.join('; '), 'danger', 6000);
    });
  });
  on(rootSel, 'click', '#admin-refresh', () => { (window.__wwRefresh || (() => location.reload()))(); });
  on(rootSel, 'click', '#admin-nuke-sw', () => { (window.__wwNukeSW || (() => location.reload()))(); });
  on(rootSel, 'click', '#admin-err-clear', () => { clearErrors(); toast('Registro de errores limpiado.', 'success'); renderPanel(rootSel); });
  // ── §25 CAPACIDAD — cuánto ocupo y qué salas caducaron ────────────────────
  // El aviso de nº de actividades es AVISO, no veredicto: una regla de PB no
  // sabe contar filas (§22 — se dice lo que se puede aplicar). El tope de
  // TAMAÑO sí lo aplica el servidor (maxSize del campo `data`).
  (function paintQuota() {
    const box = document.getElementById('admin-quota');
    if (!box) return;
    const acts = list();
    const cnt = checkActivityCount(acts.length);
    const sized = acts.map(a => ({ a, s: checkActivitySize(a) })).sort((x, y) => y.s.bytes - x.s.bytes);
    const heavy = sized.filter(x => x.s.level !== 'ok').slice(0, 5);
    const total = sized.reduce((n, x) => n + x.s.bytes, 0);
    const mb = (n) => (n / (1024 * 1024)).toFixed(1).replace('.', ',');
    const cls = { ok: 'secondary', warn: 'warning', over: 'danger' };
    box.innerHTML = `
      <div class="d-flex gap-3 flex-wrap align-items-center">
        <span class="badge bg-${cls[cnt.level]}">${cnt.count} / ${cnt.limit} actividades</span>
        <span class="badge bg-secondary">${mb(total)} MB en total</span>
        <span class="small text-muted">Máximo por actividad: ${mb(QUOTAS.activityBytes)} MB · por imagen: ${Math.round(QUOTAS.imageBytes / 1024)} KB</span>
      </div>
      ${cnt.msg ? `<div class="alert alert-${cls[cnt.level]} py-2 mt-2 mb-0 small">${escapeHtml(cnt.msg)}</div>` : ''}
      ${heavy.length ? `<div class="mt-2 small">
        <b>Las más pesadas:</b>
        <ul class="mb-0">${heavy.map(x => `<li><span class="text-${cls[x.s.level]}">${mb(x.s.bytes)} MB</span> · ${escapeHtml(x.a.title || x.a.id)}</li>`).join('')}</ul>
      </div>` : ''}`;
  })();
  on(rootSel, 'click', '#admin-purge-scan', async () => {
    const box = document.getElementById('admin-purge-out');
    const btn = document.getElementById('admin-purge-scan');
    btn.disabled = true;
    box.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Contando…';
    const cutoff = liveRetentionCutoff(clock.now());
    let r;
    try { r = await purgeOldLive(cutoff, { dryRun: true }); }
    catch (e) { box.innerHTML = `<div class="alert alert-danger py-2 mb-0">No se pudo consultar: ${escapeHtml(e.message)}</div>`; btn.disabled = false; return; }
    btn.disabled = false;
    if (!r.sessions) {
      box.innerHTML = `<div class="alert alert-success py-2 mb-0">Nada que limpiar: no hay salas anteriores al ${escapeHtml(cutoff.slice(0, 10))}.</div>`;
      return;
    }
    box.innerHTML = `
      <div class="alert alert-warning py-2">
        Caducaron <b>${r.sessions}</b> salas (anteriores al ${escapeHtml(cutoff.slice(0, 10))}), con
        <b>${r.answers}</b> respuestas, <b>${r.players}</b> jugadores y <b>${r.claims}</b> credenciales.
        <div class="small mt-1">Los resultados de tus alumnos (<code>results</code>) y los intentos de tarea NO se tocan.</div>
      </div>
      <button id="admin-purge-go" class="btn btn-danger btn-sm"><i class="bi bi-trash"></i> Borrar esas ${r.sessions} salas</button>`;
    on(rootSel, 'click', '#admin-purge-go', async () => {
      const ok = await confirmModal(`¿Borrar ${r.sessions} salas caducadas y todo lo que cuelga de ellas?`, { okText: 'Borrar', danger: true });
      if (!ok) return;
      const go = document.getElementById('admin-purge-go');
      if (go) { go.disabled = true; go.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Borrando…'; }
      const done = await purgeOldLive(cutoff, { dryRun: false }).catch(e => ({ errors: [e.message] }));
      box.innerHTML = done.errors?.length
        ? `<div class="alert alert-warning py-2 mb-0">Se borró lo que se pudo (${done.sessions || 0} salas). Errores: ${escapeHtml(done.errors.slice(0, 3).join(' · '))}</div>`
        : `<div class="alert alert-success py-2 mb-0">Limpiado: ${done.sessions} salas, ${done.answers} respuestas, ${done.players} jugadores, ${done.claims} credenciales.</div>`;
    });
  });
  on(rootSel, 'click', '#admin-wipe', async () => {
    const ok = await confirmModal('¿Borrar TODAS tus actividades de este dispositivo y de la nube? No se puede deshacer.', { okText: 'Borrar todo', danger: true });
    if (!ok) return;
    const ids = list().map(a => a.id);
    // R6 · fallar en silencio está prohibido: antes se tragaba cada error y
    // decía "Listo: N borradas" aunque hubieran fallado TODAS — el profe se
    // quedaba creyendo que su nube estaba limpia. Se cuentan y se dicen.
    const fallos = [];
    for (const id of ids) {
      try { await remove(id); }
      catch (e) { fallos.push(`${id}: ${e.message}`); console.warn('[admin] no se pudo borrar', id, e); }
    }
    const hechas = ids.length - fallos.length;
    if (fallos.length) {
      toast(`Se borraron ${hechas} de ${ids.length}. ${fallos.length} no se pudieron borrar (¿sin conexión?): ${fallos.slice(0, 2).join(' · ')}`, 'warning', 9000);
    } else {
      toast(`Listo: ${ids.length} actividades borradas.`, 'success');
    }
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

  on(rootSel, 'click', '#admin-stress', async () => {
    const box = document.getElementById('admin-stress-out');
    const btn = document.getElementById('admin-stress');
    const n = Number(document.getElementById('admin-stress-n').value) || 30;
    const ok = await confirmModal(`Se van a simular ${n} alumnos golpeando el servidor A LA VEZ (live + tareas). Crea y borra datos de prueba. ¿Continuar?`, { okText: 'Simular carga' });
    if (!ok) return;
    btn.disabled = true;
    const log = [];
    const paint = (extra = '') => {
      box.innerHTML = `<div class="d-flex align-items-center gap-2 mb-1 text-muted"><span class="spinner-border spinner-border-sm"></span><small>${escapeHtml(log[log.length - 1] || 'Preparando…')}</small></div>${extra}`;
    };
    paint();
    try {
      const r = await runStressTest({ pbUrl: PB_URL, n, onLog: (m) => { log.push(m); paint(); } });
      const row = (label, pass, detail) =>
        `<li class="list-group-item d-flex justify-content-between align-items-center py-1 px-2">
           <span>${pass ? '<span class="text-success fw-semibold me-1">✓</span>' : '<span class="text-danger fw-semibold me-1">✗</span>'}${escapeHtml(label)}</span>
           <small class="text-muted">${escapeHtml(detail)}</small></li>`;
      const L = r.live, T = r.tasks;
      const notRun = !L && !T;   // abortó antes de correr (faltan colecciones) ≠ se cayó
      const notes = r.notes.length ? `<div class="alert alert-warning py-1 px-2 small mb-2">${r.notes.map(escapeHtml).join('<br>')}</div>` : '';
      if (notRun) {
        box.innerHTML = `${notes}<div class="alert alert-secondary py-1 px-2 mb-0 small"><b>No ejecutado</b> — falta preparar el servidor (arriba: <i class="bi bi-database-add"></i> Crear colecciones). No es un fallo de carga.</div>`;
        return;
      }
      const items = [];
      if (L) {
        items.push(row(`Live · entradas simultáneas`, L.playerRows === n, `${L.playerRows}/${n} filas · ${L.uniqueNames} apodos únicos · ${L.joinMs} ms`));
        const errs = Object.entries(L.answerErrors || {});
        items.push(row(`Live · respuestas simultáneas`, L.answerRows === L.joinsOk * 2,
          `${L.answerRows} filas (esperadas ${L.joinsOk * 2}) · ${L.ansMs} ms`
          + (errs.length ? ` · rechazos: ${errs.map(([k, v]) => `${v}×HTTP ${k}`).join(', ')}` : '')));
      }
      if (T) items.push(row(`Tareas · intentos simultáneos`, T.pass, T.attemptRows != null ? `${T.attemptRows}/${n} filas · ${T.attMs} ms` : 'no ejecutado'));
      box.innerHTML = `
        ${notes}
        <div class="alert ${r.ok ? 'alert-success' : 'alert-danger'} py-1 px-2 mb-2 small">
          <b>${r.ok ? '✅ Aguanta' : '❌ Se cayó bajo carga'}</b> · ${n} alumnos concurrentes · ${r.ms} ms total
          ${r.ok ? '' : '<br>Con RECHAZOS (403/400) es el servidor diciendo que no: regla o credencial, no carga. Sin rechazos y filas &lt; N ⇒ lost-update o la Pi no da abasto. Apodos únicos &lt; filas ⇒ colisión sin resolver.'}
        </div>
        <ul class="list-group list-group-flush" style="font-size:.875rem">${items.join('')}</ul>`;
    } catch (e) {
      box.innerHTML = `<div class="alert alert-danger py-1 px-2 small">Error: ${escapeHtml(e.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
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
      // 1. Authenticate as PocketBase admin. La API cambió en PB 0.23:
      //    ≥0.23 → /api/collections/_superusers/auth-with-password
      //    <0.23 → /api/admins/auth-with-password
      //    Probamos la nueva primero; si da 404 caemos a la antigua.
      const { PB_URL } = await import('../pocketbase.config.js');
      const tryAuth = async (url) => {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: email, password: pass }),
        });
        if (r.ok) return (await r.json()).token;
        if (r.status === 404) return null; // endpoint inexistente en esta versión
        const b = await r.json().catch(() => ({}));
        throw new Error(b.message || `Error de autenticación (${r.status})`);
      };
      let isV23 = true;
      let token = await tryAuth(`${PB_URL}/api/collections/_superusers/auth-with-password`);
      if (!token) { isV23 = false; token = await tryAuth(`${PB_URL}/api/admins/auth-with-password`); }
      if (!token) throw new Error('No se pudo autenticar: el endpoint de admin no existe en ninguna versión conocida. Revisa la URL de PocketBase.');
      const headers = { 'Content-Type': 'application/json', 'Authorization': token };

      // 2. Definición de campos por colección (neutra respecto a la versión).
      const DEFS = [
        { name: 'activities', fields: [
          // El tope REAL de una actividad (§25) — lo aplica PocketBase.
          { name: 'data',       type: 'json', maxSize: QUOTAS.activityBytes },
          { name: 'visibility', type: 'text' },
          { name: 'tags',       type: 'json' },
          { name: 'language',   type: 'text' },
          { name: 'owner',      type: 'text' },   // id del profe dueño (Fase 1 seguridad PB)
        ]},
        { name: 'results', fields: [
          { name: 'activity_id', type: 'text' },
          { name: 'session_id',  type: 'text' },
          { name: 'user_id',     type: 'text' },
          { name: 'player_name', type: 'text' },
          { name: 'score_auto',  type: 'number' },
          { name: 'score_final', type: 'number' },
          { name: 'max_score',   type: 'number' },
          { name: 'time_used',   type: 'number' },
          { name: 'overrides',   type: 'json' },
          // Deuda D (R1) — clave de idempotencia: el índice único PARCIAL
          // (qid != '') deja en paz las filas antiguas y convierte el reintento
          // tras un ACK perdido en 400 = "ya guardado".
          { name: 'qid',         type: 'text' },
        ], indexes: ["CREATE UNIQUE INDEX `idx_results_qid` ON `results` (`qid`) WHERE `qid` != ''"] },
        { name: 'live_sessions', fields: [
          { name: 'code',     type: 'text', required: true },
          { name: 'activity', type: 'json' },
          { name: 'state',    type: 'json' },
          // `ql` FUERA del blob a propósito (ley de confianza §22): es lo único
          // que un alumno escribe en la sala (pedir la palabra en Pregunta en
          // Vivo). Al tener campo propio, la regla puede dejar `state` —fase,
          // ítem, deadline, puntajes— como HOST-ONLY.
          { name: 'ql',       type: 'json' },
        ]},
        // §22-4 — credencial del dispositivo del alumno (secreto). CERRADA por API:
        // solo se escribe al entrar y solo la consultan las reglas por join.
        // ANTES que live_answers a propósito: la regla de live_answers hace join a
        // esta colección y PocketBase VALIDA las reglas al guardarlas — con el
        // orden invertido, aplicar en un servidor sin live_claims fallaba con
        // "Failed to update collection" (pasó en la Pi).
        { name: 'live_claims', fields: [
          { name: 'session', type: 'text', required: true },
          { name: 'player',  type: 'text', required: true },
          { name: 'secret',  type: 'text', required: true },
        ], indexes: ['CREATE UNIQUE INDEX `idx_lc_session_player` ON `live_claims` (`session`, `player`)'] },
        // §22-2 — contenido COMPLETO de la sala (host-only). La sala guarda el
        // snapshot saneado; la clave, aquí.
        { name: 'live_keys', fields: [
          { name: 'session',  type: 'text', required: true },
          { name: 'activity', type: 'json' },
        ], indexes: ['CREATE UNIQUE INDEX `idx_lk_session` ON `live_keys` (`session`)'] },
        // One record per student answer → concurrent answers never clobber each
        // other (the lost-update fix). Once this exists, the realtime adapter
        // routes answers here instead of the live_sessions.state blob.
        { name: 'live_answers', fields: [
          { name: 'session', type: 'text', required: true },
          { name: 'player',  type: 'text', required: true },
          { name: 'item',    type: 'number' },
          { name: 'value',   type: 'json' },
          { name: 'ms',      type: 'number' },
          { name: 'scored',  type: 'bool' },
          { name: 'correct', type: 'bool' },
          { name: 'points',  type: 'number' },
          { name: 'unscorable', type: 'bool' },   // deuda C: liquidada pero sin clave (no puntuable)
          { name: 'v0',      type: 'json' },   // primer intento en carrera (analítica)
          { name: 'c0',      type: 'bool' },   // ¿el primer intento fue correcto?
        ], indexes: ['CREATE UNIQUE INDEX `idx_la_session_player_item` ON `live_answers` (`session`, `player`, `item`)'] },
        // One record per player (deuda A: lost-update del join). Un CREATE nunca
        // pisa a otro → 30 alumnos entrando a la vez ya no se clobbean en el blob.
        // playerId = id de la FILA. Índice único (session,name) → apodos únicos
        // ATÓMICOS (el 400 de colisión dispara el retry "Juan 2"). Ver
        // docs/historico/handoff-deuda-a.md.
        { name: 'live_players', fields: [
          { name: 'session', type: 'text', required: true },
          { name: 'name',    type: 'text', required: true },
          { name: 'user_id', type: 'text' },
        ], indexes: ['CREATE UNIQUE INDEX `idx_lp_session_name` ON `live_players` (`session`, `name`)'] },
        { name: 'assignments', fields: [
          { name: 'code',          type: 'text', required: true },
          { name: 'activity_id',   type: 'text' },
          { name: 'activity_snap', type: 'json' },
          { name: 'author_id',     type: 'text' },
          { name: 'title',         type: 'text' },
          { name: 'due_at',        type: 'text' },
          { name: 'max_attempts',  type: 'number' },
          { name: 'status',        type: 'text' },
          { name: 'created_at',    type: 'text' },
        ]},
        { name: 'assignment_attempts', fields: [
          { name: 'assignment_id', type: 'text' },
          { name: 'activity_id',   type: 'text' },
          { name: 'user_id',       type: 'text' },
          { name: 'player_name',   type: 'text' },
          { name: 'score_auto',    type: 'number' },
          { name: 'score_final',   type: 'number' },
          { name: 'max_score',     type: 'number' },
          { name: 'time_used',     type: 'number' },
          { name: 'answers',       type: 'json' },   // detalle por ítem (analítica F3)
          { name: 'attempt_no',    type: 'number' },  // §22-3: nº de intento, lo acota la regla
          { name: 'qid',           type: 'text' },    // deuda D (R1): idempotencia del reintento
          { name: 'created_at',    type: 'text' },
        ], indexes: ['CREATE UNIQUE INDEX `idx_aa_asg_user_no` ON `assignment_attempts` (`assignment_id`, `user_id`, `attempt_no`)',
                     "CREATE UNIQUE INDEX `idx_aa_qid` ON `assignment_attempts` (`qid`) WHERE `qid` != ''"] },
        // ❤ Likes de la biblioteca pública (S2): una fila por (actividad, profe).
        { name: 'activity_likes', fields: [
          { name: 'activity', type: 'text', required: true },
          { name: 'user',     type: 'text', required: true },
        ], indexes: ['CREATE UNIQUE INDEX `idx_like_act_user` ON `activity_likes` (`activity`, `user`)'] },
        // 🚩 Reportes de contenido (S3): un profe reporta; solo el admin los ve/borra.
        { name: 'reports', fields: [
          { name: 'activity', type: 'text', required: true },
          { name: 'by',       type: 'text' },
          { name: 'reason',   type: 'text' },
        ]},
        // 👤 Perfil PÚBLICO del profe (colegio, frase, avatar): separado de `users`
        // (privada por el email). Lectura pública; escritura solo del dueño. Una fila
        // por profe (id de fila = id de usuario). Ver core/profile.js.
        { name: 'profiles', fields: [
          { name: 'owner',  type: 'text', required: true },
          { name: 'name',   type: 'text' },
          { name: 'school', type: 'text' },
          { name: 'bio',    type: 'text' },
          { name: 'avatar', type: 'text' },
          { name: 'banner', type: 'text' },   // portada estilo Facebook (data-URL o vacío)
        ], indexes: ['CREATE UNIQUE INDEX `idx_profile_owner` ON `profiles` (`owner`)'] },
      ];

      // En PB ≥0.23 la clave del esquema es `fields`; en <0.23 es `schema`. Los
      // campos json necesitan maxSize explícito en 0.23 vía API.
      const schemaKey = isV23 ? 'fields' : 'schema';
      const buildField = (f) => {
        // `__declara` = los atributos que el DEFS pone EXPLÍCITAMENTE. Los que
        // se rellenan aquí por defecto (required:false, el maxSize holgado de
        // los json que no son `activities.data`) NO son una decisión nuestra,
        // así que no pueden reportarse como "desvío" del servidor: la primera
        // verificación real gritó tres falsas alarmas (tags/overrides con
        // maxSize 0, que en PocketBase significa «sin tope explícito») junto a
        // la única de verdad. Un aviso que grita en falso entrena a ignorar los
        // de verdad — la misma lección del bloque de deuda del CLAUDE.md.
        const base = { name: f.name, type: f.type, required: !!f.required, __declara: Object.keys(f) };
        if (f.type === 'json') {
          // §25 CAPACIDAD: el tope de UNA actividad lo aplica el SERVIDOR aquí
          // (maxSize del campo `data`), y el número sale de core/quotas.js — no
          // se escribe a mano en el esquema. El resto de campos json (copias de
          // la actividad en salas y tareas) deben poder ALBERGAR una actividad
          // al máximo, así que van holgados.
          const max = (f.maxSize != null) ? f.maxSize : 5242880;
          if (isV23) base.maxSize = max;
          else base.options = { maxSize: max };
        }
        return base;
      };
      // REGLAS: fuente única en core/pbRules.js (ley de confianza §22). Antes
      // vivían escritas a mano aquí Y en tools/setup-pocketbase.ps1, y
      // divergieron; ahora las dos las leen del módulo y tests/pbRules.test.mjs
      // falla si se vuelven a separar.
      const rulesFor = (name) => pbRulesFor(name) || { listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '' };
      // En PB ≥0.23 los campos created/updated NO se añaden solos al crear por API,
      // y el store ordena resultados por `sort=-created` → hay que crearlos como
      // autodate. En <0.23 se añaden automáticamente, así que no los duplicamos.
      const sysFields = isV23 ? [
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ] : [];
      // "Failed to update collection" a secas no dice QUÉ regla rebotó — PB manda
      // el detalle por campo en `data` (p.ej. createRule: "unknown collection...").
      // Aplanarlo al mensaje fue lo que faltó para diagnosticar el fallo de orden
      // live_answers→live_claims en la Pi.
      const pbErrDetail = (b, status) => {
        const parts = [];
        for (const [field, err] of Object.entries(b?.data || {})) {
          parts.push(`${field}: ${err?.message || JSON.stringify(err)}`);
        }
        return [b?.message || `error ${status}`, ...parts].join(' · ');
      };
      // `__declara` es marca INTERNA (qué atributos declara el DEFS, para no
      // reportar desvíos de lo que rellenamos por defecto). Nunca viaja a
      // PocketBase: el cuerpo de la petición se limpia aquí.
      const sinMarca = (f) => { const { __declara, ...limpio } = f; return limpio; };
      const COLLECTIONS = DEFS.map(d => ({
        name: d.name, type: 'base',
        [schemaKey]: [...d.fields.map(buildField), ...sysFields],
        ...(d.indexes ? { indexes: d.indexes } : {}),
        ...rulesFor(d.name),
      }));

      // Función auxiliar: busca la colección por nombre y devuelve su id o null.
      async function findCollection(name) {
        try {
          const r = await fetch(`${PB_URL}/api/collections/${name}`, { headers });
          if (r.ok) return (await r.json()).id;
          return null;
        } catch { return null; }
      }

      // 3. Para cada colección: si no existe → crear; si ya existe → solo
      //    actualizar las reglas de acceso (sin tocar campos ni datos).
      const results = [];
      for (const col of COLLECTIONS) {
        out.innerHTML = `<div class="text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Configurando <code>${col.name}</code>…</div>`;
        try {
          const existingId = await findCollection(col.name);
          if (existingId) {
            // Colección ya existe: actualiza reglas Y AÑADE los campos que falten
            // (append-only: nunca borra columnas existentes). Antes solo añadía
            // `activities.owner`; ahora cubre cualquier campo nuevo del DEF (p.ej.
            // `assignment_attempts.answers`, `live_answers.v0/c0`) → un update de la
            // app no exige recrear colecciones a mano.
            const patchBody = { ...rulesFor(col.name) };
            let addedFields = [], addedIdx = [];
            try {
              const cur = await (await fetch(`${PB_URL}/api/collections/${existingId}`, { headers })).json();
              const curFields = cur[schemaKey] || cur.fields || cur.schema || [];
              const curNames = new Set(curFields.map(f => f.name));
              const missing = (col[schemaKey] || []).filter(f => !curNames.has(f.name) && !['id','created','updated'].includes(f.name));
              if (missing.length) {
                patchBody[schemaKey] = [...curFields, ...missing.map(sinMarca)];
                addedFields = missing.map(f => f.name);
              }
              // Índices que FALTAN (append-only). Sin esto, un índice nuevo (p.ej.
              // el ÚNICO (session,player,item) de la deuda F, o (session,name) de la
              // deuda A) NUNCA se crea si la colección ya existía → el fix no aplica.
              // Deduplicamos por NOMBRE; nunca quitamos los que ya hay.
              // ATRIBUTOS DECLARADOS que derivaron (p.ej. `activities.data.maxSize`
              // en 0 = sin tope, cuando §25 exige 2097152). Hasta v1.51.425 esto
              // solo se REPORTABA («AJUSTAR A MANO»): cambiar un atributo en una
              // Pi compartida era decisión del dueño. El dueño la tomó
              // (2026-08-09: «establécelo de una vez»), así que ahora se CORRIGE
              // — solo atributos que el DEFS declara explícitamente (__declara),
              // nunca los rellenos por defecto, y sin tocar campos de otras
              // colecciones/proyectos. Subir o fijar maxSize no reescribe filas:
              // PocketBase lo aplica en las escrituras siguientes.
              let fixedAttrs = [];
              {
                const base = patchBody[schemaKey] ? [...patchBody[schemaKey]] : [...curFields];
                let cambió = false;
                for (const want of (col[schemaKey] || [])) {
                  const declarados = (want.__declara || []).filter(k => !['name', 'type'].includes(k));
                  if (!declarados.length) continue;
                  const i = base.findIndex(f => f.name === want.name);
                  if (i < 0) continue;
                  for (const k of declarados) {
                    const actual = base[i][k] ?? (base[i].options || {})[k];
                    if (actual !== undefined && String(actual) !== String(want[k])) {
                      base[i] = { ...base[i], [k]: want[k] };
                      if (base[i].options && k in base[i].options) base[i].options = { ...base[i].options, [k]: want[k] };
                      fixedAttrs.push(`${want.name}.${k}: ${actual} → ${want[k]}`);
                      cambió = true;
                    }
                  }
                }
                if (cambió) patchBody[schemaKey] = base;
              }
              const idxName = (sql) => (String(sql).match(/INDEX\s+[`"']?(\w+)[`"']?/i) || [])[1] || sql;
              const curIdx = cur.indexes || [];
              const curIdxNames = new Set(curIdx.map(idxName));
              const missingIdx = (col.indexes || []).filter(sql => !curIdxNames.has(idxName(sql)));
              if (missingIdx.length) {
                patchBody.indexes = [...curIdx, ...missingIdx];
                addedIdx = missingIdx.map(idxName);
              }
            } catch (readErr) {
              // ANTES este catch callaba y "reglas actualizadas" mentía por
              // omisión (así se aplicó un esquema sin `qid` en producción sin que
              // nadie lo viera). Si no se pudo leer el esquema actual, se DICE.
              results.push({ name: col.name, ok: false, msg: `no se pudo LEER el esquema para el diff de campos (${readErr?.message || readErr}) — solo se aplicarían reglas; reintenta` });
              continue;
            }
            const pr = await fetch(`${PB_URL}/api/collections/${existingId}`, {
              method: 'PATCH', headers,
              body: JSON.stringify(patchBody),
            });
            if (pr.ok) {
              const extras = [...addedFields.map(f => `campo ${f}`), ...addedIdx.map(i => `índice ${i}`),
                              ...fixedAttrs.map(a => `atributo ${a}`)];
              // VERIFICACIÓN post-aplicación: se RELEE el servidor y se compara
              // contra el DEF. La salida deja de ser "lo que intenté" y pasa a ser
              // "lo que HAY" — un campo que falte se dice con nombre, nunca más un
              // ✓ con esquema incompleto.
              let verify = '';
              try {
                const post = await (await fetch(`${PB_URL}/api/collections/${existingId}`, { headers })).json();
                const haveF = new Set((post[schemaKey] || post.fields || []).map(f => f.name));
                const wantF = (col[schemaKey] || []).map(f => f.name).filter(n => !['id','created','updated'].includes(n));
                const lackF = wantF.filter(n => !haveF.has(n));
                const idxName = (sql) => (String(sql).match(/INDEX\s+[\`"']?(\w+)[\`"']?/i) || [])[1] || sql;
                const haveI = new Set((post.indexes || []).map(idxName));
                const lackI = (col.indexes || []).map(idxName).filter(n => !haveI.has(n));
                if (lackF.length || lackI.length) {
                  results.push({ name: col.name, ok: false, msg: `reglas OK pero el servidor QUEDÓ SIN: ${[...lackF.map(f => 'campo ' + f), ...lackI.map(i => 'índice ' + i)].join(', ')}` });
                  continue;
                }
                // DERIVA DE ATRIBUTOS (R6 · fallar en silencio está prohibido).
                // La rama "ya existía" es APPEND-ONLY: añade campos e índices que
                // falten POR NOMBRE, pero nunca toca los atributos de un campo que
                // ya está. Eso dejó un agujero mudo: cuando el tope de una
                // actividad bajó de 5 MB a 2 MB (§25, v1.51.340), el `maxSize` de
                // `activities.data` se quedó en 5 MB en la Pi y ni el panel ni
                // `check-pb.sh` lo miraban — el límite de §25 era solo un aviso del
                // cliente. NO se auto-corrige a propósito: cambiar el atributo de
                // un campo con datos dentro, en una Pi COMPARTIDA con otros
                // proyectos, es una decisión del dueño. Se DICE, con el valor
                // exacto que hay que poner.
                const desvíos = [];
                for (const want of (col[schemaKey] || [])) {
                  const have = (post[schemaKey] || post.fields || []).find(f => f.name === want.name);
                  if (!have) continue;
                  const declarados = want.__declara || [];
                  for (const [k, v] of Object.entries(want)) {
                    if (k === 'name' || k === 'type' || k === '__declara' || v === undefined) continue;
                    // Solo lo que el DEFS DECLARA (ver buildField): comparar los
                    // rellenos por defecto convierte el aviso en ruido.
                    if (!declarados.includes(k)) continue;
                    const actual = have[k] ?? (have.options || {})[k];
                    if (actual !== undefined && String(actual) !== String(v)) {
                      desvíos.push(`${want.name}.${k}: el servidor tiene ${actual}, debería ser ${v}`);
                    }
                  }
                }
                verify = ` · verificado: ${wantF.length} campos`;
                if (desvíos.length) verify += ` · ⚠ AJUSTAR A MANO en pb: ${desvíos.join(' · ')}`;
              } catch { verify = ' · (sin verificar: relectura falló)'; }
              results.push({ name: col.name, ok: true, msg: (extras.length ? `reglas + ${extras.join(', ')} (ya existía)` : 'reglas actualizadas (ya existía)') + verify });
            } else {
              const b = await pr.json().catch(() => ({}));
              results.push({ name: col.name, ok: false, msg: pbErrDetail(b, pr.status) });
            }
          } else {
            // No existe → crear completa.
            const cr = await fetch(`${PB_URL}/api/collections`, {
              method: 'POST', headers,
              body: JSON.stringify({ ...col, [schemaKey]: (col[schemaKey] || []).map(sinMarca) }),
            });
            if (cr.ok) {
              results.push({ name: col.name, ok: true, msg: 'creada' });
            } else {
              const b = await cr.json().catch(() => ({}));
              results.push({ name: col.name, ok: false, msg: pbErrDetail(b, cr.status) });
            }
          }
        } catch (e) {
          results.push({ name: col.name, ok: false, msg: e.message });
        }
      }

      const allOk = results.every(r => r.ok);
      out.innerHTML = `
        <div class="alert ${allOk ? 'alert-success' : 'alert-warning'} py-2 px-3 small">
          <div class="text-muted">Aplicado con la app v${VERSION} — si acabas de actualizar, recarga con Ctrl+F5 ANTES de aplicar (una página cacheada aplica DEFS viejos).</div>
          ${results.map(r => `<div>${r.ok ? '✓' : '✗'} <code>${r.name}</code> — ${escapeHtml(r.msg)}</div>`).join('')}
          ${allOk ? '<div class="mt-1 fw-semibold">Listo. Recarga la página para activar Live, actividades en nube y tareas.</div>' : ''}
        </div>`;
    } catch (e) {
      out.innerHTML = `<div class="alert alert-danger py-1 px-2 small">Error: ${escapeHtml(e.message)}</div>`;
    } finally {
      btn.disabled = false;
      document.getElementById('pb-pass').value = '';
    }
  });
}
