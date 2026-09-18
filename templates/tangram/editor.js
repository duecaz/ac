// Editor de Tangram — SIEMPRE sobre el SHELL (core/editorShell.js). El
// profesor no «añade» nada (es un JUEGO, norte §4c): ARMA la figura con las 7
// piezas en un tablero —el MISMO tablero que juega el alumno (game/tablero.js,
// §21b)— y lo que quede armado ES la silueta que verá la clase. El catálogo
// `SILUETAS` son FIGURAS DE PARTIDA: se cargan al tablero y se retocan.
// Aquí SÍ se permiten px (es un formulario, no el juego): selectores `ta-edit-*`.
//
// OJO con `ctx.repaint()`: repinta el editor ENTERO y eso destruye el tablero
// (y el gesto a medias). Aquí no se usa: al soltar una pieza se repinta SOLO
// la vista de la silueta y el aviso, y cargar una figura de partida repinta
// las piezas del tablero en su sitio (`tablero.pintar()`).
import { MARGEN_CAJA, componentesConexas } from './game/mascara.js';
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { renderEditorJuego } from '../../core/editorJuego.js';
import { SILUETAS, ORDEN_SILUETAS } from './game/siluetas.js';
import { PIEZAS } from './game/piezas.js';
import { poligonosDe, bboxDe } from './game/geometria.js';
import { montarTablero, siluetaHtml } from './game/tablero.js';
import { ensureContent, contenidoTangram as contenido, colocacionesDePreset } from './content.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').TangramItem} TangramItem
 * @typedef {import('./game/piezas.js').Punto} Punto
 */

// El tablero del editor es FINITO y cuadrado, en unidades del cuadrado
// unidad: las figuras de partida caben holgadas (la más alta mide 1.3) y
// queda sitio para apartar piezas. Los límites acotan el ORIGEN de una pieza
// soltada: nunca se pierde una fuera del viewBox.
const MESA = { minx: -1.25, miny: -1.75, w: 3.5, h: 3.5 };
const LIMITES = { minx: MESA.minx + 0.05, miny: MESA.miny + 0.05, maxx: MESA.minx + MESA.w - 0.05, maxy: MESA.miny + MESA.h - 0.05 };

/** El viewBox que envuelve unos polígonos con el margen del juego.
 *  @param {Punto[][]} poligonos @returns {string} */
function viewBoxDe(poligonos) {
  const { minx, miny, maxx, maxy } = bboxDe(poligonos);
  const w = maxx - minx, h = maxy - miny;
  const pad = Math.max(w, h) * MARGEN_CAJA;
  return `${minx - pad} ${miny - pad} ${w + pad * 2} ${h + pad * 2}`;
}

/** Miniatura SVG de una figura de partida: solo el contorno de sus piezas, en
 *  gris — el mismo dibujo que verá el alumno como pista pasiva, en pequeño.
 *  @param {string} nombre @returns {string} */
function miniaturaHtml(nombre) {
  const polys = poligonosDe(SILUETAS[nombre].solucion);
  return `<svg viewBox="${viewBoxDe(polys)}" class="ta-edit-mini" aria-hidden="true">${siluetaHtml(polys)}</svg>`;
}

/** ¿Las 7 piezas forman UNA figura? Si no, la clase no sabrá qué es.
 *  @param {TangramItem} item @returns {boolean} */
const esUnaFigura = (item) => componentesConexas(item.colocaciones, PIEZAS) === 1;

