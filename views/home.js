import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { list, remove } from '../core/storage.js';
import { navigate } from '../core/router.js';

export function renderHome(rootSel) {
  const acts = list();
  mount(rootSel, html`
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="mb-0">Mis actividades</h2>
      <a href="#/new" class="btn btn-primary"><i class="bi bi-plus-lg"></i> Nueva</a>
    </div>
    ${acts.length === 0 ? `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-collection display-1"></i>
        <p class="mt-3">Aún no hay actividades. Crea la primera.</p>
      </div>` : `
      <div class="row g-3">
        ${acts.map(a => `
          <div class="col-md-6 col-lg-4">
            <div class="card h-100">
              <div class="card-body">
                <div class="d-flex justify-content-between">
                  <span class="badge bg-info text-dark">${escapeHtml(a.template)}</span>
                  <small class="text-muted">${a.content.items.length} pregs.</small>
                </div>
                <h5 class="card-title mt-2">${escapeHtml(a.title)}</h5>
                <p class="card-text small text-muted">${escapeHtml(a.subtitle || '')}</p>
              </div>
              <div class="card-footer d-flex gap-1 flex-wrap">
                <button class="btn btn-success btn-sm flex-grow-1 act-play" data-id="${a.id}"><i class="bi bi-play-fill"></i> Empezar</button>
                <button class="btn btn-warning btn-sm flex-grow-1 act-pin" data-id="${a.id}" disabled title="Fase 2"><i class="bi bi-broadcast"></i> PIN</button>
                <button class="btn btn-outline-primary btn-sm act-edit" data-id="${a.id}"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-outline-danger btn-sm act-del" data-id="${a.id}"><i class="bi bi-trash"></i></button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>`}
  `);

  on(rootSel, 'click', '.act-play', (_, b) => navigate(`#/play/${b.dataset.id}`));
  on(rootSel, 'click', '.act-edit', (_, b) => navigate(`#/edit/${b.dataset.id}`));
  on(rootSel, 'click', '.act-del', (_, b) => {
    if (!confirm('¿Eliminar esta actividad?')) return;
    remove(b.dataset.id);
    renderHome(rootSel);
  });
}
