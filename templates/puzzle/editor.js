// Editor de Rompecabezas — «ajustes del juego» (ballsort/editor.js es el
// ejemplar): sobre el SHELL (core/editorShell.js), aporta SOLO el panel de
// Contenido: elegir el DIBUJO del banco y el tamaño de partida por defecto.
// Aquí SÍ se permiten px (es un formulario, no el juego).
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { renderEditorJuego } from '../../core/editorJuego.js';
import { rid } from '../../core/ids.js';
import { svgAColor } from './game/imagen.js';

// El banco (assets/juegos/dibujos) lo escribe otro agente en paralelo: se
// carga por IMPORT DINÁMICO para que el editor arranque aunque el fichero aún
// no exista (el registro de plantillas no debe caerse por un módulo hermano
// que llega después). Si no está, se avisa CON MENSAJE, no en silencio.
async function cargarBanco() {
  try {
    return await import('../../core/bancoDibujos.js');
  } catch {
    return null;
  }
}

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').PuzzleContent} PuzzleContent
 */

/** La actividad vista como la de ESTA plantilla — `ensureContent` es quien la
 *  deja en esta forma, así que antes de él el contenido puede ser otro.
 *  @param {Activity} a @returns {PuzzleContent} */
function contenido(a) {
  return /** @type {PuzzleContent} */ (a.content);
}

/** @param {Activity} a @returns {Activity} */
export function ensureContent(a) {
  const c = /** @type {Partial<PuzzleContent>} */ (a.content || (a.content = { items: [] }));
  if (!Array.isArray(c.items) || !c.items[0]) {
    c.items = [{ id: rid('it_'), dibujo: 'casa', filas: 2, columnas: 2 }];
  }
  const it = c.items[0];
  if (!it.filas) it.filas = 2;
  if (!it.columnas) it.columnas = 2;
  if (!it.dibujo) it.dibujo = 'casa';
  return a;
}

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
    <div class="pu-banco d-flex flex-wrap gap-2" data-dibujo="${escapeHtml(it.dibujo)}">
      <p class="small text-muted">Cargando el banco de dibujos…</p>
    </div>`;
}

/**
 * @param {string} nombre
 * @param {string} label
 * @param {string} svgColor
 * @param {boolean} activo
 * @returns {string}
 */
function tileHtml(nombre, label, svgColor, activo) {
  return `
    <button type="button" class="pu-tile btn p-1 ${activo ? 'btn-primary' : 'btn-outline-secondary'}"
            data-nombre="${escapeHtml(nombre)}" title="${escapeHtml(label || nombre)}"
            style="width:76px;height:76px;display:flex;align-items:center;justify-content:center;">
      <span style="width:56px;height:56px;display:block;pointer-events:none;">${svgColor}</span>
    </button>`;
}

/** @param {Element} root @param {Activity} a @returns {Promise<void>} */
async function pintarBanco(root, a) {
  const cont = root.querySelector('.pu-banco');
  if (!cont) return;
  const banco = await cargarBanco();
  const dibujos = banco?.DIBUJOS;
  if (!banco || !Array.isArray(dibujos) || !dibujos.length) {
    cont.innerHTML = '<p class="small text-danger">El banco de dibujos no está disponible todavía. Vuelve a intentarlo en un momento.</p>';
    return;
  }
  const actual = contenido(a).items[0].dibujo;
  const piezas = await Promise.all(dibujos.map(async (d) => {
    let svg = '';
    try {
      const ruta = banco.rutaDibujo(d.nombre);
      // `rutaDibujo` devuelve null para un nombre que no está en el banco: sin
      // ruta no hay miniatura que pintar (el botón sale vacío, no roto).
      if (ruta) {
        const res = await fetch(ruta);
        svg = svgAColor(await res.text());
      }
    } catch { svg = ''; }
    return tileHtml(d.nombre, d.label, svg, d.nombre === actual);
  }));
  cont.innerHTML = piezas.join('') || '<p class="small text-danger">El banco de dibujos no está disponible todavía.</p>';
}

/**
 * @param {Element} root
 * @param {Activity} a
 * @param {import('../../core/editorShell.js').EditorCtx} ctx
 * @returns {void}
 */
function wireContent(root, a, ctx) {
  pintarBanco(root, a);
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
    for (const b of root.querySelectorAll('.pu-tile')) {
      const on_ = b === el;
      b.classList.toggle('btn-primary', on_);
      b.classList.toggle('btn-outline-secondary', !on_);
    }
  });
}
