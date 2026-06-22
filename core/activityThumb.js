// Faithful 16:9 activity thumbnail. Instead of a hand-drawn canvas image, we
// statically render the FIRST screen of the activity reusing the exact same CSS
// classes the real players use (.ww-player, .ww-kahoot-grid, .ww-match, etc.),
// inside a fixed 960×540 stage that is scaled down to the card width with a CSS
// transform. No timers, no event handlers, no game-event side effects — it is
// pure markup, so it is safe to mount many of them on the home grid.
import { escapeHtml } from './html.js';
import { applySkin } from './skins.js';
import { applyBackground } from './backgrounds.js';
import { isVowel } from './textMarks.js';
import { wheelSvg } from '../templates/wheel/render.js';
import { generateGrid } from '../templates/wordsearch/generator.js';

// Virtual stage = the interactive panel's native resolution (1280×800, 16:10).
// The activity renders responsively at this size, then the whole stage is
// scaled down to the card width — so the card shows exactly what the big
// screen shows, just smaller (like viewing it on a phone).
const STAGE_W = 1280, STAGE_H = 800;
const SHAPE_ICONS = ['bi-triangle-fill', 'bi-diamond-fill', 'bi-circle-fill', 'bi-square-fill'];

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  // The stage replicates the real .ww-player-frame layout (white card bg,
  // padding, flex-fill, container-query sizing) but with FIXED values — no
  // responsive media queries — because the whole stage is transform-scaled.
  const css = `
    .ww-thumb{position:relative;width:100%;aspect-ratio:16/10;overflow:hidden;
      border-radius:.375rem .375rem 0 0;pointer-events:none;background:#e9ecef;}
    .ww-thumb-stage{position:absolute;top:0;left:0;transform-origin:top left;
      width:${STAGE_W}px;height:${STAGE_H}px;overflow:hidden;
      background:var(--ww-card-bg,#fff);color:var(--ww-fg,#212529);
      container-type:size;}
    .ww-thumb-pad{position:absolute;inset:0;padding:1.75rem;overflow:hidden;}
    .ww-thumb-pad > .ww-player,.ww-thumb-pad > .ww-match,
    .ww-thumb-pad > .ww-memory,.ww-thumb-pad > .tc-solo{
      display:flex;flex-direction:column;height:100%;gap:1.4cqh;}
    .ww-thumb-pad .ww-q{flex:0 0 auto;margin:0;line-height:1.15;
      font-size:clamp(1rem,5cqmin,2.4rem);}
    .ww-thumb-pad .ww-q-media{flex:1 1 auto;min-height:0;display:flex;
      align-items:center;justify-content:center;}
    .ww-thumb-pad .ww-q-media img{max-height:100%;max-width:100%;
      object-fit:contain;border-radius:8px;}
    .ww-thumb-pad .ww-options{flex:0 0 auto;gap:1.2cqh;}
    .ww-thumb-pad .ww-kahoot-grid .btn{font-size:clamp(.9rem,3.4cqmin,1.9rem);
      padding:clamp(.45rem,2.2cqh,1.6rem);min-height:0;white-space:normal;}
    .ww-thumb-pad .tc-passage{font-size:clamp(1rem,4cqmin,2rem);line-height:1.7;}
    .ww-thumb-pad .ww-memo-grid,.ww-thumb-pad .row{flex:1 1 auto;min-height:0;}`;
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
}

// ── Per-template static first-screen markup ─────────────────────────────────
function headHtml(idx, total) {
  return `<div class="ww-phead d-flex justify-content-between align-items-center">
    <span class="badge bg-secondary">${idx} / ${total}</span>
    <span class="badge bg-primary">★ 0</span></div>`;
}

function emptyHtml(act) {
  return `<div class="ww-player" style="display:flex;align-items:center;justify-content:center">
    <h2 class="text-center">${escapeHtml(act.title || 'Actividad')}</h2></div>`;
}

function quizHtml(act) {
  const items = act.content?.items || [];
  const it = items[0];
  if (!it) return emptyHtml(act);
  const opts = (it.options || []).slice(0, 6);
  return `<div class="ww-player">
    ${headHtml(1, items.length)}
    <h3 class="ww-q">${escapeHtml(it.question || '')}</h3>
    <div class="ww-q-media">${it.image ? `<img src="${escapeHtml(it.image)}" alt="">` : ''}</div>
    <div class="ww-kahoot-grid ww-options">
      ${opts.map((o, i) => `<button class="btn btn-lg w-100 ww-opt ww-shape-${(i % 4) + 1}">
        <i class="bi ${SHAPE_ICONS[i % 4]} me-2"></i>${escapeHtml(o)}</button>`).join('')}
    </div>
  </div>`;
}

