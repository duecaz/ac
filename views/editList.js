// Editor for 'list' activities — a sequence of existing VS-compatible activities
// played in order with accumulated scores and a final combined podium.
import { html, escapeHtml, mount } from '../core/html.js';
import { get, save, list } from '../core/storage.js';
import { newActivityId } from '../core/migrate.js';
import { navigate } from '../core/router.js';
import { toast } from '../core/toast.js';
import { isVsCompatible } from '../kernel/session/engine.js';
import { sessionItems } from '../kernel/content/sessionItems.js';

function newListActivity() {
  return {
    id: newActivityId(),
    template: 'list',
    title: 'Nueva lista',
    subtitle: '',
    content: { items: [], mode: 'vs' },
    tags: [],
    language: 'es',
    visibility: 'unlisted',
    schemaVersion: 4,
    templateVersion: 1,
    rules: {},
    scoring: {},
    review: {},
    presentation: {},
    live: {},
    author: { id: null, name: null, signedAt: null },
    media: {},
    forkOf: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function renderEditList(rootSel, { id } = {}) {
  const host = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
  if (!host) return;

  let lista = id ? get(id) : null;
  if (!lista) {
    lista = newListActivity();
    save(lista);
  }

  // Only offer VS-compatible activities (need ≥2 items + auto-scoring).
  // Exclude other list activities and itself to avoid circular references.
  const candidates = list().filter(a =>
    a.template !== 'list' && a.id !== lista.id && isVsCompatible(a)
  );

  paint();

  function paint() {
    const selectedIds = (lista.content?.items || []).map(i => i.activityId);
    const selected = selectedIds.map(sid => candidates.find(a => a.id === sid)).filter(Boolean);
    const available = candidates.filter(a => !selectedIds.includes(a.id));

    mount(host, html`
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <a href="#/mine" class="btn btn-link"><i class="bi bi-arrow-left"></i> Volver</a>
        <button class="btn btn-primary" id="list-save"><i class="bi bi-cloud-arrow-up"></i> Guardar</button>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-md-8">
          <label class="form-label fw-semibold">Título de la lista</label>
          <input id="list-title" class="form-control form-control-lg"
                 value="${escapeHtml(lista.title)}" placeholder="Mi lista de actividades">
        </div>
        <div class="col-md-4">
          <label class="form-label fw-semibold">Subtítulo</label>
          <input id="list-subtitle" class="form-control"
                 value="${escapeHtml(lista.subtitle || '')}" placeholder="Opcional">
        </div>
      </div>

      <h5 class="mb-3"><i class="bi bi-collection-play"></i> Rondas (${selected.length})</h5>
      ${selected.length === 0 ? `
        <p class="text-muted mb-3">Aún no hay rondas. Añade actividades abajo.</p>
      ` : `
        <div class="mb-4">
          ${selected.map((a, i) => `
            <div class="d-flex align-items-center gap-2 p-2 border rounded mb-2 bg-light">
              <span class="badge bg-secondary flex-shrink-0">${i + 1}</span>
              <span class="flex-grow-1 fw-semibold text-truncate">${escapeHtml(a.title)}</span>
              <small class="text-muted flex-shrink-0">${sessionItems(a).length} preg.</small>
              <button class="btn btn-sm btn-outline-danger list-remove flex-shrink-0"
                      data-id="${escapeHtml(a.id)}" title="Quitar de la lista">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>`).join('')}
        </div>
      `}

      <h6 class="text-muted text-uppercase small mb-2">Actividades disponibles</h6>
      ${available.length === 0 ? `
        <p class="text-muted small">No hay actividades VS-compatibles para añadir.
          <a href="#/new">Crea una</a> y vuelve aquí.
        </p>
      ` : `
        <div class="row g-2">
          ${available.map(a => `
            <div class="col-md-6 col-lg-4">
              <button class="btn btn-outline-secondary w-100 text-start list-add" data-id="${escapeHtml(a.id)}">
                <div class="fw-semibold text-truncate">${escapeHtml(a.title)}</div>
                <small class="text-muted">${sessionItems(a).length} preguntas</small>
              </button>
            </div>`).join('')}
        </div>
      `}
    `);

    document.getElementById('list-save')?.addEventListener('click', doSave);

    document.querySelectorAll('.list-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const rmId = btn.dataset.id;
        recogerCampos();   // lo tecleado sobrevive al repintado
        lista.content.items = (lista.content.items || []).filter(i => i.activityId !== rmId);
        lista.updatedAt = new Date().toISOString();
        save(lista);
        paint();
      });
    });

    document.querySelectorAll('.list-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const addId = btn.dataset.id;
        recogerCampos();   // lo tecleado sobrevive al repintado
        if (!(lista.content.items || []).some(i => i.activityId === addId)) {
          lista.content.items = [...(lista.content.items || []), { activityId: addId }];
          lista.updatedAt = new Date().toISOString();
          save(lista);
          paint();
        }
      });
    });
  }

  // Título y subtítulo viven en INPUTS, y añadir o quitar una actividad
  // REPINTA la pantalla entera desde `lista` — así que lo tecleado y aún no
  // volcado se perdía: escribías el nombre de la lista, añadías la primera
  // actividad y el título volvía a "Nueva lista" (§24: el contenido es del
  // usuario, no se pierde por un repintado). Se recoge ANTES de cada repintado.
  function recogerCampos() {
    const title = document.getElementById('list-title')?.value?.trim();
    const subtitle = document.getElementById('list-subtitle')?.value?.trim();
    if (title) lista.title = title;
    if (subtitle !== undefined) lista.subtitle = subtitle;
  }

  function doSave() {
    recogerCampos();
    lista.updatedAt = new Date().toISOString();
    save(lista);
    toast('Lista guardada.', 'success');
    navigate('#/home');
  }
}
