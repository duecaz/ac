// Activity play page. The activity itself runs inside a self-contained
// widget; the page chrome (title, fullscreen, skin/background pickers)
// stays around so the user can re-skin live, like Wordwall.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { get } from '../core/storage.js';
import { runPlayer } from '../core/player.js';
import { activityItemCount } from '../core/migrate.js';
import { getTemplate } from '../core/registry.js';
import { listSkins, applySkin } from '../core/skins.js';
import { listBackgrounds, applyBackground } from '../core/backgrounds.js';
import { fullscreenButtonHtml, attachFullscreenButton } from '../core/fullscreen.js';
import { acquire } from '../core/lifecycle.js';

export function renderPlayerView(rootSel, id) {
  const a = get(id);
  if (!a) {
    mount(rootSel, html`<div class="alert alert-warning">Actividad no encontrada. <a href="#/home">Volver</a></div>`);
    return;
  }

  const ctx = acquire('playerPage');
  const T = getTemplate(a.template);
  let currentSkin = a.presentation?.skin || 'default';
  let currentBg = a.presentation?.background || 'none';
  applySkin(currentSkin);
  applyBackground(currentBg);
  ctx.add(() => { applySkin('default'); applyBackground('none'); });

  mount(rootSel, html`
    <div class="ww-play-page">
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <a href="#/home" class="btn btn-link"><i class="bi bi-arrow-left"></i> Volver</a>
        <h5 class="mb-0">
          ${escapeHtml(a.title)}
          <span class="badge bg-${T?.meta?.color || 'info'}"><i class="bi ${T?.meta?.icon || 'bi-puzzle'}"></i> ${escapeHtml(T?.meta?.label || a.template)}</span>
          <small class="text-muted">· ${activityItemCount(a)} elementos</small>
        </h5>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" id="btn-restart" title="Reiniciar"><i class="bi bi-arrow-clockwise"></i></button>
          ${fullscreenButtonHtml()}
        </div>
      </div>

      <div id="ww-player-widget" class="card p-3 mb-3" style="min-height:60vh"></div>

      <div class="ww-skin-row mb-2">
        <small class="text-muted me-2">Skin:</small>
        ${listSkins().map(s => `
          <button class="btn btn-sm me-1 mb-1 skin-pill ${currentSkin===s.name?'btn-dark':'btn-outline-secondary'}" data-name="${s.name}" title="${escapeHtml(s.description||'')}">${escapeHtml(s.label)}</button>
        `).join('')}
      </div>
      <div class="ww-bg-row">
        <small class="text-muted me-2">Fondo:</small>
        ${listBackgrounds().map(b => `
          <button class="btn btn-sm me-1 mb-1 bg-pill ${currentBg===b.name?'btn-dark':'btn-outline-secondary'}" data-name="${b.name}" title="${escapeHtml(b.description||'')}">${escapeHtml(b.label)}</button>
        `).join('')}
      </div>
    </div>
  `);

  attachFullscreenButton(rootSel);

  // Run the activity into the widget. skipChrome: page is in charge of skin/bg.
  runPlayer('#ww-player-widget', a, { skipChrome: true });

  on(rootSel, 'click', '.skin-pill', (_, b) => {
    currentSkin = b.dataset.name;
    applySkin(currentSkin);
    document.querySelectorAll('.skin-pill').forEach(p => {
      p.classList.toggle('btn-dark', p.dataset.name === currentSkin);
      p.classList.toggle('btn-outline-secondary', p.dataset.name !== currentSkin);
    });
  });
  on(rootSel, 'click', '.bg-pill', (_, b) => {
    currentBg = b.dataset.name;
    applyBackground(currentBg);
    document.querySelectorAll('.bg-pill').forEach(p => {
      p.classList.toggle('btn-dark', p.dataset.name === currentBg);
      p.classList.toggle('btn-outline-secondary', p.dataset.name !== currentBg);
    });
  });
  on(rootSel, 'click', '#btn-restart', () => {
    document.getElementById('ww-player-widget').innerHTML = '';
    runPlayer('#ww-player-widget', a, { skipChrome: true });
  });
}
