import { html, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { navigate } from '../core/router.js';

const TEMPLATES = [
  { name: 'quiz', label: 'Quiz', icon: 'bi-question-circle-fill', color: 'primary', enabled: true },
  { name: 'match', label: 'Emparejar', icon: 'bi-link-45deg', color: 'secondary', enabled: false },
  { name: 'fill', label: 'Rellenar', icon: 'bi-input-cursor-text', color: 'secondary', enabled: false },
  { name: 'wheel', label: 'Ruleta', icon: 'bi-bullseye', color: 'secondary', enabled: false }
];

export function renderTemplateSelector(rootSel) {
  mount(rootSel, html`
    <h2 class="mb-3">Elige una plantilla</h2>
    <div class="row g-3">
      ${TEMPLATES.map(t => `
        <div class="col-md-3 col-6">
          <button class="btn btn-${t.enabled?'outline-':''}${t.color} w-100 py-4 tpl-pick" data-name="${t.name}" ${t.enabled?'':'disabled'}>
            <i class="bi ${t.icon} display-4 d-block"></i>
            <span class="mt-2 d-block">${t.label}</span>
            ${t.enabled ? '' : '<small class="d-block text-muted">Próximamente</small>'}
          </button>
        </div>
      `).join('')}
    </div>
  `);
  on(rootSel, 'click', '.tpl-pick', (_, b) => navigate(`#/edit-new/${b.dataset.name}`));
}
