// EL TABLERO DE LA SOPA — uno solo para el modo Individual y para la ronda de
// VS/Equipos. Estaba escrito DOS VECES en player.js (el mapa de celdas, el punto
// bajo el dedo, la selección, la comprobación, el marcado y los cuatro
// `pointer*`), y las dos copias ya habían DIVERGIDO:
//   · la ronda normalizaba las palabras (mayúsculas, sin espacios) y el solo las
//     comparaba crudas → una palabra escrita en minúscula o con un espacio no se
//     podía encontrar NUNCA en Individual, aunque el generador sí la colocaba;
//   · solo la ronda repintaba lo ya encontrado al volver a montar.
// Se unifica hacia la versión CORRECTA de cada una: SIEMPRE se normaliza y
// SIEMPRE se repinta lo que ya estaba encontrado.
import { escapeHtml, $, $$ } from '../../core/html.js';
import { capturarPuntero } from '../../core/events.js';
import { WRONG_FLASH_MS } from '../../core/timings.js';
import { cellLine } from './generator.js';

/**
 * @typedef {import('./generator.js').WsCell} WsCell
 * @typedef {import('./generator.js').WsPlaced} WsPlaced
 */

// Paleta por jugador (hasta 6). El índice pinta las celdas (`ws-found-N`) y el
// trazo de la línea: los dos salen del MISMO sitio.
const PLAYER_COLORS = [
  { stroke: '#3b82f6', bg: 'rgba(59,130,246,.30)', label: 'Azul'    },
  { stroke: '#ef4444', bg: 'rgba(239,68,68,.30)',   label: 'Rojo'    },
  { stroke: '#10b981', bg: 'rgba(16,185,129,.30)',  label: 'Verde'   },
  { stroke: '#f59e0b', bg: 'rgba(245,158,11,.30)',  label: 'Ámbar'   },
  { stroke: '#a855f7', bg: 'rgba(168,85,247,.30)',  label: 'Morado'  },
  { stroke: '#ec4899', bg: 'rgba(236,72,153,.30)',  label: 'Rosa'    },
];

/** La palabra como se COMPARA: sin espacios y en mayúsculas.
 * @param {unknown} s */
const wsNorm = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');

// Draw an SVG <line> between the CENTRES of cells a and b in REAL pixel coords.
// The old approach used viewBox grid-units (x = c+0.5), but the grid has gaps +
// a border and is centred inside a wider wrap, so the line drifted badly. Pixel
// coords from getBoundingClientRect are robust to all of that. The SVG must have
// NO viewBox (its user units are then CSS pixels).
/**
 * @param {SVGElement|null} svg
 * @param {Element|null} gridEl
 * @param {WsCell} a
 * @param {WsCell} b
 * @param {{color?: string, opacity?: number, id?: string}} [o]
 */
function wsDrawLine(svg, gridEl, a, b, { color = '#3b82f6', opacity = 0.7, id } = {}) {
  if (!svg || !gridEl) return null;
  const cA = gridEl.querySelector(`.ws-cell[data-r="${a.r}"][data-c="${a.c}"]`);
  const cB = gridEl.querySelector(`.ws-cell[data-r="${b.r}"][data-c="${b.c}"]`);
  if (!cA || !cB) return null;
  const sr = svg.getBoundingClientRect();
  const ra = cA.getBoundingClientRect(), rb = cB.getBoundingClientRect();
  const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  if (id) ln.id = id;
  ln.setAttribute('x1', String(ra.left + ra.width / 2 - sr.left));
  ln.setAttribute('y1', String(ra.top  + ra.height / 2 - sr.top));
  ln.setAttribute('x2', String(rb.left + rb.width / 2 - sr.left));
  ln.setAttribute('y2', String(rb.top  + rb.height / 2 - sr.top));
  ln.setAttribute('stroke', color);
  ln.setAttribute('stroke-width', String(Math.max(5, ra.width * 0.7)));
  ln.setAttribute('stroke-linecap', 'round');
  ln.setAttribute('opacity', String(opacity));
  svg.appendChild(ln);
  return ln;
}

/**
 * MONTA EL TABLERO dentro de `root` (lo AÑADE al final, así el solo puede poner
 * su cabecera antes) y cablea el gesto. Devuelve cuántas palabras van
 * encontradas; el resto —puntos, reloj, fin de partida— es de quien lo monta.
 * @param {Element} root
 * @param {Object} o
 * @param {string[][]} o.grid
 * @param {number} o.cols
 * @param {WsPlaced[]} o.placed
 * @param {number} [o.colorIdx]          color del jugador (VS: 0 izquierda, 1 derecha)
 * @param {string[]} [o.yaEncontradas]   palabras que ya estaban encontradas (re-montaje)
 * @param {boolean} [o.contador]         pintar «n/total» junto al título
 * @param {(p: WsPlaced, info: {encontradas: number, total: number}) => void} [o.alEncontrar]
 * @returns {{encontradas: () => number, total: number}}
 */
