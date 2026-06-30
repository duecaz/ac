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
    .filter(p => (String(p.left||'').trim() || p.leftImage || p.image) &&
                 (String(p.right||'').trim() || p.rightImage))
    .slice(0, 4);
  if (!pairs.length) return emptyHtml(act);

  // Snapshot fiel del player nuevo: cuadros 16/10 centrados (imagen que LLENA con
  // su badge, o texto), dos columnas, y un par de cuerdas conectando.
  const N = pairs.length;
  const W = STAGE_W, H = STAGE_H, HEAD = 96, GAPY = 22;
  const cardH = Math.min(190, Math.floor((H - HEAD - 60 - (N - 1) * GAPY) / N));
  const cardW = Math.round(cardH * 16 / 10);
  const leftX = 150, rightX = W - 150 - cardW;
  const top0 = HEAD + 20;
  const cy = (i) => top0 + i * (cardH + GAPY) + cardH / 2;

  const card = (p, side, i) => {
    const x = side === 'L' ? leftX : rightX;
    const img  = side === 'L' ? (p.leftImage || p.image || null) : (p.rightImage || null);
    const text = side === 'L' ? (p.left || '') : (p.right || '');
    const dotX = side === 'L' ? x + cardW - 4 : x - 12;
    const inner = img
      ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;display:block;" alt="">
         <span style="position:absolute;left:50%;bottom:9px;transform:translateX(-50%);background:rgba(17,24,39,.9);color:#fff;font-weight:700;font-size:1.05rem;padding:5px 16px;border-radius:999px;white-space:nowrap;max-width:88%;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(text)}</span>`
      : `<span style="font-weight:700;font-size:1.25rem;color:#1f2937;text-align:center;padding:6px;">${escapeHtml(text)}</span>`;
    return `<div style="position:absolute;left:${x}px;top:${top0 + i * (cardH + GAPY)}px;width:${cardW}px;height:${cardH}px;
        border:3px solid #c7d2fe;border-radius:13px;background:#fff;overflow:visible;
        display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.06);">
      ${inner}
      <span style="position:absolute;left:${dotX - x}px;top:50%;transform:translateY(-50%);width:18px;height:18px;border-radius:50%;background:#94a3b8;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);"></span>
    </div>`;
  };

  // Derecha = invertida (como el barajado del juego). Cuerdas por fila (una recta
  // + alguna cruzada) solo para mostrar la mecánica de emparejar.
  const rights = [...pairs].reverse();
  const ROPES = ['#6366f1','#0891b2','#f59e0b','#a855f7'];
  const links = [[0, 0], [1, 2], [2, 1], [3, 3]].filter(([l, r]) => l < N && r < N);
  const ropes = links.map(([l, r], i) => {
    const x1 = leftX + cardW, y1 = cy(l);
    const x2 = rightX,        y2 = cy(r);
    const mx = (x1 + x2) / 2, sag = 26;
    const col = ROPES[i % ROPES.length];
    return `<g filter="url(#mshadow)">
        <path d="M${x1},${y1} C${mx},${y1 + sag} ${mx},${y2 + sag} ${x2},${y2}" stroke="rgba(0,0,0,.2)" stroke-width="14" fill="none" stroke-linecap="round"/>
        <path d="M${x1},${y1} C${mx},${y1 + sag} ${mx},${y2 + sag} ${x2},${y2}" stroke="${col}" stroke-width="8" fill="none" stroke-linecap="round"/>
      </g>
      <circle cx="${x1}" cy="${y1}" r="9" fill="${col}"/><circle cx="${x2}" cy="${y2}" r="9" fill="${col}"/>`;
  }).join('');

  return `<div class="ww-match" style="position:absolute;inset:0;">
    <div style="position:absolute;left:40px;top:34px;background:#6c757d;color:#fff;font-weight:700;border-radius:8px;padding:4px 12px;font-size:1.05rem;">0 / ${N}</div>
    <svg viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible">
      <defs><filter id="mshadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.25"/></filter></defs>
      ${ropes}
    </svg>
    ${pairs.map((p, i) => card(p, 'L', i)).join('')}
    ${rights.map((p, i) => card(p, 'R', i)).join('')}
  </div>`;
}

