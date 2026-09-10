// Word-search grid generator. Deterministic: same words+size+dirs always
// produce the same grid, so VS players on separate devices see an identical
// board. El generador necesita SU PROPIO PRNG sembrado por contenido —no el
// primitivo global `azar`—, pero era una reimplementación de mulberry32
// (regla `azar-primitivo`): ahora se importa del dueño único (barrido B5,
// 2026-09-02).
import { mulberry32 } from '../../core/azar.js';

/** @param {string} str */
function strHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** UNA CELDA de la rejilla.
 * @typedef {{r: number, c: number}} WsCell */
/** UNA PALABRA ya colocada, con las celdas que ocupa.
 * @typedef {{word: string, cells: WsCell[]}} WsPlaced */
/** LO QUE DEVUELVE el generador: la rejilla, lo colocado y lo que no cupo.
 * @typedef {Object} WsBoard
 * @property {string[][]} grid
 * @property {WsPlaced[]} placed
 * @property {number} rows
 * @property {number} cols
 * @property {string[]} failed */

// Direction vectors [dr, dc]
/** @type {Record<string, [number, number]>} */
export const DIRS = {
  right:     [0,  1],
  left:      [0, -1],
  down:      [1,  0],
  up:        [-1, 0],
  downRight: [1,  1],
  downLeft:  [1, -1],
  upRight:   [-1, 1],
  upLeft:    [-1,-1],
};

// Difficulty presets for allowed directions
/** @type {Record<string, string[]>} */
const DIR_PRESETS = {
  easy:   ['right', 'down'],
  medium: ['right', 'down', 'downRight', 'downLeft'],
  hard:   Object.keys(DIRS),
};

/** @type {Record<string, number>} */
export const SIZE_MAP = { easy: 10, medium: 15, hard: 20 };

/**
 * Generate a word-search grid.
 * @param {string[]} words
 * @param {{rows?: number, cols?: number, dirs?: string|string[], seedSalt?: string}} [opts]
 * @returns {WsBoard}
 */
export function generateGrid(words, { rows = 15, cols = 15, dirs = 'medium', seedSalt = '' } = {}) {
  // seedSalt → tablero DISTINTO con las MISMAS palabras (p.ej. un lado del VS),
  // para que dos jugadores no puedan copiarse las posiciones.
  const seed = strHash(words.join('|') + rows + cols + String(dirs) + String(seedSalt));
  const rand = mulberry32(seed);
  /** @param {number} n */
  const ri = (n) => Math.floor(rand() * n);

  const dirVecs = (Array.isArray(dirs) ? dirs : (DIR_PRESETS[dirs] || DIR_PRESETS.medium))
    .map(k => DIRS[k]).filter(Boolean);

  /** @type {string[][]} */
  const grid = Array.from({ length: rows }, () => Array(cols).fill(''));
  /** @type {WsPlaced[]} */
  const placed = [];
  /** @type {string[]} */
  const failed = [];

  // Normalise: uppercase, no spaces, deduplicate
  const cleaned = [...new Set(
    words.map(w => String(w || '').toUpperCase().replace(/\s+/g, '').trim()).filter(Boolean)
  )].filter(w => w.length >= 2 && w.length <= Math.max(rows, cols));

  // Longest-first for better packing
  cleaned.sort((a, b) => b.length - a.length);

  for (const word of cleaned) {
    let ok = false;
    for (let t = 0; t < 400 && !ok; t++) {
      const [dr, dc] = dirVecs[ri(dirVecs.length)];
      const r0 = ri(rows), c0 = ri(cols);
      /** @type {WsCell[]} */
      const cells = [];
      let fits = true;
      for (let i = 0; i < word.length; i++) {
        const r = r0 + dr * i, c = c0 + dc * i;
        if (r < 0 || r >= rows || c < 0 || c >= cols ||
            (grid[r][c] !== '' && grid[r][c] !== word[i])) { fits = false; break; }
        cells.push({ r, c });
      }
      if (fits) {
        for (let i = 0; i < word.length; i++) grid[cells[i].r][cells[i].c] = word[i];
        placed.push({ word, cells });
        ok = true;
      }
    }
    if (!ok) failed.push(word);
  }

  // Fill blanks with random letters (biased toward common Spanish letters)
  const FILL = 'AAAAEEEEIIIOOUUULLNNSSTRRMMBCDFGHJKPQVWXYZ';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!grid[r][c]) grid[r][c] = FILL[ri(FILL.length)];

  return { grid, placed, rows, cols, failed };
}

/**
 * Generate a grid that places EVERY word (tries seed variations). Ensures both
 * VS sides get a board with the SAME full set of words (fair), even though the
 * layouts differ (via seedSalt). Returns the first all-placed grid, else the
 * best attempt.
 * @param {string[]} words
 * @param {{rows?: number, cols?: number, dirs?: string|string[], seedSalt?: string}} [opts]
 * @returns {WsBoard}   Siempre un tablero: el primer intento ya es el mejor mientras no haya otro.
 */
export function generateGridAllWords(words, opts = {}) {
  let best = generateGrid(words, { ...opts, seedSalt: `${opts.seedSalt || ''}#0` });
  if (!best.failed.length) return best;
  for (let i = 1; i < 16; i++) {
    const g = generateGrid(words, { ...opts, seedSalt: `${opts.seedSalt || ''}#${i}` });
    if (!g.failed.length) return g;
    if (g.placed.length > best.placed.length) best = g;
  }
  return best;
}

/**
 * Return the straight-line cells from (r0,c0) to (r1,c1).
 * Returns null if the path isn't a valid H/V/diagonal line.
 * @param {number} r0 @param {number} c0 @param {number} r1 @param {number} c1
 * @returns {WsCell[]|null}
 */
export function cellLine(r0, c0, r1, c1) {
  const dr = r1 - r0, dc = c1 - c0;
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  if (steps === 0) return [{ r: r0, c: c0 }];
  // Must be horizontal, vertical, or 45° diagonal
  if (Math.abs(dr) > 0 && Math.abs(dc) > 0 && Math.abs(dr) !== Math.abs(dc)) return null;
  const sr = Math.sign(dr), sc = Math.sign(dc);
  return Array.from({ length: steps + 1 }, (_, i) => ({ r: r0 + sr * i, c: c0 + sc * i }));
}
