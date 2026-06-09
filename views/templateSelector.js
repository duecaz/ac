// Template gallery driven by the registry. Auto-discovers anything registered.
import { html, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { navigate } from '../core/router.js';
import { listTemplates } from '../core/registry.js';
import { modesForTemplate } from '../core/modes.js';

export function renderTemplateSelector(rootSel) {
  const templates = listTemplates();
  // Stub "coming soon" tiles for inspiration.
  const COMING = [
    { name: 'wordsearch', label: 'Sopa de letras', icon: 'bi-grid-3x3-gap' },
    { name: 'flashcards', label: 'Tarjetas', icon: 'bi-card-text' },
    { name: 'crossword', label: 'Crucigrama', icon: 'bi-grid-3x3' },
    { name: 'groupsort', label: 'Agrupar', icon: 'bi-collection' }
  ];

  mount(rootSel, html`
    <h2 class="mb-3">Elige una plantilla</h2>
    <div class="row g-3">
      ${templates.map(T => `
        <div class="col-md-3 col-6">
          <button class="btn btn-outline-${T.meta.color || 'primary'} w-100 py-4 tpl-pick" data-name="${T.meta.name}">
            <i class="bi ${T.meta.icon} display-4 d-block"></i>
            <span class="mt-2 d-block">${T.meta.label}</span>
            <small class="d-block text-muted">${modesForTemplate(T).map(m => m.short).join(' · ')}</small>
          </button>
        </div>
      `).join('')}
      ${COMING.filter(c => !templates.find(t => t.meta.name === c.name)).map(c => `
        <div class="col-md-3 col-6">
          <button class="btn btn-outline-secondary w-100 py-4" disabled>
            <i class="bi ${c.icon} display-4 d-block"></i>
            <span class="mt-2 d-block">${c.label}</span>
            <small class="d-block text-muted">Próximamente</small>
          </button>
        </div>
      `).join('')}
    </div>
  `);
  on(rootSel, 'click', '.tpl-pick', (_, b) => navigate(`#/edit-new/${b.dataset.name}`));
}