/** @param {Activity} act @returns {string} */
function contentHtml(act) {
  ensureContent(act);
  const item = contenido(act).items[0];
  const polys = poligonosDe(item.colocaciones);
  return `
    <p class="text-muted small">Mueve las 7 piezas en el tablero: la figura que quede armada es la silueta que verá la clase. Toca una pieza para girarla; tócala dos veces para voltearla.</p>
    <div class="mb-2">
      <label class="form-label small" for="ta-edit-nombre">Nombre de la figura</label>
      <input class="form-control" id="ta-edit-nombre" data-ta-nombre value="${escapeHtml(item.nombre)}" placeholder="Casa, gato, barco…">
    </div>
    <div class="small text-muted mb-1">Figuras de partida (se cargan en el tablero y se pueden retocar):</div>
    <div class="ta-edit-grid">
      ${ORDEN_SILUETAS.map(n => `
        <button type="button" class="ta-edit-tile" data-ta-preset="${n}" title="${escapeHtml(SILUETAS[n].nombre)}">
          ${miniaturaHtml(n)}
          <span class="ta-edit-tile__nombre">${escapeHtml(SILUETAS[n].nombre)}</span>
        </button>`).join('')}
    </div>
    <div class="ta-edit-mesa">
      <svg class="ta-edit-tablero" viewBox="${MESA.minx} ${MESA.miny} ${MESA.w} ${MESA.h}" preserveAspectRatio="xMidYMid meet" aria-label="Tablero: arrastra las piezas">
        <rect class="ta-edit-fondo" x="${MESA.minx}" y="${MESA.miny}" width="${MESA.w}" height="${MESA.h}" />
        <g class="ta-piezas"></g>
      </svg>
      <div class="ta-edit-vista">
        <div class="small text-muted">Así la verá la clase:</div>
        <svg class="ta-edit-vista-svg" viewBox="${viewBoxDe(polys)}" aria-hidden="true"><g class="ta-silueta">${siluetaHtml(polys)}</g></svg>
        <div class="alert alert-warning py-1 px-2 small ta-edit-aviso" data-ta-aviso ${esUnaFigura(item) ? 'hidden' : ''}>
          Las piezas tienen que tocarse: así la clase no sabrá qué figura es.
        </div>
      </div>
    </div>`;
}

/** Repinta SOLO lo que depende de las colocaciones (la unión gris y el
 *  aviso), sin tocar el tablero ni el campo del nombre.
 *  @param {Element} rootEl @param {TangramItem} item @returns {void} */
function actualizarVista(rootEl, item) {
  const polys = poligonosDe(item.colocaciones);
  const vista = rootEl.querySelector('.ta-edit-vista-svg');
  if (vista) {
    vista.setAttribute('viewBox', viewBoxDe(polys));
    vista.innerHTML = `<g class="ta-silueta">${siluetaHtml(polys)}</g>`;
  }
  const aviso = rootEl.querySelector('[data-ta-aviso]');
  if (aviso) aviso.toggleAttribute('hidden', esUnaFigura(item));
}

/**
 * @param {Element} rootEl
 * @param {Activity} act
 * @param {import('../../core/editorShell.js').EditorCtx} ctx
 * @returns {void}
 */
function wireContent(rootEl, act, ctx) {
  ensureContent(act);
  const item = contenido(act).items[0];

  const svg = /** @type {SVGSVGElement|null} */ (rootEl.querySelector('.ta-edit-tablero'));
  const capa = rootEl.querySelector('.ta-edit-tablero .ta-piezas');
  const tablero = svg && capa ? montarTablero(svg, capa, {
    colocaciones: item.colocaciones,   // el tablero MUTA el propio contenido: lo que se ve es lo que se guarda
    contentW: MESA.w,
    limites: LIMITES,
    onCambio: () => { ctx.onChange(act); actualizarVista(rootEl, item); },
  }) : null;

  on(rootEl, 'input', '[data-ta-nombre]', (_, el) => {
    item.nombre = /** @type {HTMLInputElement} */ (el).value;
    ctx.onChange(act);
  });

  on(rootEl, 'click', '[data-ta-preset]', (_, btn) => {
    const figura = btn.dataset.taPreset;
    if (!figura || !SILUETAS[figura]) return;
    // En el MISMO array (el tablero y el contenido comparten la referencia).
    item.colocaciones.splice(0, item.colocaciones.length, ...colocacionesDePreset(figura));
    item.nombre = SILUETAS[figura].nombre;
    const campo = /** @type {HTMLInputElement|null} */ (rootEl.querySelector('[data-ta-nombre]'));
    if (campo) campo.value = item.nombre;
    tablero?.pintar();
    actualizarVista(rootEl, item);
    ctx.onChange(act);
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
