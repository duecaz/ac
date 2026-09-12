// LA CABECERA DE LA PÁGINA DE JUGAR: quién es esta actividad y qué se puede
// hacer con ella (editar · crear · compartir · reiniciar · embeber · duplicar).
//
// Sale de views/playerView.js (Fase 6 del plan de simplificar). NO es la
// cabecera del JUEGO (`cabeceraHtml` de core/playerHud.js, que vive DENTRO del
// marco con el reloj y las herramientas): esta es el chrome de la página que
// rodea el marco, y por eso se llama distinto.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { save } from '../../core/storage.js';
import { activityItemCount, newActivityId } from '../../core/migrate.js';
import { clearSoloProgress } from '../../core/soloPlayer.js';
import { toast, TOAST_LARGO } from '../../core/toast.js';
import { openEmbedModal } from '../embedModal.js';

/** @typedef {import('../../kernel/contracts/activity.js').Activity} Activity */
/** @typedef {import('../../core/registry.js').PlantillaRegistrada} PlantillaRegistrada */

/**
 * @param {Activity} a
 * @param {Object} opts
 * @param {PlantillaRegistrada|null|undefined} opts.T  la plantilla, para su etiqueta
 * @param {boolean} opts.canEdit
 */
export function cabeceraPaginaHtml(a, { T, canEdit }) {
  return `
    <div class="pp-header">
      <!-- Como en la foto: título · etiqueta de plantilla · «N elementos ·
           por fulano», todo en UNA línea de base (envuelve si no cabe). -->
      <div class="pp-header-info">
        <h1 class="pp-title">${escapeHtml(a.title)}</h1>
        <span class="badge bg-${T?.meta?.color || 'info'}"><i class="bi ${T?.meta?.icon || 'bi-puzzle'}"></i> ${escapeHtml(T?.meta?.label || a.template)}</span>
        <span class="text-muted small pp-meta">${activityItemCount(a)} elementos
          · por ${a.author?.id ? `<a href="#/autor/${escapeHtml(a.author.id)}">${escapeHtml(a.author.name || 'Profesor')}</a>` : 'anónimo'}
          ${a.subtitle ? `· ${escapeHtml(a.subtitle)}` : ''}</span>
        ${(a.tags||[]).length ? `<span class="pp-tags">${(a.tags||[]).map(t => `<span class="badge bg-light text-dark border me-1">${escapeHtml(t)}</span>`).join('')}</span>` : ''}
      </div>
      <!-- Reiniciar y pantalla completa YA VIVEN dentro del marco (corner
           button + "jugar otra vez" de cada modo, core/afterPlay.js) — no se
           repiten aquí. Editar sale arriba junto a Crear SOLO si es tuya
           (canEdit real, ya no un valor fijo). Lo que sobra — reiniciar
           desde fuera, Embed, Duplicar — va al menú de puntos.
           Con la MISMA gramática de botón que «Mis actividades»
           (.btn-ghost / .btn-primary-solid), no la de Bootstrap. -->
      <div class="pp-header-actions">
        ${canEdit ? `<a href="#/edit/${a.id}" class="btn-ghost"><i class="bi bi-pencil"></i> Editar actividad</a>` : ''}
        <a href="#/new" class="btn-primary-solid"><i class="bi bi-plus-lg"></i> Crear actividad</a>
        <button class="btn-ghost" id="btn-share"><i class="bi bi-share"></i> Compartir</button>
        <div class="dropdown">
          <button class="btn-ghost btn-ghost--icon" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Más acciones" aria-label="Más acciones">
            <i class="bi bi-three-dots"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><button class="dropdown-item" id="btn-restart"><i class="bi bi-arrow-clockwise"></i> Reiniciar</button></li>
            <!-- «beta» a propósito: embeber está FUERA DE LA ESCENA por ahora
                 (norte §7c) — pinta, pero nadie lo ha validado dentro de un
                 blog o un LMS. La puerta entornada se DICE ANTES. -->
            <li><button class="dropdown-item" id="btn-embed"><i class="bi bi-code-square"></i> Embed <span class="badge bg-secondary">beta</span></button></li>
            <li><button class="dropdown-item" id="btn-fork"><i class="bi bi-files"></i> Duplicar</button></li>
          </ul>
        </div>
      </div>
    </div>`;
}

/**
 * @param {string|Element} rootSel
 * @param {Activity} a
 * @param {Object} opts
 * @param {string} opts.id  el id por el que se llegó (el del progreso guardado)
 * @param {() => void} opts.onRestart  vuelve a montar el modo activo, de cero
 */
export function wireCabeceraPagina(rootSel, a, { id, onRestart }) {
  // Restart re-mounts whatever mode is active (new game / fresh setup).
  // Borra el progreso guardado para que REINICIE de verdad (no reanude).
  // Vive en el menú de puntos ahora: el corner button del marco ya cubre
  // pantalla completa, así que ese botón suelto se quitó sin reemplazo.
  on(rootSel, 'click', '#btn-restart', () => { clearSoloProgress(id); onRestart(); });
  on(rootSel, 'click', '#btn-share', async () => {
    try { await navigator.clipboard.writeText(location.href); toast('Link copiado.', 'success'); }
    catch { toast('No se pudo copiar — copia manualmente: ' + location.href, 'warning', TOAST_LARGO); }
  });
  on(rootSel, 'click', '#btn-embed', () => openEmbedModal(a));
  on(rootSel, 'click', '#btn-fork', async () => {
    const fork = /** @type {Activity} */ ({
      ...a,
      id: newActivityId(),
      title: a.title + ' (copia)',
      forkOf: a.id,
      visibility: 'unlisted',
      author: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    save(fork);
    location.hash = `#/edit/${fork.id}`;
  });
}
