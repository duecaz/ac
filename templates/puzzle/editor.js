// Editor de Rompecabezas — «ajustes del juego» (ballsort/editor.js es el
// ejemplar): sobre el SHELL (core/editorShell.js), aporta SOLO el panel de
// Contenido: elegir el DIBUJO del banco y el tamaño de partida por defecto.
// Aquí SÍ se permiten px (es un formulario, no el juego).
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { renderEditorJuego } from '../../core/editorJuego.js';
import { imagenDe } from './cargar.js';
import { ensureContent, contenidoPuzzle as contenido } from './content.js';
// Los DOS bancos viven en el mismo módulo (§21b: un banco, un dueño) y se
// importan estáticos, igual que en Colorear. Nació dinámico («lo escribe otro
// agente en paralelo») y ese andamio sobrevivió al fichero que esperaba.
import { TEMAS, dibujosDe, rutaDibujo, DIBUJOS_PUZZLE } from '../../core/bancoDibujos.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 */

/**
 * @param {Element} root
 * @param {Activity} activity
 * @param {(activity: Activity) => void} onChange
 * @returns {void}
 */
export const renderPuzzleEditor = (root, activity, onChange) =>
  renderEditorJuego(root, activity, onChange, { asegurar: ensureContent, etiqueta: 'Dibujo y piezas', html: contentHtml, wire: wireContent });

/** @param {Activity} a @returns {string} */
function contentHtml(a) {
  const it = contenido(a).items[0];
  return `
    <p class="text-muted small">Elige el dibujo y el tamaño de la rejilla. El niño arrastra cada pieza hasta su sitio en la imagen; no hace falta leer nada.</p>
    <div class="mb-3">
      <label class="form-label fw-bold">Tamaño</label>
      <select class="form-select pu-tamano" style="max-width:220px">
        <option value="2x2" ${it.filas === 2 && it.columnas === 2 ? 'selected' : ''}>4 piezas (2×2)</option>
        <option value="2x3" ${it.filas === 2 && it.columnas === 3 ? 'selected' : ''}>6 piezas (2×3)</option>
        <option value="3x3" ${it.filas === 3 && it.columnas === 3 ? 'selected' : ''}>9 piezas (3×3)</option>
      </select>
    </div>
    <label class="form-label fw-bold">Dibujo</label>
    <div class="pu-banco">
      ${TEMAS.map(t => grupoHtml(t.label, dibujosDe(t.id).map(d => tileHtml(d.nombre, d.label, rutaDibujo(d.nombre, 'color') ?? '', d.nombre === it.dibujo)))).join('')}
      ${grupoHtml('Geométricos', DIBUJOS_PUZZLE.map(d => tileHtml(d.nombre, d.label, '', d.nombre === it.dibujo)))}
    </div>`;
}

/** @param {string} titulo @param {string[]} tiles @returns {string} */
function grupoHtml(titulo, tiles) {
  // Las clases `.co-ed-*` son las del selector de Colorear (styles/colorear.css,
  // que teacher.html carga siempre): mismo dibujo, misma rejilla, misma marca
  // de elegido — dos selectores del mismo banco no deben verse distintos.
  return `<h6 class="co-ed-tema">${escapeHtml(titulo)}</h6><div class="co-ed-grid">${tiles.join('')}</div>`;
}

/**
 * @param {string} nombre
 * @param {string} label
 * @param {string} src  la miniatura; vacía si se pinta después (`pintarLegados`)
 * @param {boolean} activo
 * @returns {string}
 */
function tileHtml(nombre, label, src, activo) {
  return `
    <button type="button" class="pu-tile co-ed-pick ${activo ? 'co-ed-pick--on' : ''}"
            data-nombre="${escapeHtml(nombre)}" aria-pressed="${activo}" title="${escapeHtml(label || nombre)}">
      <span class="co-ed-mini">${src ? `<img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async">` : ''}</span>
      <span class="co-ed-label">${escapeHtml(label)}</span>
      <span class="co-ed-tick" aria-hidden="true"><i class="bi bi-check-lg"></i></span>
    </button>`;
}

/** Las miniaturas de los 8 legados: sus SVG nacen en blanco (`fill="#ffffff"`)
 *  y el color viene en `data-color`, así que la miniatura no puede ser el
 *  fichero tal cual como en OpenMoji — se carga con `imagenDe`, EL MISMO
 *  cargador que usa el juego (recorte, color y escena incluidos): se enseña
 *  lo que se va a jugar.
 *  @param {Element} root @returns {Promise<void>} */
async function pintarLegados(root) {
  await Promise.all(DIBUJOS_PUZZLE.map(async (d) => {
    const hueco = root.querySelector(`.pu-tile[data-nombre="${d.nombre}"] .co-ed-mini`);
    if (!hueco) return;
    try {
      const src = await imagenDe(d.nombre);
      if (!src) return;   // sin miniatura el botón sale con la etiqueta, no roto
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      hueco.replaceChildren(img);
    } catch {
      // Best-effort declarado: es una miniatura del formulario; el nombre y la
      // etiqueta siguen ahí y elegir funciona igual. El juego avisa por su
      // cuenta si el dibujo no carga (R6 se cumple donde importa).
    }
  }));
}

/**
 * @param {Element} root
 * @param {Activity} a
 * @param {import('../../core/editorShell.js').EditorCtx} ctx
 * @returns {void}
 */
function wireContent(root, a, ctx) {
  pintarLegados(root);
  on(root, 'change', '.pu-tamano', (_e, el) => {
    const [f, c] = ('value' in el ? String(el.value) : '').split('x').map(Number);
    if (!f || !c) return;
    contenido(a).items[0].filas = f;
    contenido(a).items[0].columnas = c;
    ctx.onChange(a);
  });
  on(root, 'click', '.pu-tile', (e, el) => {
    const nombre = el.dataset.nombre;
    if (!nombre) return;
    contenido(a).items[0].dibujo = nombre;
    ctx.onChange(a);
    // Se marca a mano en vez de `ctx.repaint()` (Colorear): repintar volvería
    // a pedir por red las ocho miniaturas legadas.
    for (const b of root.querySelectorAll('.pu-tile')) {
      const on_ = b === el;
      b.classList.toggle('co-ed-pick--on', on_);
      b.setAttribute('aria-pressed', String(on_));
    }
  });
}