function memoryHtml(act) {
  const pairs = (act.content?.pairs || [])
    .filter(p => String(p.left||'').trim() && String(p.right||'').trim());
  if (!pairs.length) return emptyHtml(act);
  // Same bold, centered, square-card look as "Abre Cajas": big tiles filling the
  // stage, no cramped header. A "game in progress" snapshot — pair 0 matched
  // (green), one card of pair 1 flipped (white), the rest face-down with a
  // colourful back — so it reads as Memory at a glance and stays vivid.
  const BACK = ['#e74c3c','#e67e22','#d4ac0d','#27ae60','#16a085','#2980b9','#8e44ad','#c0392b'];
  const shown = pairs.slice(0, 6);                       // keep tiles big & bold
  const cards = shown.flatMap((p, i) => [{ text: p.left, pair: i }, { text: p.right, pair: i }]);
  const cols = Math.min(6, Math.max(3, act.rules?.columns || 4));
  const matched = new Set([0, 1]);   // first pair fully matched
  const open = new Set([2]);         // one card of the second pair flipped up
  const sq = `aspect-ratio:1;border-radius:16px;display:flex;align-items:center;justify-content:center;font-weight:800;text-align:center;padding:6px;overflow:hidden;box-sizing:border-box;`;
  const txt = `font-size:clamp(.8rem,4.5cqmin,1.7rem);line-height:1.1;overflow:hidden;`;
  const tile = (c, idx) => {
    if (matched.has(idx)) return `<div style="${sq}background:#198754;color:#fff;box-shadow:0 4px 12px rgba(25,135,84,.35)"><span style="${txt}">${escapeHtml(c.text)}</span></div>`;
    if (open.has(idx))    return `<div style="${sq}background:#fff;color:#212529;border:4px solid #6610f2;box-shadow:0 4px 12px rgba(0,0,0,.12)"><span style="${txt}">${escapeHtml(c.text)}</span></div>`;
    const bg = BACK[idx % BACK.length];
    return `<div style="${sq}background:${bg};color:rgba(255,255,255,.92);font-size:clamp(1.6rem,9cqmin,3.4rem);box-shadow:0 4px 12px rgba(0,0,0,.18)">?</div>`;
  };
  return `<div class="ww-player" style="display:flex;flex-direction:column;height:100%;gap:1.2rem;justify-content:center">
    <div class="fs-3 fw-bold text-center">${escapeHtml(act.title || 'Memoria')}</div>
    <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:14px;max-width:820px;margin:0 auto;width:100%">${cards.map(tile).join('')}</div>
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
  let labels = items.map(i => typeof i === 'string' ? i : (i.q || i.text || i.label || i.question || ''))
    .filter(Boolean).slice(0, 8);
  // Rueda nueva/sin rellenar: en vez de colapsar al círculo punteado vacío,
  // dibujamos porciones numeradas para que el preview siempre parezca una ruleta.
  if (!labels.length) {
    const n = Math.min(8, Math.max(4, items.length || 4));
    labels = Array.from({ length: n }, (_, i) => String(i + 1));
  }
  return `<div class="ww-player" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem">
    ${wheelSvg(labels, { size: 520 })}
    <div class="fs-4 fw-semibold text-center">${escapeHtml(act.title || 'Ruleta')}</div>
  </div>`;
}

// "Abre Cajas" (question-live): grid of numbered colored boxes, or a wheel of
// numbers if the activity uses the wheel selector — mirrors the solo player.
function boxesHtml(act) {
  const BOX = ['#e74c3c','#e67e22','#d4ac0d','#27ae60','#16a085','#2980b9','#8e44ad','#c0392b'];
  const items = act.content?.items || act.content?.entries || [];
  const n = items.length || 6;
  if ((act.rules?.selector) === 'wheel') {
    const labels = Array.from({ length: Math.min(n, 8) }, (_, i) => String(i + 1));
    return `<div class="ww-player" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem">
      ${wheelSvg(labels, { size: 520 })}
      <div class="fs-4 fw-semibold text-center">${escapeHtml(act.title || 'Abre Cajas')}</div>
    </div>`;
  }
  const cols = Math.min(4, Math.max(2, Math.ceil(n / 2)));
  const boxes = Array.from({ length: n }, (_, i) =>
    `<div style="background:${BOX[i % BOX.length]};color:#fff;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:clamp(1.6rem,9cqmin,3.4rem);font-weight:800;aspect-ratio:1">${i + 1}</div>`
  ).join('');
  return `<div class="ww-player" style="display:flex;flex-direction:column;height:100%;gap:1.2rem;justify-content:center">
    <div class="fs-3 fw-bold text-center">${escapeHtml(act.title || 'Abre Cajas')}</div>
    <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:14px;max-width:760px;margin:0 auto;width:100%">${boxes}</div>
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

// Decorative crossword shape for an empty/new activity: a fixed cross of white
// cells so the card reads as a crossword instead of just showing a bare title.
function crosswordPlaceholderHtml(act) {
  const W = '#fff', B = null;
  const pattern = [
    [B, 'C', B, B, B],
    ['S', 'R', 'U', 'Z', B],
    [B, 'U', B, B, B],
    [B, 'C', B, 'P', B],
    [B, 'E', 'R', 'A', B],
  ];
  const cellPx = 46;
  const cells = pattern.flatMap((row, r) => row.map((l, c) =>
    l === B
      ? `<div style="width:${cellPx}px;height:${cellPx}px;background:#343a40"></div>`
      : `<div style="width:${cellPx}px;height:${cellPx}px;background:${W};border:1px solid #adb5bd;display:flex;align-items:center;justify-content:center;font-size:${cellPx*0.5}px;font-weight:800;color:#212529">${l}</div>`
  )).join('');
  return `<div style="display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center;gap:1rem">
    <div style="display:grid;grid-template-columns:repeat(5,${cellPx}px);gap:2px;background:#dee2e6;border:2px solid #dee2e6;border-radius:6px;overflow:hidden">${cells}</div>
    <div class="fs-4 fw-semibold text-center">${escapeHtml(act.title || 'Crucigrama')}</div>
  </div>`;
}

function crosswordHtml(act) {
  const words = (act.content?.words || []).filter(w => w.word && w.word.length >= 2 && w.row != null && w.col != null && w.dir);
  if (!words.length) return crosswordPlaceholderHtml(act);

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

// "Ordena las Pelotas" (ballsort): a static render of the frozen board — tubes of
// coloured balls, exactly like the game's first screen. Self-contained inline
// styles (no dependency on the scoped .ww-bs CSS / container units).
function ballsortHtml(act) {
  const board = act.content?.items?.[0]?.board;
  if (!board?.tubes?.length) return emptyHtml(act);
  const cap = board.tubeCapacity || 7;
  const TUBE = 68, BALL = 54, GAP = 4;
  const ball = (color) => {
    const base = `width:${BALL}px;height:${BALL}px;border-radius:50%;margin:0 auto;box-sizing:border-box;`;
    if (!color)            return `<div style="${base}background:transparent;border:1px dashed #3a4356"></div>`;
    if (color === 'white') return `<div style="${base}background:#fff;border:2px solid #000"></div>`;
    return `<div style="${base}background:${color}"></div>`;
  };
  const tubes = board.tubes.map(tube => {
    const slots = Array.from({ length: cap }, (_, i) => ball(tube[i])).join('');
    return `<div style="width:${TUBE}px;background:#2a3140;border:2px solid #3a4356;border-radius:0 0 24px 24px;display:flex;flex-direction:column-reverse;padding:4px;gap:${GAP}px;box-sizing:border-box">${slots}</div>`;
  }).join('');
  return `<div class="ww-player" style="display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center;gap:1.4rem">
    <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;align-items:flex-end">${tubes}</div>
    <div class="fs-3 fw-semibold text-center">${escapeHtml(act.title || 'Ordena las Pelotas')}</div>
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
    case 'question-live': return boxesHtml(act);
    case 'wordsearch':  return wordsearchHtml(act);
    case 'crossword':   return crosswordHtml(act);
    case 'ballsort':    return ballsortHtml(act);
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
