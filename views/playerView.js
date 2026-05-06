// Activity page (Wordwall-style). The activity itself runs inside a
// constrained "embed" frame (max-width 960, fixed aspect-ratio per
// template). Around it: header, skin tiles, background tiles, "switch
// template" row, share/edit actions. Responsive: collapses to a tall
// auto-height frame on mobile portrait.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { get, save, remove as removeActivity } from '../core/storage.js';
import { runPlayer } from '../core/player.js';
import { activityItemCount, newActivityId } from '../core/migrate.js';
import { getTemplate, compatibleTemplates } from '../core/registry.js';
import { listSkins, applySkin, skinPreviewHtml } from '../core/skins.js';
import { listBackgrounds, applyBackground, backgroundPreviewHtml } from '../core/backgrounds.js';
import { toggleFullscreen } from '../core/fullscreen.js';
import { acquire } from '../core/lifecycle.js';
import { getUser } from '../core/auth.js';
import { toast, confirmModal } from '../core/toast.js';
import { downloadActivitiesJson } from '../core/io.js';

export async function renderPlayerView(rootSel, id) {
  const a = get(id);
  if (!a) {
    mount(rootSel, html`<div class="alert alert-warning">Actividad no encontrada. <a href="#/home">Volver</a></div>`);
    return;
  }
  const ctx = acquire('playerPage');
  let liveTemplate = a.template;
  let currentSkin = a.presentation?.skin || 'default';
  let currentBg = a.presentation?.background || 'none';
  applySkin(currentSkin);
  applyBackground(currentBg);
  ctx.add(() => { applySkin('default'); applyBackground('none'); });

  // Auth check for "Edit" visibility.
  const user = await getUser().catch(() => null);
  const canEdit = !a.author?.id || (user && user.id === a.author?.id);

  paint();

  function paint() {
    const T = getTemplate(liveTemplate) || getTemplate(a.template);
    const aspect = T?.meta?.aspectRatio || '4/3';
    const compat = compatibleTemplates(liveTemplate);

    mount(rootSel, html`
      <div class="ww-play-page">

        <div class="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
          <div>
            <a href="#/home" class="btn btn-sm btn-link p-0 mb-1"><i class="bi bi-arrow-left"></i> Inicio</a>
            <h3 class="mb-1">${escapeHtml(a.title)}</h3>
            <div class="text-muted small">
              <span class="badge bg-${T?.meta?.color || 'info'}"><i class="bi ${T?.meta?.icon || 'bi-puzzle'}"></i> ${escapeHtml(T?.meta?.label || liveTemplate)}</span>
              · ${activityItemCount(a)} elementos
              ${a.subtitle ? `· ${escapeHtml(a.subtitle)}` : ''}
            </div>
            ${(a.tags||[]).length ? `<div class="mt-1">${(a.tags||[]).map(t => `<span class="badge bg-light text-dark border me-1">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
          </div>
        </div>

        <div class="ww-player-frame mb-3" style="${aspectStyle(aspect)}" id="ww-frame">
          <div id="ww-player-widget"></div>
        </div>

        <div class="d-flex flex-wrap gap-2 mb-4">
          <button class="btn btn-sm btn-outline-secondary" id="btn-restart"><i class="bi bi-arrow-clockwise"></i> Reiniciar</button>
          <button class="btn btn-sm btn-outline-secondary" id="btn-fs"><i class="bi bi-arrows-fullscreen"></i> Pantalla completa</button>
          ${canEdit ? `<a href="#/edit/${a.id}" class="btn btn-sm btn-outline-primary"><i class="bi bi-pencil"></i> Editar</a>` : ''}
          <button class="btn btn-sm btn-outline-secondary" id="btn-link"><i class="bi bi-link-45deg"></i> Copiar link</button>
          <button class="btn btn-sm btn-outline-secondary" id="btn-json"><i class="bi bi-download"></i> JSON</button>
          <button class="btn btn-sm btn-outline-secondary" id="btn-fork"><i class="bi bi-files"></i> Duplicar</button>
        </div>

        <h6 class="text-muted text-uppercase small mb-2">Tema</h6>
        <div class="d-flex flex-wrap gap-2 mb-4">
          ${listSkins().map(s => `
            <div class="ww-pick-tile skin-pick ${currentSkin===s.name?'is-active':''}" data-name="${s.name}" role="button" title="${escapeHtml(s.description||'')}">
              ${skinPreviewHtml(s.name)}
            </div>
          `).join('')}
        </div>

        <h6 class="text-muted text-uppercase small mb-2">Fondo</h6>
        <div class="d-flex flex-wrap gap-2 mb-4">
          ${listBackgrounds().map(b => `
            <div class="ww-pick-tile bg-pick ${currentBg===b.name?'is-active':''}" data-name="${b.name}" role="button" title="${escapeHtml(b.description||'')}" style="width:120px">
              ${backgroundPreviewHtml(b.name)}
            </div>
          `).join('')}
        </div>

        ${compat.length ? `
          <h6 class="text-muted text-uppercase small mb-2">Cambiar plantilla (mismo contenido)</h6>
          <div class="d-flex flex-wrap gap-2 mb-4">
            ${compat.map(t => `
              <button class="btn btn-outline-${t.meta.color || 'secondary'} btn-sm tpl-switch" data-name="${t.meta.name}">
                <i class="bi ${t.meta.icon}"></i> ${escapeHtml(t.meta.label)}
              </button>
            `).join('')}
          </div>` : ''}

      </div>
    `);

    runPlayer('#ww-player-widget', { ...a, template: liveTemplate }, { skipChrome: true });
    wireHandlers();
  }

  function wireHandlers() {
    on(rootSel, 'click', '.skin-pick', (_, b) => {
      currentSkin = b.dataset.name; applySkin(currentSkin);
      document.querySelectorAll('.skin-pick').forEach(p => p.classList.toggle('is-active', p.dataset.name === currentSkin));
    });
    on(rootSel, 'click', '.bg-pick', (_, b) => {
      currentBg = b.dataset.name; applyBackground(currentBg);
      document.querySelectorAll('.bg-pick').forEach(p => p.classList.toggle('is-active', p.dataset.name === currentBg));
    });
    on(rootSel, 'click', '.tpl-switch', (_, b) => {
      liveTemplate = b.dataset.name;
      paint();
    });
    on(rootSel, 'click', '#btn-restart', () => {
      document.getElementById('ww-player-widget').innerHTML = '';
      runPlayer('#ww-player-widget', { ...a, template: liveTemplate }, { skipChrome: true });
    });
    // Doc-level fullscreen so the body background (notebook, blackboard…)
    // fills the interactive whiteboard, not just the activity card.
    on(rootSel, 'click', '#btn-fs', () => toggleFullscreen());
    on(rootSel, 'click', '#btn-link', async () => {
      try { await navigator.clipboard.writeText(location.href); toast('Link copiado.', 'success'); }
      catch { toast('No se pudo copiar — copia manualmente: ' + location.href, 'warning', 6000); }
    });
    on(rootSel, 'click', '#btn-json', () => downloadActivitiesJson([a.id]));
    on(rootSel, 'click', '#btn-fork', async () => {
      const fork = {
        ...a,
        id: newActivityId(),
        title: a.title + ' (copia)',
        forkOf: a.id,
        visibility: 'private',
        author: { id: user?.id || null, signedAt: new Date().toISOString() },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      save(fork);
      location.hash = `#/edit/${fork.id}`;
    });
  }
}

function aspectStyle(aspect) {
  if (aspect === 'auto') return 'aspect-ratio: auto; min-height: 50vh;';
  return `aspect-ratio: ${aspect};`;
}