function mathHtml(act) {
  const items = act.content?.items || [];
  const it = items[0];
  if (!it) return emptyHtml(act);
  return `<div class="ww-player ww-math">
    ${headHtml(1, items.length)}
    <div class="ww-math-round"><div class="ww-keypad-round">
      <div class="ww-keypad-q">${escapeHtml(it.question || '')} <span class="ww-keypad-eq">=</span></div>
      <div class="ww-keypad-display">0</div>
      <div class="ww-keypad">
        ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="btn ww-key">${n}</button>`).join('')}
        <button class="btn ww-key ww-key-fn"><i class="bi bi-backspace"></i></button>
        <button class="btn ww-key">0</button>
        <button class="btn ww-key ww-key-ok"><i class="bi bi-check-lg"></i></button>
      </div>
    </div></div>
  </div>`;
}

function matchHtml(act) {
  const pairs = (act.content?.pairs || [])
    .filter(p => String(p.left||'').trim() && String(p.right||'').trim()).slice(0, 5);
  if (!pairs.length) return emptyHtml(act);
  const card = t => `<button class="ww-card btn w-100 mb-2 text-start">${escapeHtml(t)}</button>`;
  const lefts = pairs.map(p => p.left);
  const rights = pairs.map(p => p.right).reverse();
  return `<div class="ww-match">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <span class="badge bg-secondary">0 / ${pairs.length}</span>
      <span class="badge bg-primary">★ 0</span></div>
    <h4 class="text-center mb-4">${escapeHtml(act.title || '')}</h4>
    <div class="row g-2">
      <div class="col-6">${lefts.map(card).join('')}</div>
      <div class="col-6">${rights.map(card).join('')}</div>
    </div>
  </div>`;
}

function memoryHtml(act) {
  const pairs = (act.content?.pairs || [])
    .filter(p => String(p.left||'').trim() && String(p.right||'').trim());
  if (!pairs.length) return emptyHtml(act);
  const cols = Math.max(2, Math.min(8, act.rules?.columns || 4));
  let cells = '';
  for (let i = 0; i < pairs.length * 2; i++)
    cells += `<button class="mc"><i class="bi bi-question-lg"></i></button>`;
  return `<div class="ww-memory">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <span class="badge bg-secondary">0 / ${pairs.length}</span>
      <span class="badge bg-info text-dark">Flips: 0</span>
      <span class="badge bg-primary">★ 0</span></div>
    <h5 class="text-center mb-3">${escapeHtml(act.title || '')}</h5>
    <div class="ww-memo-grid" style="grid-template-columns:repeat(${cols},1fr)">${cells}</div>
  </div>`;
}

// Static reproduction of the text-correction passage (core/textCorrectionRound).
// Vowels (tildes) / word-end gaps (comas) become tap targets — no handlers.
function tcPassageHtml(text, kind) {
  const chars = [...String(text)];
  const ch = c => `<span class="tc-ch">${escapeHtml(c === ' ' ? ' ' : c)}</span>`;
  if (kind === 'coma') {
    return chars.map((c, i) => {
      if (i === chars.length - 1 || c === ' ' || chars[i + 1] !== ' ') return ch(c);
      return ch(c) + `<button type="button" class="tc-tap tc-gap" aria-label="hueco"></button>`;
    }).join('');
  }
  return chars.map(c => isVowel(c)
    ? `<button type="button" class="tc-tap tc-vowel">${escapeHtml(c)}</button>`
    : ch(c)).join('');
}

function textHtml(act) {
  const passages = (act.content?.passages || []).filter(p => p && p.text);
  if (!passages.length) return emptyHtml(act);
  const kind = act.template === 'comas' ? 'coma' : 'tilde';
  const hint = kind === 'coma'
    ? 'Toca el hueco donde falta una coma.'
    : 'Toca las vocales que llevan tilde.';
  return `<div class="tc-solo">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <span class="badge bg-secondary">Frase 1 / ${passages.length}</span>
      <span class="badge bg-primary">★ 0</span></div>
    <h4 class="text-center mb-1">${escapeHtml(act.title || '')}</h4>
    <div class="tc-round">
      <div class="tc-passage">${tcPassageHtml(passages[0].text, kind)}</div>
      <div class="text-center mt-3"><button type="button" class="btn btn-success btn-lg">
        <i class="bi bi-check2-circle"></i> Listo</button></div>
      <p class="tc-hint text-muted text-center mt-2">${hint}</p>
    </div>
  </div>`;
}

function wheelHtml(act) {
  const items = act.content?.entries || act.content?.items || act.content?.words || [];
  const labels = items.map(i => typeof i === 'string' ? i : (i.text || i.label || i.question || ''))
    .filter(Boolean).slice(0, 8);
  return `<div class="ww-player" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem">
    ${wheelSvg(labels, { size: 520 })}
    <div class="fs-4 fw-semibold text-center">${escapeHtml(act.title || 'Ruleta')}</div>
  </div>`;
}

function froggyHtml(act) {
  const items = act.content?.items || [];
  if (!items.length) return emptyHtml(act);
  const it = items[0];
  const opts = (it.options || []).slice(0, 4);
  const COLORS = ['#e53935','#1e88e5','#43a047','#fb8c00'];
  const pads = Array.from({ length: 7 }, (_, i) => `<span style="font-size:1.1rem">🪷</span>`).join('');
  return `<div style="display:flex;flex-direction:column;height:100%;gap:.5rem">
    <div style="border-radius:10px;background:linear-gradient(90deg,#0e7490,#0369a1);padding:8px 14px;display:flex;align-items:center;gap:4px;flex-shrink:0">
      <span style="font-size:1.8rem">🐸</span>
      ${pads}
      <span style="font-size:1.1rem">🏁</span>
    </div>
    <div style="font-size:clamp(.8rem,3cqmin,1.4rem);font-weight:800;text-align:center;padding:0 .5rem;flex-shrink:0">${escapeHtml(it.question || '')}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;flex:1">
      ${opts.map((o, i) => `<div style="background:${COLORS[i]};color:#fff;border-radius:8px;padding:.35rem .5rem;font-size:clamp(.65rem,2cqmin,1rem);font-weight:700;display:flex;align-items:center;gap:.3rem;overflow:hidden">
        <i class="bi ${SHAPE_ICONS[i % 4]}"></i><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(o)}</span></div>`).join('')}
    </div>
  </div>`;
}

function wordsearchHtml(act) {
  const words = (act.content?.words || []).map(w => typeof w === 'string' ? w : (w?.word || '')).filter(Boolean);
  if (!words.length) return emptyHtml(act);
  const n = 10; // always use 10x10 for thumbnail (fast)
  const { grid, placed, rows, cols } = generateGrid(words.slice(0, 12), { rows: n, cols: n, dirs: 'medium' });
  const COLORS = ['#3b82f6','#ef4444','#10b981','#f59e0b','#a855f7','#ec4899'];
  const foundCells = new Map();
  placed.forEach((p, i) => p.cells.forEach(({ r, c }) => foundCells.set(`${r},${c}`, COLORS[i % COLORS.length])));

  const cellSize = 100 / cols; // % per cell
  const fontSize = Math.max(7, Math.floor(cellSize * 0.55));
  const cellsHtml = grid.flatMap((row, r) => row.map((l, c) => {
    const color = foundCells.get(`${r},${c}`);
    const bg    = color ? `background:${color}22;color:${color};` : 'color:#adb5bd;';
    return `<span style="display:flex;align-items:center;justify-content:center;aspect-ratio:1;font-weight:800;font-size:${fontSize}px;${bg}">${l}</span>`;
  })).join('');

  const wordList = placed.slice(0, 6).map((p, i) =>
    `<span style="font-size:10px;font-weight:700;color:${COLORS[i % COLORS.length]};text-decoration:line-through;margin-right:6px">${p.word}</span>`
  ).join('') + (placed.length > 6 ? `<span style="font-size:10px;color:#adb5bd">+${placed.length - 6}</span>` : '');

  return `<div style="display:flex;flex-direction:column;height:100%;padding:.5rem;gap:.5rem">
    <div style="flex:1;display:grid;grid-template-columns:repeat(${cols},1fr);gap:1px;background:#dee2e6;border:1px solid #dee2e6;border-radius:6px;overflow:hidden">${cellsHtml}</div>
    <div style="display:flex;flex-wrap:wrap;gap:2px;flex-shrink:0">${wordList}</div>
  </div>`;
}

function crosswordHtml(act) {
  const words = (act.content?.words || []).filter(w => w.word && w.word.length >= 2 && w.row != null && w.col != null && w.dir);
  if (!words.length) return emptyHtml(act);

  // Compute grid dimensions
  let maxR = 0, maxC = 0;
  for (const w of words) {
    if (w.dir === 'H') { maxR = Math.max(maxR, w.row); maxC = Math.max(maxC, w.col + w.word.length - 1); }
    else               { maxR = Math.max(maxR, w.row + w.word.length - 1); maxC = Math.max(maxC, w.col); }
  }
  const rows = maxR + 1, cols = maxC + 1;
  if (rows > 20 || cols > 20) return emptyHtml(act);

  // Build grid of letters
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const w of words) {
    for (let i = 0; i < w.word.length; i++) {
      const r = w.dir === 'H' ? w.row : w.row + i;
      const c = w.dir === 'H' ? w.col + i : w.col;
      grid[r][c] = w.word[i];
    }
  }

  const cellPx = Math.max(14, Math.min(28, Math.floor(300 / Math.max(rows, cols))));
  const cellsHtml = grid.flatMap((row, r) => row.map((l, c) => {
    if (l === null) return `<div style="width:${cellPx}px;height:${cellPx}px;background:#343a40"></div>`;
    return `<div style="width:${cellPx}px;height:${cellPx}px;background:#fff;border:1px solid #adb5bd;display:flex;align-items:center;justify-content:center;font-size:${Math.max(7, cellPx * 0.52)}px;font-weight:800;color:#212529">${l}</div>`;
  })).join('');

  const wordList = words.slice(0, 5).map(w =>
    `<span style="font-size:9px;font-weight:700;color:#0d6efd;margin-right:5px">${w.word}</span>`
  ).join('') + (words.length > 5 ? `<span style="font-size:9px;color:#adb5bd">+${words.length - 5}</span>` : '');

  return `<div style="display:flex;flex-direction:column;height:100%;padding:.5rem;gap:.4rem;align-items:center">
    <div style="display:grid;grid-template-columns:repeat(${cols},${cellPx}px);gap:1px;background:#dee2e6;border:1px solid #dee2e6;border-radius:4px;overflow:hidden">${cellsHtml}</div>
    <div style="display:flex;flex-wrap:wrap;gap:2px;justify-content:center">${wordList}</div>
  </div>`;
}

function buildHtml(act) {
  switch (act.template) {
    case 'quiz':        return quizHtml(act);
    case 'math':        return mathHtml(act);
    case 'match':       return matchHtml(act);
    case 'memory':      return memoryHtml(act);
    case 'tildes':
    case 'comas':       return textHtml(act);
    case 'wheel':       return wheelHtml(act);
    case 'wordsearch':  return wordsearchHtml(act);
    case 'froggy':      return froggyHtml(act);
    case 'crossword':   return crosswordHtml(act);
    default:
      if (act.content?.items?.[0]?.options) return quizHtml(act);
      if (act.content?.pairs?.length)       return matchHtml(act);
      if (act.content?.passages?.length)    return textHtml(act);
      return emptyHtml(act);
  }
}

// ── Scaling: one shared resize listener rescales every mounted thumb. ────────
const _mounted = new Set();
let _bound = false;
function rescaleAll() {
  for (const c of [..._mounted]) {
    if (!document.contains(c)) { _mounted.delete(c); continue; }
    const stage = c.firstElementChild;
    if (!stage) continue;
    const w = c.clientWidth;
    if (w) stage.style.transform = `scale(${w / STAGE_W})`;
  }
}
function ensureBound() {
  if (_bound) return;
  _bound = true;
  if (typeof window !== 'undefined') window.addEventListener('resize', rescaleAll);
}

// Mounts a faithful 16:9 preview of `activity` into `container`.
export function mountThumb(container, activity) {
  if (!container) return;
  injectStyles();
  container.classList.add('ww-thumb');
  container.innerHTML = '';
  const stage = document.createElement('div');
  // ww-player-frame so the scoped skin/background CSS (.ww-player-frame.skin-*)
  // paints the stage; the layout-breaking frame rules require a .ww-play-page
  // ancestor we don't have, so they stay inert.
  stage.className = 'ww-thumb-stage ww-player-frame';
  stage.innerHTML = `<div class="ww-thumb-pad">${buildHtml(activity)}</div>`;
  container.appendChild(stage);
  // Scoped skin + background — applied only to this stage, never page-wide.
  try { applySkin(activity.presentation?.skin || 'default', stage); } catch { /* skin optional */ }
  try { applyBackground(activity.presentation?.background || 'none', stage, activity.presentation?.backgroundImage); } catch { /* bg optional */ }
  _mounted.add(container);
  ensureBound();
  requestAnimationFrame(rescaleAll);
}
