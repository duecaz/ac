// Editor de Colorear — SIEMPRE sobre el SHELL (core/editorShell.js): las pestañas
// Contenido/Puntuación/Modos/En vivo/Presentación son del chasis; tú aportas
// SOLO el panel de contenido. El profe no crea nada (norte §4c: el contenido lo
// pone la plantilla): ELIGE un dibujo del banco compartido con miniaturas.
// Formulario, no el juego → px permitidos aquí.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { renderEditorJuego } from '../../core/editorJuego.js';
import { rid } from '../../core/ids.js';
import { DIBUJOS } from '../../core/bancoDibujos.js';

/** Garantiza un ítem con dibujo válido (nunca la actividad nace sin uno). */
export function ensureContent(a) {
  const c = a.content || (a.content = {});
  if (!Array.isArray(c.items) || !c.items[0]?.dibujo) {
    c.items = [{ id: rid('it_'), dibujo: DIBUJOS[0].nombre }];
  }
  return a;
}

export const renderColorearEditor = (root, activity, onChange) =>
  renderEditorJuego(root, activity, onChange, { asegurar: ensureContent, etiqueta: 'Dibujo', html: contentHtml, wire: wireContent });

function contentHtml(a) {
  const elegido = a.content.items[0].dibujo;
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

function wireContent(root, a, ctx) {
  on(root, 'click', '.co-ed-pick', (_e, el) => {
    const nombre = el.dataset.dibujo;
    if (!nombre || nombre === a.content.items[0].dibujo) return;
    a.content.items[0].dibujo = nombre;
    ctx.onChange(a);
    ctx.repaint();
  });
}
