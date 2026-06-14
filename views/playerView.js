// Activity page (Wordwall-style). The activity itself runs inside a
// constrained "embed" frame (max-width 960, fixed aspect-ratio per
// template). Around it: header, skin tiles, background tiles, "switch
// template" row, share/edit actions. Responsive: collapses to a tall
// auto-height frame on mobile portrait.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { get, save, getRemote, remove as removeActivity } from '../core/storage.js';
import { activityItemCount, newActivityId } from '../core/migrate.js';
import { getTemplate, compatibleTemplates } from '../core/registry.js';
import { isVsCompatible } from '../kernel/session/engine.js';
import { availableModes, getMode, runMode } from '../core/modes.js';
import { listSkins, applySkin, skinPreviewHtml } from '../core/skins.js';
import { listVsAnimations } from '../core/vsAnimations.js';
import { listBackgrounds, applyBackground, reapplyBackground, backgroundPreviewHtml } from '../core/backgrounds.js';
import { toggleFullscreen } from '../core/fullscreen.js';
import { acquire } from '../core/lifecycle.js';
import { toast, confirmModal } from '../core/toast.js';
import { downloadActivitiesJson } from '../core/io.js';
import { openEmbedModal } from './embedModal.js';

export async function renderPlayerView(rootSel, id) {
  let a = get(id);
  // Banco compartido: si no está en local, tráela de la nube (acceso por URL
  // desde cualquier dispositivo/profe) y cachéala localmente.
  if (!a) {
    a = await getRemote(id).catch(() => null);
    if (a) save(a);
  }
  if (!a) {
    mount(rootSel, html`<div class="alert alert-warning">Actividad no encontrada. <a href="#/home">Volver</a></div>`);
    return;
  }
  const ctx = acquire('playerPage');
  let liveTemplate = a.template;
  let currentSkin = a.presentation?.skin || 'default';
  let currentBg = a.presentation?.background || 'none';
  const vsCapable = isVsCompatible(a);
  // The currently selected embedded mode and its teardown handle. The activity
  // stage hosts ONE mode at a time (Individual by default); switching modes
  // disposes the previous one (stops VS animations, etc.). See core/modes.js.
  let currentMode = 'solo';
  let currentDisposer = null;
  ctx.add(() => { if (currentDisposer) { try { currentDisposer.dispose(); } catch {} currentDisposer = null; } });
  // Reset any prior global skin/bg from other views (host live, etc.) so the
  // page chrome stays neutral. Scoped apply happens after paint() once the
  // frame element exists.
  applySkin('default');
  applyBackground('none');
  ctx.add(() => { applySkin('default'); applyBackground('none'); });

  // Auth check for "Edit" visibility.
  // Banco compartido sin dueño: cualquiera puede editar.
  const canEdit = true;

  paint();

  // The activity as it will be PLAYED: the chosen "switch template" wins over
  // the stored one, so mode gating + the running game both follow the preview.
  function playActivity() { return { ...a, template: liveTemplate }; }

  // The "Modos de juego" bar, built entirely from the mode registry so gating
  // lives in ONE place (core/modes.js). Embedded modes are buttons that mount
  // into the stage; embed:false modes (En vivo, Tarea) are links to their page.
  function modeBarHtml(act) {
    return availableModes(act).map(m => {
      const ok = m.isAvailable(act);
      if (!m.embed) {
        return ok
          ? `<a href="${m.href(a)}" class="btn btn-outline-${m.color}"><i class="bi ${m.icon}"></i> ${escapeHtml(m.label)}</a>`
          : `<button class="btn btn-outline-secondary" disabled title="${escapeHtml(m.disabledHint || '')}"><i class="bi ${m.icon}"></i> ${escapeHtml(m.label)}</button>`;
      }
      if (!ok) {
        return `<button class="btn btn-outline-secondary" disabled title="${escapeHtml(m.disabledHint || '')}"><i class="bi ${m.icon}"></i> ${escapeHtml(m.label)}</button>`;
      }
      const active = m.id === currentMode;
      return `<button class="btn btn-${active ? '' : 'outline-'}${m.color} ww-mode${active ? ' is-active' : ''}" data-mode="${m.id}" title="${escapeHtml(m.title || '')}"><i class="bi ${m.icon}"></i> ${escapeHtml(m.label)}</button>`;
    }).join('');
  }

  // Swap the stage to a different embedded mode: tear down the previous one,
  // expand the frame for shared-screen modes (VS/Equipos need room), highlight
  // the active button, and mount. Solo keeps the template's fixed aspect ratio.
  async function selectMode(id) {
    const m = getMode(id);
    if (!m || !m.embed) return; // embed:false modes navigate via their link
    if (currentDisposer) { try { currentDisposer.dispose(); } catch {} currentDisposer = null; }
    currentMode = id;
    document.querySelectorAll('.ww-mode').forEach(btn => {
      const on = btn.dataset.mode === id;
      btn.classList.toggle('is-active', on);
      const color = getMode(btn.dataset.mode)?.color || 'secondary';
      btn.classList.toggle('btn-' + color, on);
      btn.classList.toggle('btn-outline-' + color, !on);
    });
    document.getElementById('ww-frame')?.classList.toggle('is-expanded', id !== 'solo');
    currentDisposer = await runMode(id, '#ww-player-widget', playActivity(), ctx);
  }

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

        <h6 class="text-muted text-uppercase small mb-2">Modos de juego</h6>
        <div class="d-flex flex-wrap gap-2 mb-4 ww-modes">
          ${modeBarHtml(playActivity())}
        </div>

        <div class="d-flex flex-wrap gap-2 mb-4">
          <button class="btn btn-sm btn-outline-secondary" id="btn-restart"><i class="bi bi-arrow-clockwise"></i> Reiniciar</button>
          <button class="btn btn-sm btn-outline-secondary" id="btn-fs"><i class="bi bi-arrows-fullscreen"></i> Pantalla completa</button>
          ${canEdit ? `<a href="#/edit/${a.id}" class="btn btn-sm btn-outline-primary"><i class="bi bi-pencil"></i> Editar</a>` : ''}
          <button class="btn btn-sm btn-outline-secondary" id="btn-link"><i class="bi bi-link-45deg"></i> Copiar link</button>
          <button class="btn btn-sm btn-outline-secondary" id="btn-embed"><i class="bi bi-code-square"></i> Embed</button>
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

        ${vsCapable ? `
          <h6 class="text-muted text-uppercase small mb-2">Animación del duelo VS</h6>
          <div class="d-flex flex-wrap gap-2 mb-2">
            ${listVsAnimations().map(v => `
              <div class="ww-pick-tile vsanim-pick ${(a.presentation?.vsAnimation || 'svg-tug') === v.id ? 'is-active' : ''}" data-id="${v.id}" data-needssrc="${v.needsSrc ? '1' : ''}" role="button" title="${escapeHtml(v.description || '')}" style="width:150px">
                <div class="vsanim-tile-body"><i class="bi ${v.kind === 'lottie' ? 'bi-filetype-json' : 'bi-people-fill'}"></i><div class="small fw-semibold mt-1">${escapeHtml(v.label)}</div></div>
              </div>
            `).join('')}
          </div>
          <div id="vsanim-src-row" class="mb-4 ${listVsAnimations().find(v => v.id === (a.presentation?.vsAnimation))?.needsSrc ? '' : 'd-none'}" style="max-width:520px">
            <label class="form-label small text-muted">URL del archivo Lottie (.json) de tu animación</label>
            <input id="vsanim-src" class="form-control form-control-sm" placeholder="https://…/animacion.json" value="${escapeHtml(a.presentation?.vsAnimationSrc || '')}">
            <div class="form-text">Línea de tiempo: fotograma 0 = gana izquierda · último = gana derecha · centro = empate.</div>
          </div>` : ''}

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

    // Scope skin + bg to the freshly-rendered frame so the page chrome
    // around the embed doesn't change when the user picks a theme.
    const frame = document.getElementById('ww-frame');
    applySkin(currentSkin, frame);
    applyBackground(currentBg, frame);
    // Re-mount the active mode (default Individual). If a template switch made
    // the active mode incompatible (e.g. VS off after switching), fall back.
    const act = playActivity();
    if (!getMode(currentMode)?.isAvailable(act)) currentMode = 'solo';
    selectMode(currentMode);
    wireHandlers();
  }

  function wireHandlers() {
    on(rootSel, 'click', '.skin-pick', (_, b) => {
      currentSkin = b.dataset.name;
      applySkin(currentSkin, document.getElementById('ww-frame'));
      document.querySelectorAll('.skin-pick').forEach(p => p.classList.toggle('is-active', p.dataset.name === currentSkin));
    });
    on(rootSel, 'click', '.bg-pick', (_, b) => {
      currentBg = b.dataset.name;
      applyBackground(currentBg, document.getElementById('ww-frame'));
      document.querySelectorAll('.bg-pick').forEach(p => p.classList.toggle('is-active', p.dataset.name === currentBg));
    });
    on(rootSel, 'click', '.tpl-switch', (_, b) => {
      liveTemplate = b.dataset.name;
      paint();
    });
    // VS animation: persisted per-activity (like skin/bg in the editor). The
    // duel reads activity.presentation.vsAnimation / .vsAnimationSrc on launch.
    on(rootSel, 'click', '.vsanim-pick', (_, b) => {
      if (!a.presentation) a.presentation = {};
      a.presentation.vsAnimation = b.dataset.id;
      save(a);
      document.querySelectorAll('.vsanim-pick').forEach(p => p.classList.toggle('is-active', p === b));
      document.getElementById('vsanim-src-row')?.classList.toggle('d-none', !b.dataset.needssrc);
    });
    on(rootSel, 'input', '#vsanim-src', (e) => {
      if (!a.presentation) a.presentation = {};
      a.presentation.vsAnimationSrc = e.target.value.trim();
      save(a);
    });
    // Mode bar: embedded modes mount into the stage (embed:false modes are
    // plain links and navigate on their own).
    on(rootSel, 'click', '.ww-mode', (_, b) => {
      selectMode(b.dataset.mode);
      document.getElementById('ww-frame')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    // Restart re-mounts whatever mode is active (new game / fresh setup).
    on(rootSel, 'click', '#btn-restart', () => selectMode(currentMode));
    // Frame-level fullscreen: only the embed expands, not the page (YouTube-like).
    on(rootSel, 'click', '#btn-fs', () => toggleFullscreen(document.getElementById('ww-frame')));
    on(rootSel, 'click', '#btn-link', async () => {
      try { await navigator.clipboard.writeText(location.href); toast('Link copiado.', 'success'); }
      catch { toast('No se pudo copiar — copia manualmente: ' + location.href, 'warning', 6000); }
    });
    on(rootSel, 'click', '#btn-embed', () => openEmbedModal(a));
    on(rootSel, 'click', '#btn-json', () => downloadActivitiesJson([a.id]));
    on(rootSel, 'click', '#btn-fork', async () => {
      const fork = {
        ...a,
        id: newActivityId(),
        title: a.title + ' (copia)',
        forkOf: a.id,
        visibility: 'private',
        author: null,
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
