// v1.51.629: adminView se partió POR PANEL. Esta sección es «Profesores»
// (U5): lista users + nº de actividades + dar/quitar admin, y crear una
// cuenta con correo+contraseña para pizarras sin cuenta de Google.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { toast } from '../../core/toast.js';
import { createTeacher, getAuthUserId } from '../../core/auth.js';
import { listTeachers, setTeacherRole, countActivitiesByOwner } from '../../core/teachers.js';

export function createTeachersSection() {
  return {
    html: () => `
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
      </div>`,
    wire: (rootSel) => {
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
    },
  };
}
