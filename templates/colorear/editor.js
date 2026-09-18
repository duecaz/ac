// Editor de Colorear — SIEMPRE sobre el SHELL (core/editorShell.js): las pestañas
// Contenido/Puntuación/Modos/En vivo/Presentación son del chasis; tú aportas
// SOLO el panel de contenido. El profe no crea nada (norte §4c: el contenido lo
// pone la plantilla): ELIGE un dibujo del banco compartido con miniaturas.
// Formulario, no el juego → px permitidos aquí.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { renderEditorJuego } from '../../core/editorJuego.js';
import { TEMAS, dibujosDe, rutaDibujo } from '../../core/bancoDibujos.js';
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
  // POR TEMAS, y no una rejilla de 43. El profe no viene a «ver el banco»: viene
  // con una idea («animales») y quiere salir de aquí en dos toques. Sin agrupar,
  // elegir era recorrer una pared de dibujos.
  return `
    <p class="text-muted small">Elige la lámina que va a colorear la clase.</p>
    ${TEMAS.map(t => `
      <h6 class="co-ed-tema">${escapeHtml(t.label)}</h6>
      <div class="co-ed-grid">
        ${dibujosDe(t.id).map(d => `
          <button type="button" class="co-ed-pick ${d.nombre === elegido ? 'co-ed-pick--on' : ''}"
                  data-dibujo="${d.nombre}" aria-pressed="${d.nombre === elegido}">
            <span class="co-ed-mini">
              <img src="${rutaDibujo(d.nombre)}" alt="" loading="lazy" decoding="async">
            </span>
            <span class="co-ed-label">${escapeHtml(d.label)}</span>
            <span class="co-ed-tick" aria-hidden="true"><i class="bi bi-check-lg"></i></span>
          </button>`).join('')}
      </div>`).join('')}`;
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
    // Se marca a mano, sin `ctx.repaint()`: repintar el editor entero rehace
    // las 43 miniaturas SVG (decodificado y maquetación de la rejilla) para
    // cambiar una clase en dos botones. Lo mismo hace el editor del puzzle.
    for (const b of root.querySelectorAll('.co-ed-pick')) {
      const elegido = b === el;
      b.classList.toggle('co-ed-pick--on', elegido);
      b.setAttribute('aria-pressed', String(elegido));
    }
  });
}