export function crearTableroSopa(root, { grid, cols, placed, colorIdx = 0, yaEncontradas = [], contador = false, alEncontrar }) {
  const color = PLAYER_COLORS[colorIdx] || PLAYER_COLORS[0];
  const total = placed.length;
  const found = new Set(yaEncontradas.map(wsNorm));

  root.insertAdjacentHTML('beforeend', `
    <div class="ww-ws-body">
      <div class="edu-sec edu-sec--tablero ww-ws-grid-wrap">
        <div class="ww-ws-grid" data-ws="grid" style="--ws-cols:${cols}">
          ${grid.flatMap((row, r) => row.map((l, c) =>
            `<span class="ws-cell" data-r="${r}" data-c="${c}">${escapeHtml(l)}</span>`
          )).join('')}
        </div>
        <svg class="ww-ws-svg" data-ws="svg" aria-hidden="true"></svg>
      </div>
      <div class="edu-sec edu-sec--banco ww-ws-words">
        <div class="ww-ws-words-title">Palabras${contador ? ` <span class="ws-words-count" data-ws="count">0/${total}</span>` : ''}</div>
        ${placed.map(p => `
          <div class="ws-word" data-word="${escapeHtml(wsNorm(p.word))}">
            <span class="ws-word-dot">○</span>
            <span class="ws-word-lbl">${escapeHtml(p.word)}</span>
          </div>`).join('')}
      </div>
    </div>`);

  const gridEl = /** @type {HTMLElement|null} */ ($('[data-ws="grid"]', root));
  // `querySelector` (no `$`) por el TIPO: el SVG no es un HTMLElement.
  const svg = /** @type {SVGElement|null} */ (root.querySelector('[data-ws="svg"]'));

  /** @type {Map<string, HTMLElement>} */
  const cellMap = new Map();
  for (const el of $$('.ws-cell', root)) cellMap.set(`${el.dataset.r},${el.dataset.c}`, el);
  /** @param {string|number} r @param {string|number} c */
  const getCell = (r, c) => cellMap.get(`${r},${c}`) ?? null;

  /** La celda BAJO EL DEDO, y que sea de ESTE tablero: en VS hay dos sopas en la
   *  misma página y `elementFromPoint` es global.
   * @param {number} x @param {number} y @returns {WsCell|null} */
  function cellFromPoint(x, y) {
    const el = /** @type {HTMLElement|null} */ (document.elementFromPoint(x, y));
    if (!el?.dataset?.r || !gridEl?.contains(el)) return null;
    return { r: +el.dataset.r, c: +(el.dataset.c ?? 0) };
  }

  function pintarContador() {
    const cEl = $('[data-ws="count"]', root);
    if (cEl) cEl.textContent = `${found.size}/${total}`;
  }

  /** @param {WsPlaced} p */
  function marcar(p) {
    found.add(wsNorm(p.word));
    for (const { r, c } of p.cells) getCell(r, c)?.classList.add(`ws-found-${colorIdx}`);
    wsDrawLine(svg, gridEl, p.cells[0], p.cells[p.cells.length - 1], { color: color.stroke, opacity: 0.72 });
    const wEl = $(`.ws-word[data-word="${wsNorm(p.word)}"]`, root);
    if (wEl) {
      wEl.classList.add('ws-word-found');
      const d = $('.ws-word-dot', wEl);
      if (d) d.textContent = '✓';
    }
    pintarContador();
  }

  // Lo ya encontrado se repinta tras la maquetación (las líneas van en píxeles:
  // antes del layout las celdas miden 0 y la línea caería en la esquina).
  requestAnimationFrame(() => {
    for (const p of placed) if (found.has(wsNorm(p.word))) marcar(p);
    pintarContador();
  });

  // ── Selección con el dedo ──────────────────────────────────────────────────
  let dragging = false, startR = 0, startC = 0;
  /** @type {Set<string>} */
  const selSet = new Set();

  /** @param {WsCell[]|null} line */
  function setSel(line) {
    for (const k of selSet) { const [r, c] = k.split(','); getCell(r, c)?.classList.remove('ws-sel'); }
    selSet.clear();
    if (!line) return;
    // Se iluminan las CELDAS, sin línea de previsualización: la línea se dibuja
    // solo cuando la palabra es correcta, así un arrastre fallido no deja un
    // trazo que engañe.
    for (const { r, c } of line) { getCell(r, c)?.classList.add('ws-sel'); selSet.add(`${r},${c}`); }
  }

  function comprobar() {
    if (!selSet.size) return;
    const cells = [...selSet].map(k => k.split(',').map(Number)).map(([r, c]) => ({ r, c }));
    const letters  = wsNorm(cells.map(({ r, c }) => grid[r]?.[c] || '').join(''));
    const reversed = letters.split('').reverse().join('');
    for (const p of placed) {
      const w = wsNorm(p.word);
      if (found.has(w)) continue;
      if (letters === w || reversed === w) {
        marcar(p);
        alEncontrar?.(p, { encontradas: found.size, total });
        return;
      }
    }
    // Nada casa: parpadeo rojo de lo seleccionado.
    for (const { r, c } of cells) {
      const el = getCell(r, c);
      if (!el) continue;
      el.classList.add('ws-wrong');
      setTimeout(() => el.classList.remove('ws-wrong'), WRONG_FLASH_MS);
    }
  }

  if (gridEl) {
    gridEl.addEventListener('pointerdown', (e) => {
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (!cell) return;
      e.preventDefault();
      dragging = true;
      startR = cell.r; startC = cell.c;
      setSel([cell]);
      capturarPuntero(gridEl, e.pointerId);
    }, { passive: false });
    gridEl.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (!cell) return;
      setSel(cellLine(startR, startC, cell.r, cell.c) || [{ r: startR, c: startC }]);
    }, { passive: false });
    gridEl.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      comprobar();
      setSel(null);
    });
    gridEl.addEventListener('pointercancel', () => { dragging = false; setSel(null); });
  }

  return { encontradas: () => found.size, total };
}
