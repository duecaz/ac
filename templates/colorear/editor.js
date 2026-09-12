// Editor de Colorear — SIEMPRE sobre el SHELL (core/editorShell.js): las pestañas
// Contenido/Puntuación/Modos/En vivo/Presentación son del chasis; tú aportas
// SOLO el panel de contenido. El profe no crea nada (norte §4c: el contenido lo
// pone la plantilla): ELIGE un dibujo del banco compartido con miniaturas.
// Formulario, no el juego → px permitidos aquí.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { renderEditorJuego } from '../../core/editorJuego.js';
import { DIBUJOS } from '../../core/bancoDibujos.js';
import { ensureContent, contenidoColorear as contenido } from './content.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 */

/**
 * @param {Element} root
 * @param {Activity} activity
 * @param {(activity: Activity) => void} onChange
 * @returns {void}
 */
export const renderColorearEditor = (root, activity, onChange) =>
  renderEditorJuego(root, activity, onChange, { asegurar: ensureContent, etiqueta: 'Dibujo', html: contentHtml, wire: wireContent });

/** @param {Activity} a @returns {string} */
function contentHtml(a) {
  const elegido = contenido(a).items[0].dibujo;
  return `
    <p class="text-muted small">Elige el dibujo que va a colorear la clase.</p>
    <div class="co-ed-grid">
      ${DIBUJOS.map(d => `
        <button type="button" class="co-ed-pick ${d.nombre === elegido ? 'co-ed-pick--on' : ''}"
                data-dibujo="${d.nombre}" aria-pressed="${d.nombre === elegido}">
          <span class="co-ed-mini"><i class="bi bi-image"></i></span>
          <span class="co-ed-label">${escapeHtml(d.label)}</span>
        </button>`).join('')}
    </div>`;
}

/**
 * @param {Element} root
 * @param {Activity} a
 * @param {import('../../core/editorShell.js').EditorCtx} ctx
 * @returns {void}
 */
function wireContent(root, a, ctx) {
  on(root, 'click', '.co-ed-pick', (_e, el) => {
    const nombre = el.dataset.dibujo;
    if (!nombre || nombre === contenido(a).items[0].dibujo) return;
    contenido(a).items[0].dibujo = nombre;
    ctx.onChange(a);
    ctx.repaint();
  });
}
