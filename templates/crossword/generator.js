// Crossword grid builder + auto-layout algorithm.
import { rid } from '../../core/ids.js';
// words = [{id, word, clue, row, col, dir}]  dir: 'H' | 'V'

const uid = () => rid('cw_');

/**
 * Build a 2-D cell grid from a list of placed words.
 * Returns { grid, rows, cols, wordNums, words }
 */
export function buildGrid(words) {
  if (!words?.length) return { grid: [], rows: 0, cols: 0, wordNums: {}, words: [] };

  const placed = words.map(w => ({ ...w, word: String(w.word || '').toUpperCase() }))
    .filter(w => w.word.length >= 2);

  let maxR = 0, maxC = 0;
  for (const w of placed) {
    if (w.dir === 'H') { maxR = Math.max(maxR, w.row);            maxC = Math.max(maxC, w.col + w.word.length - 1); }
    else               { maxR = Math.max(maxR, w.row + w.word.length - 1); maxC = Math.max(maxC, w.col); }
  }

  const rows = maxR + 1, cols = maxC + 1;
  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({ letter: '', blocked: true, number: null, wordIds: [], r, c }))
  );

  for (const w of placed) {
    for (let i = 0; i < w.word.length; i++) {
      const r = w.dir === 'H' ? w.row       : w.row + i;
      const c = w.dir === 'H' ? w.col + i   : w.col;
      grid[r][c].letter = w.word[i];
      grid[r][c].blocked = false;
      if (!grid[r][c].wordIds.includes(w.id)) grid[r][c].wordIds.push(w.id);
    }
  }

  // Auto-number: one number per unique starting (row, col) position,
  // sorted top→bottom, left→right — same as standard crossword convention.
  const sortedByStart = [...placed].sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);
  const posNum = new Map();
  const wordNums = {};
  let n = 1;
  for (const w of sortedByStart) {
    const key = `${w.row},${w.col}`;
    if (!posNum.has(key)) posNum.set(key, n++);
    wordNums[w.id] = posNum.get(key);
    grid[w.row][w.col].number = posNum.get(key);
  }

  return { grid, rows, cols, wordNums, words: placed };
}

/**
 * Auto-place a list of word definitions, trying to form a connected crossword.
 * defs = [{word, clue}]
 * Returns [{id, word, clue, row, col, dir}]
 */
export function autoLayout(defs) {
  if (!defs?.length) return [];

  // Normalise + filter
  const words = defs
    .map(d => ({ id: uid(), word: String(d.word || '').toUpperCase().replace(/\s+/g, ''), clue: d.clue || '' }))
    .filter(w => w.word.length >= 2);

  if (!words.length) return [];

  // Sort longest-first so long words anchor the board
  words.sort((a, b) => b.word.length - a.word.length);

  const placed = [];

  // Place first word horizontally at origin
  placed.push({ ...words[0], row: 0, col: 0, dir: 'H' });

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    let best = null;

    // Try to intersect with every placed word
    outerLoop:
    for (const p of placed) {
      const newDir = p.dir === 'H' ? 'V' : 'H';
      for (let pi = 0; pi < p.word.length; pi++) {
        for (let wi = 0; wi < w.word.length; wi++) {
          if (p.word[pi] !== w.word[wi]) continue;

          // Compute starting position of new word
          let r, c;
          if (newDir === 'V') {
            c = p.dir === 'H' ? p.col + pi : p.col;
            r = p.dir === 'H' ? p.row - wi : p.row + pi - wi;
          } else {
            r = p.dir === 'V' ? p.row + pi : p.row;
            c = p.dir === 'V' ? p.col - wi : p.col + pi - wi;
          }

          if (r < 0 || c < 0) continue;
          if (!isValid(placed, w.word, r, c, newDir)) continue;

          best = { ...w, row: r, col: c, dir: newDir };
          break outerLoop;
        }
      }
    }

    // Fallback: place horizontally below everything
    if (!best) {
      const bottomRow = Math.max(...placed.map(p =>
        p.dir === 'H' ? p.row : p.row + p.word.length - 1
      )) + 2;
      best = { ...w, row: bottomRow, col: 0, dir: 'H' };
    }

    placed.push(best);
  }

  // Shift so minimum row/col = 0
  const minR = Math.min(...placed.map(p => p.row));
  const minC = Math.min(...placed.map(p => p.col));
  return placed.map(p => ({ ...p, row: p.row - minR, col: p.col - minC }));
}

function isValid(placed, word, row, col, dir) {
  // Build occupied cell map
  const occ = new Map();
  for (const p of placed) {
    for (let i = 0; i < p.word.length; i++) {
      const r = p.dir === 'H' ? p.row : p.row + i;
      const c = p.dir === 'H' ? p.col + i : p.col;
      const k = `${r},${c}`;
      if (!occ.has(k)) occ.set(k, { letter: p.word[i], dirs: new Set() });
      occ.get(k).dirs.add(p.dir);
    }
  }

  for (let i = 0; i < word.length; i++) {
    const r = dir === 'H' ? row : row + i;
    const c = dir === 'H' ? col + i : col;
    const k = `${r},${c}`;

    if (occ.has(k)) {
      const cell = occ.get(k);
      if (cell.letter !== word[i]) return false; // letter conflict
      if (cell.dirs.has(dir)) return false;       // parallel overlap
    }
  }

  // Boundary check: no cell at start-1 or end+1 in same direction
  if (dir === 'H') {
    if (col > 0 && occ.has(`${row},${col - 1}`)) return false;
    if (occ.has(`${row},${col + word.length}`)) return false;
  } else {
    if (row > 0 && occ.has(`${row - 1},${col}`)) return false;
    if (occ.has(`${row + word.length},${col}`)) return false;
  }

  return true;
}
