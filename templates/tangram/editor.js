// Editor de Tangram — SIEMPRE sobre el SHELL (core/editorShell.js). El
// profesor no «añade» nada (es un JUEGO, norte §4c): SOLO elige qué silueta
// jugará la clase, en una rejilla de miniaturas (como Pelotas con sus
// niveles). Aquí SÍ se permiten px (es un formulario, no el juego).
import { MARGEN_CAJA } from './game/mascara.js';
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { renderEditorJuego } from '../../core/editorJuego.js';
import { rid } from '../../core/ids.js';
import { SILUETAS, ORDEN_SILUETAS } from './game/siluetas.js';

/** La actividad SIEMPRE tiene un ítem con figura (nace así, y una figura
 *  desconocida en un JSON tocado a mano cae a la primera del catálogo). */
export function ensureContent(a) {
  if (!a.content || !Array.isArray(a.content.items) || !a.content.items.length) {
    a.content = { items: [{ id: rid('it_'), figura: ORDEN_SILUETAS[0] }] };
  }
  const item = a.content.items[0];
  if (!SILUETAS[item.figura]) item.figura = ORDEN_SILUETAS[0];
  return a;
}

/** Miniatura SVG de una silueta: solo el contorno de sus piezas, en gris —
 *  el mismo dibujo que verá el alumno como pista pasiva, en pequeño. */
function miniaturaHtml(nombre) {
  const f = SILUETAS[nombre];
  const { minx, miny, maxx, maxy } = f.bbox;
  const w = maxx - minx, h = maxy - miny;
  const pad = Math.max(w, h) * MARGEN_CAJA;
  const vb = `${minx - pad} ${miny - pad} ${w + pad * 2} ${h + pad * 2}`;
  const polys = f.poligonos.map(p => `<polygon points="${p.map(([x, y]) => `${x},${y}`).join(' ')}" />`).join('');
  return `<svg viewBox="${vb}" class="ta-edit-mini" aria-hidden="true">${polys}</svg>`;
}

function contentHtml(act) {
  ensureContent(act);
  const actual = act.content.items[0].figura;
  return `
    <p class="text-muted small">Elige la figura que verá la clase. Las 7 piezas son siempre las mismas; lo único que cambia es la silueta a cubrir.</p>
    <div class="ta-edit-grid">
      ${ORDEN_SILUETAS.map(n => `
        <button type="button" class="ta-edit-tile ${n === actual ? 'is-active' : ''}" data-ta-figura="${n}" title="${escapeHtml(SILUETAS[n].nombre)}">
          ${miniaturaHtml(n)}
          <span class="ta-edit-tile__nombre">${escapeHtml(SILUETAS[n].nombre)}</span>
        </button>`).join('')}
    </div>`;
}

function wireContent(rootEl, act, ctx) {
  on(rootEl, 'click', '[data-ta-figura]', (e, btn) => {
    ensureContent(act);
    act.content.items[0].figura = btn.dataset.taFigura;
    ctx.onChange(act);
    ctx.repaint();
  });
}

export const renderTangramEditor = (root, activity, onChange) =>
  renderEditorJuego(root, activity, onChange, { asegurar: ensureContent, etiqueta: 'Figura', html: contentHtml, wire: wireContent });
