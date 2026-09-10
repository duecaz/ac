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

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').TangramContent} TangramContent
 */

/** La actividad vista como la de ESTA plantilla: `ensureContent` es justamente
 *  quien la deja en esa forma, así que antes de él el contenido puede ser otro
 *  (o no estar).
 *  @param {Activity} a @returns {TangramContent} */
function contenido(a) {
  return /** @type {TangramContent} */ (a.content);
}

/** La actividad SIEMPRE tiene un ítem con figura (nace así, y una figura
 *  desconocida en un JSON tocado a mano cae a la primera del catálogo).
 *  @param {Activity} a @returns {Activity} */
export function ensureContent(a) {
  const c = /** @type {Partial<TangramContent>|null|undefined} */ (a.content);
  if (!c || !Array.isArray(c.items) || !c.items.length) {
    a.content = { items: [{ id: rid('it_'), figura: ORDEN_SILUETAS[0] }] };
  }
  const item = contenido(a).items[0];
  if (!SILUETAS[item.figura]) item.figura = ORDEN_SILUETAS[0];
  return a;
}

/** Miniatura SVG de una silueta: solo el contorno de sus piezas, en gris —
 *  el mismo dibujo que verá el alumno como pista pasiva, en pequeño.
 *  @param {string} nombre @returns {string} */
function miniaturaHtml(nombre) {
  const f = SILUETAS[nombre];
  const { minx, miny, maxx, maxy } = f.bbox;
  const w = maxx - minx, h = maxy - miny;
  const pad = Math.max(w, h) * MARGEN_CAJA;
  const vb = `${minx - pad} ${miny - pad} ${w + pad * 2} ${h + pad * 2}`;
  const polys = f.poligonos.map(p => `<polygon points="${p.map(([x, y]) => `${x},${y}`).join(' ')}" />`).join('');
  return `<svg viewBox="${vb}" class="ta-edit-mini" aria-hidden="true">${polys}</svg>`;
}

/** @param {Activity} act @returns {string} */
function contentHtml(act) {
  ensureContent(act);
  const actual = contenido(act).items[0].figura;
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

/**
 * @param {Element} rootEl
 * @param {Activity} act
 * @param {import('../../core/editorShell.js').EditorCtx} ctx
 * @returns {void}
 */
function wireContent(rootEl, act, ctx) {
  on(rootEl, 'click', '[data-ta-figura]', (e, btn) => {
    ensureContent(act);
    const figura = btn.dataset.taFigura;
    if (!figura) return;
    contenido(act).items[0].figura = figura;
    ctx.onChange(act);
    ctx.repaint();
  });
}

/**
 * @param {Element} root
 * @param {Activity} activity
 * @param {(activity: Activity) => void} onChange
 * @returns {void}
 */
export const renderTangramEditor = (root, activity, onChange) =>
  renderEditorJuego(root, activity, onChange, { asegurar: ensureContent, etiqueta: 'Figura', html: contentHtml, wire: wireContent });
