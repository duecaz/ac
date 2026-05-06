import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { get } from '../core/storage.js';
import { runPlayer } from '../core/player.js';
import { activityItemCount } from '../core/migrate.js';
import { getTemplate } from '../core/registry.js';

export function renderPlayerView(rootSel, id) {
  const a = get(id);
  if (!a) {
    mount(rootSel, html`<div class="alert alert-warning">Actividad no encontrada. <a href="#/home">Volver</a></div>`);
    return;
  }
  const T = getTemplate(a.template);
  const label = T?.meta?.label || a.template;
  mount(rootSel, html`
    <div class="text-center py-5">
      <h1 class="mb-1">${escapeHtml(a.title)}</h1>
      <p class="lead text-muted">${escapeHtml(a.subtitle || '')}</p>
      <p class="text-muted">${activityItemCount(a)} elementos · plantilla ${escapeHtml(label)}</p>
      <button class="btn btn-primary btn-lg" id="btn-start"><i class="bi bi-play-fill"></i> Empezar</button>
    </div>
  `);
  on(rootSel, 'click', '#btn-start', () => runPlayer(rootSel, a));
}
