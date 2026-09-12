// EL MARKUP DEL CRUCIGRAMA — la rejilla, las pistas y la cabecera.
// Aparte del player para que este se lea como lo que hace (teclear, comprobar,
// terminar) y no como 60 líneas de HTML. Sin estado: recibe el tablero ya
// generado y devuelve texto.
import { html, escapeHtml } from '../../core/html.js';
import { cabeceraHtml } from '../../core/playerHud.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').CrosswordWord} CrosswordWord
 */

/** El lado de una casilla en el hueco disponible. 18 px es el PISO de
 *  legibilidad (nunca un techo: §maquetación del player).
 * @param {number} availW @param {number} availH @param {number} rows @param {number} cols
 * @returns {number} */
export function celdaPx(availW, availH, rows, cols) {
  return Math.max(18, Math.floor(Math.min(availW / cols, availH / rows)));
}

/**
 * @param {{grid: import('./generator.js').CrosswordGrid['grid'], words: CrosswordWord[],
 *          wordNums: Record<string, number>, rows: number, cols: number,
 *          hintMode: string}} tablero
 * @returns {string}
 */
export function crosswordHtml({ grid, words, wordNums, rows, cols, hintMode }) {
  const total = words.length;
  const porNumero = (/** @type {'H'|'V'} */ dir) => words.filter(w => w.dir === dir)
    .sort((a, b) => (wordNums[a.id] || 0) - (wordNums[b.id] || 0));

  const gridCells = grid.flatMap(row => row.map(cell => {
    if (cell.blocked) return `<div class="cw-cell cw-blocked"></div>`;
    const numHtml = cell.number != null ? `<span class="cw-num">${cell.number}</span>` : '';
    return `<div class="cw-cell cw-white" data-r="${cell.r}" data-c="${cell.c}" tabindex="0">
      ${numHtml}<span class="cw-letter" data-cwl="${cell.r}-${cell.c}"></span>
    </div>`;
  })).join('');

  /** @param {CrosswordWord[]} list @param {string} label @returns {string} */
  const clueList = (list, label) => `
    <div class="cw-clue-section">
      <div class="cw-clue-heading">${label}</div>
      ${list.map(w => `<div class="cw-clue" data-wid="${w.id}">
        <b>${wordNums[w.id]}.</b> ${escapeHtml(w.clue)}
      </div>`).join('')}
    </div>`;

  return html`
    <div class="cw-wrap">
      <!-- HERRAMIENTAS: lo que se toca para AYUDARSE, en la cabecera y
           separado del envío. Antes pista y reiniciar compartían el pie con
           «Verificar», así que ayudarse y entregar se leían como lo mismo. -->
      ${cabeceraHtml({
        pagina: `0 / ${total}`,
        herramientas: `${hintMode === 'none' ? '' : `<button class="btn btn-outline-secondary btn-sm" id="cw-hint"><i class="bi bi-lightbulb"></i> Pista</button>`}
          <button class="btn btn-outline-danger btn-sm" id="cw-reset"><i class="bi bi-arrow-counterclockwise"></i> Reiniciar</button>`,
      })}

      <!-- Body: clues + grid -->
      <div class="cw-body">
        <div class="edu-sec edu-sec--pistas cw-clues">
          ${clueList(porNumero('H'), 'Horizontales →')}
          ${clueList(porNumero('V'), 'Verticales ↓')}
        </div>
        <div class="edu-sec edu-sec--tablero cw-grid-wrap">
          <div class="cw-grid" style="--cw-cols:${cols};--cw-rows:${rows}">
            ${gridCells}
          </div>
        </div>
      </div>

      <!-- ENVÍO (edu-send): UN control, el que entrega. -->
      <div class="edu-send cw-footer">
        <button class="btn btn-success btn-lg" id="cw-check" data-ww-submit><i class="bi bi-check2-circle"></i> Verificar</button>
      </div>

      <!-- Hidden input for mobile keyboard -->
      <input data-cw="ki" type="text" inputmode="text" autocomplete="off" autocorrect="off"
             autocapitalize="characters" spellcheck="false"
             style="position:fixed;opacity:0;pointer-events:none;left:0;top:0;width:1px;height:1px">
    </div>`;
}
