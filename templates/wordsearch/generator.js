// Seeded PRNG + word-search grid generator.
// Deterministic: same words+size+dirs always produce the same grid, so
// VS players on separate devices see an identical board.

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function strHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

// Direction vectors [dr, dc]
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
export const DIR_PRESETS = {
  easy:   ['right', 'down'],
  medium: ['right', 'down', 'downRight', 'downLeft'],
  hard:   Object.keys(DIRS),
};

export const SIZE_MAP = { easy: 10, medium: 15, hard: 20 };

/**
 * Generate a word-search grid.
 * @param {string[]} words
 * @param {{ rows?, cols?, dirs? }} opts
 * @returns {{ grid: string[][], placed: {word,cells}[], rows, cols }}
 */
export function generateGrid(words, { rows = 15, cols = 15, dirs = 'medium' } = {}) {
  const seed = strHash(words.join('|') + rows + cols + String(dirs));
  const rand = mulberry32(seed);
  const ri = (n) => Math.floor(rand() * n);

  const dirVecs = (Array.isArray(dirs) ? dirs : (DIR_PRESETS[dirs] || DIR_PRESETS.medium))
    .map(k => DIRS[k]).filter(Boolean);

  const grid = Array.from({ length: rows }, () => Array(cols).fill(''));
  const placed = [];
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
 * Return the straight-line cells from (r0,c0) to (r1,c1).
 * Returns null if the path isn't a valid H/V/diagonal line.
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
