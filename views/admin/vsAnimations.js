// v1.51.629: adminView se partió POR PANEL. Esta sección es «Animaciones
// VS»: catálogo (bundled + custom) que alimenta el selector de
// Presentación → Animación, con alta/baja de animaciones subidas por el
// profe (guardadas en localStorage, core/vsAnimStore.js).
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { confirmModal, toast } from '../../core/toast.js';
import { listVsAnimations } from '../../core/vsAnimations.js';
import { loadCustomAnims, addCustomAnim, removeCustomAnim } from '../../core/vsAnimStore.js';

export function createVsAnimationsSection() {
  return {
    html: () => `
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
      </p>`,
    wire: (rootSel) => {
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
    },
  };
}
