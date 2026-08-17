// Word search player: solo + VS-round variant.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { WRONG_FLASH_MS } from '../../core/timings.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import * as Streaks from '../../core/streaks.js';
import { createCountdown } from '../../core/soloTimer.js';
import { generateGrid, cellLine, SIZE_MAP } from './generator.js';
import { scoreWordsearch } from './scorer.js';
import { basePoints } from '../../core/scoring/index.js';
import { hudHtml, hudSet } from '../../core/playerHud.js';

// Per-player color palette (supports up to 6 players)
const PLAYER_COLORS = [
  { stroke: '#3b82f6', bg: 'rgba(59,130,246,.30)', label: 'Azul'    },
  { stroke: '#ef4444', bg: 'rgba(239,68,68,.30)',   label: 'Rojo'    },
  { stroke: '#10b981', bg: 'rgba(16,185,129,.30)',  label: 'Verde'   },
  { stroke: '#f59e0b', bg: 'rgba(245,158,11,.30)',  label: 'Ámbar'   },
  { stroke: '#a855f7', bg: 'rgba(168,85,247,.30)',  label: 'Morado'  },
  { stroke: '#ec4899', bg: 'rgba(236,72,153,.30)',  label: 'Rosa'    },
];

const wsNorm = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');

// Draw an SVG <line> between the CENTRES of cells a and b in REAL pixel coords.
// The old approach used viewBox grid-units (x = c+0.5), but the grid has gaps +
// a border and is centred inside a wider wrap, so the line drifted badly. Pixel
// coords from getBoundingClientRect are robust to all of that. The SVG must have
// NO viewBox (its user units are then CSS pixels).
function wsDrawLine(svg, gridEl, a, b, { color = '#3b82f6', opacity = 0.7, id } = {}) {
  if (!svg || !gridEl) return null;
  const cA = gridEl.querySelector(`.ws-cell[data-r="${a.r}"][data-c="${a.c}"]`);
  const cB = gridEl.querySelector(`.ws-cell[data-r="${b.r}"][data-c="${b.c}"]`);
  if (!cA || !cB) return null;
  const sr = svg.getBoundingClientRect();
  const ra = cA.getBoundingClientRect(), rb = cB.getBoundingClientRect();
  const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  if (id) ln.id = id;
  ln.setAttribute('x1', ra.left + ra.width / 2 - sr.left);
  ln.setAttribute('y1', ra.top  + ra.height / 2 - sr.top);
  ln.setAttribute('x2', rb.left + rb.width / 2 - sr.left);
  ln.setAttribute('y2', rb.top  + rb.height / 2 - sr.top);
  ln.setAttribute('stroke', color);
  ln.setAttribute('stroke-width', Math.max(5, ra.width * 0.7));
  ln.setAttribute('stroke-linecap', 'round');
  ln.setAttribute('opacity', opacity);
  svg.appendChild(ln);
  return ln;
}

// ── Solo player ──────────────────────────────────────────────────────────────

export async function renderWordsearchPlayer(rootSel, activity, opts = {}) {
  const rawWords = (activity.content?.words || [])
    .map(w => typeof w === 'string' ? w : (w?.word || '')).filter(Boolean);

  if (!rawWords.length) {
    mount(rootSel, html`<div class="alert alert-warning m-3">No hay palabras configuradas.</div>`);
    return;
  }

  const rules    = activity.rules  || {};
  const scoring  = activity.scoring || {};
  const gridN    = SIZE_MAP[rules.gridSize] || 15;
  const color    = PLAYER_COLORS[opts.playerIndex || 0];

  const { grid, placed, rows, cols } = generateGrid(rawWords, {
    rows: gridN, cols: gridN, dirs: rules.directions || 'medium',
  });

  const total      = placed.length;
  const timerSecs  = rules.timer || 0;
  let timer        = null;

  const ctx = runFreeformPlayer(rootSel, activity, opts);
  const state = { score: 0, found: new Set() };

  function rootEl() { return typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel; }

  // ── Build the initial DOM (render once; then mutate for performance) ────────
  function render() {
    mount(rootSel, html`
      <div class="ww-ws">
        ${hudHtml({
          pagina: `0 / ${total}`,
          tiempo: timerSecs > 0 ? `⏱ ${timerSecs}` : null,
          puntos: '★ 0',
        })}
        <div class="ww-ws-body">
          <div class="edu-sec edu-sec--tablero ww-ws-grid-wrap">
            <div class="ww-ws-grid" id="ws-grid" style="--ws-cols:${cols}">
              ${grid.flatMap((row, r) => row.map((l, c) =>
                `<span class="ws-cell" data-r="${r}" data-c="${c}">${l}</span>`
              )).join('')}
            </div>
            <svg id="ws-svg" class="ww-ws-svg" aria-hidden="true"></svg>
          </div>

          <div class="edu-sec edu-sec--banco ww-ws-words">
            <div class="ww-ws-words-title">Palabras</div>
            ${placed.map(p => `
              <div class="ws-word" data-word="${escapeHtml(p.word)}">
                <span class="ws-word-dot">○</span>
                <span class="ws-word-lbl">${escapeHtml(p.word)}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
    `);

    attachDrag();
    if (timerSecs > 0) startTimer();
  }

  // ── Drag interaction ────────────────────────────────────────────────────────
  let dragging = false, startR = 0, startC = 0;
  let selSet = new Set();
  let cellMap;

  function buildCellMap() {
    const g = document.getElementById('ws-grid');
    cellMap = new Map();
    g?.querySelectorAll('.ws-cell').forEach(el => cellMap.set(`${el.dataset.r},${el.dataset.c}`, el));
  }

  function getCell(r, c) { return cellMap?.get(`${r},${c}`) ?? null; }

  function cellFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el?.dataset?.r) return null;
    return { r: +el.dataset.r, c: +el.dataset.c };
  }

  function setSel(line) {
    // Clear previous
    for (const k of selSet) {
      const [r, c] = k.split(',');
      getCell(r, c)?.classList.remove('ws-sel');
    }
    selSet.clear();
    if (!line) return;
    // Highlight the cells under the drag (NO line — the line is drawn only when a
    // word is found correctly, so a wrong drag never leaves a misleading line).
    for (const { r, c } of line) {
      getCell(r, c)?.classList.add('ws-sel');
      selSet.add(`${r},${c}`);
    }
  }

  function clearSel() { setSel(null); }

  function attachDrag() {
    buildCellMap();
    const gridEl = document.getElementById('ws-grid');
    if (!gridEl) return;

    gridEl.addEventListener('pointerdown', (e) => {
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (!cell) return;
      e.preventDefault();
      dragging = true;
      startR = cell.r; startC = cell.c;
      setSel([cell]);
      gridEl.setPointerCapture(e.pointerId);
    }, { passive: false });

    gridEl.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (!cell) return;
      const line = cellLine(startR, startC, cell.r, cell.c);
      setSel(line || [{ r: startR, c: startC }]);
    }, { passive: false });

    gridEl.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      checkSelection();
      clearSel();
    });

    gridEl.addEventListener('pointercancel', () => { dragging = false; clearSel(); });
  }

  // ── Selection checking ──────────────────────────────────────────────────────
  function checkSelection() {
    if (!selSet.size) return;
    const cells = [...selSet].map(k => k.split(',').map(Number)).map(([r, c]) => ({ r, c }));
    const letters   = cells.map(({ r, c }) => grid[r]?.[c] || '').join('');
    const reversed  = letters.split('').reverse().join('');

    for (const p of placed) {
      if (state.found.has(p.word)) continue;
      if (letters === p.word || reversed === p.word) {
        wordFound(p);
        return;
      }
    }
    // No match — flash cells red
    for (const { r, c } of cells) {
      const el = getCell(r, c);
      if (!el) continue;
      el.classList.add('ws-wrong');
      setTimeout(() => el.classList.remove('ws-wrong'), WRONG_FLASH_MS);
    }
  }

  // ── Word found ──────────────────────────────────────────────────────────────
  function wordFound(p) {
    state.found.add(p.word);
    // Un solo scorer por plantilla (ley en CLAUDE.md): el player NO reimplementa
    // el conteo — mismo scoreWordsearch que VS/sesión.
    const pts = scoreWordsearch({ value: p.word, activity, mode: 'solo' }).points;
    state.score += pts;

    const streak = Streaks.bump('solo', activity.id, true);
    emitGame(GameEvents.ANSWER_CORRECT, { idx: state.found.size - 1, points: pts, streak });
    if (streak >= 3) emitGame(GameEvents.STREAK, { count: streak });

    // Mark cells with player color
    const colorIdx = opts.playerIndex || 0;
    for (const { r, c } of p.cells) getCell(r, c)?.classList.add(`ws-found-${colorIdx}`);

    // Permanent SVG line — pixel-based so it lands exactly on the word.
    const svg = document.getElementById('ws-svg');
    const gridEl = document.getElementById('ws-grid');
    wsDrawLine(svg, gridEl, p.cells[0], p.cells[p.cells.length - 1], { color: color.stroke, opacity: 0.72 });

    // Update word list
    const wEl = rootEl()?.querySelector(`[data-word="${p.word}"]`);
    if (wEl) { wEl.classList.add('ws-word-found'); wEl.querySelector('.ws-word-dot').textContent = '✓'; }

    // Update counters
    const found = state.found.size;
    hudSet(rootEl(), 'pagina', `${found} / ${total}`);
    hudSet(rootEl(), 'puntos', `★ ${state.score}`);

    if (found >= total) finish();
  }

  // ── Timer ────────────────────────────────────────────────────────────────────
  function startTimer() {
    timer = createCountdown(timerSecs, {
      onTick: (remaining) => {
        emitGame(GameEvents.TICK, { remainSec: remaining });
        hudSet(rootEl(), 'tiempo', `⏱ ${remaining}`);
      },
      onTimeout: () => finish(),
    });
    timer.start();
  }

  // ── Finish ───────────────────────────────────────────────────────────────────
  function finish() {
    if (timer) { timer.stop(); timer = null; }
    const max = total * basePoints(null, scoring);   // misma convención que el scorer
    Streaks.reset('solo', activity.id);
    emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score: state.score }] });
    ctx.finish({
      lead: `Palabras: <b>${state.found.size}/${total}</b> · Puntos: <b>${state.score}</b>`,
      stats: ({ timeUsed }) => `Tiempo: ${timeUsed}s`,
      score: state.score, maxScore: max,
    });
  }

  render();
}

// ── VS / Equipos round renderer ──────────────────────────────────────────────
// Mirrors the solo experience: the WHOLE board + ALL words are shown, the player
// drags freely to find ANY word (free-find), and each correct find fires
// onSubmit(word) — the engine advances one segment per find. Words already found
// (carried in payload.found across re-renders) are pre-marked with a permanent
// line so progress survives a re-render. Each VS side gets a DIFFERENT board
// (seeded by side in getRoundPayload) so opponents can't copy positions.
export function renderWordsearchRound(root, payload, { onSubmit } = {}) {
  if (!payload) return;
  const { grid, cols, placed = [], found = [], side = 'left' } = payload;
  const color = PLAYER_COLORS[side === 'right' ? 1 : 0];
  const colorIdx = side === 'right' ? 1 : 0;
  const foundSet = new Set(found.map(wsNorm));
  const total = placed.length;

  let dragging = false, startR = 0, startC = 0;
  let selSet = new Set(), cellMap;

  root.innerHTML = `
    <div class="ww-ws ww-ws-round">
      <div class="ww-ws-body">
        <div class="ww-ws-grid-wrap">
          <div class="ww-ws-grid" id="ws-grid-r" style="--ws-cols:${cols}">
            ${grid.flatMap((row, r) => row.map((l, c) =>
              `<span class="ws-cell" data-r="${r}" data-c="${c}">${l}</span>`
            )).join('')}
          </div>
          <svg class="ww-ws-svg" aria-hidden="true"></svg>
        </div>
        <div class="ww-ws-words">
          <div class="ww-ws-words-title">Palabras <span class="ws-words-count">0/${total}</span></div>
          ${placed.map(p => `
            <div class="ws-word" data-word="${escapeHtml(wsNorm(p.word))}">
              <span class="ws-word-dot">○</span>
              <span class="ws-word-lbl">${escapeHtml(p.word)}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>`;

  cellMap = new Map();
  root.querySelectorAll('.ws-cell').forEach(el => cellMap.set(`${el.dataset.r},${el.dataset.c}`, el));
  const getCell = (r, c) => cellMap.get(`${r},${c}`) ?? null;
  const cellFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el?.dataset?.r ? { r: +el.dataset.r, c: +el.dataset.c } : null;
  };

  const svg = root.querySelector('.ww-ws-svg');
  const gridEl = root.querySelector('#ws-grid-r');

  function markFound(p) {
    const w = wsNorm(p.word);
    foundSet.add(w);
    for (const { r, c } of p.cells) getCell(r, c)?.classList.add(`ws-found-${colorIdx}`);
    wsDrawLine(svg, gridEl, p.cells[0], p.cells[p.cells.length - 1], { color: color.stroke, opacity: 0.72 });
    const wEl = root.querySelector(`.ws-word[data-word="${w}"]`);
    if (wEl) { wEl.classList.add('ws-word-found'); const d = wEl.querySelector('.ws-word-dot'); if (d) d.textContent = '✓'; }
    const cEl = root.querySelector('.ws-words-count');
    if (cEl) cEl.textContent = `${foundSet.size}/${total}`;
  }

  // Pre-mark words already found (draw after layout so pixel coords are valid).
  function paintFound() {
    for (const p of placed) if (foundSet.has(wsNorm(p.word))) markFound(p);
    const cEl = root.querySelector('.ws-words-count');
    if (cEl) cEl.textContent = `${foundSet.size}/${total}`;
  }
  requestAnimationFrame(paintFound);

  function setSel(line) {
    for (const k of selSet) { const [r, c] = k.split(','); getCell(r, c)?.classList.remove('ws-sel'); }
    selSet.clear();
    if (!line) return;
    // Highlight cells only — NO preview line. The line is drawn solely when the
    // word is correct, so a wrong drag never leaves a misleading line.
    for (const { r, c } of line) { getCell(r, c)?.classList.add('ws-sel'); selSet.add(`${r},${c}`); }
  }

  function checkSel() {
    if (!selSet.size) return;
    const cells = [...selSet].map(k => k.split(',').map(Number)).map(([r, c]) => ({ r, c }));
    const letters  = cells.map(({ r, c }) => grid[r]?.[c] || '').join('');
    const reversed = letters.split('').reverse().join('');
    for (const p of placed) {
      const w = wsNorm(p.word);
      if (foundSet.has(w)) continue;
      if (letters === w || reversed === w) {
        markFound(p);
        onSubmit?.(p.word);
        return;
      }
    }
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
      gridEl.setPointerCapture(e.pointerId);
    }, { passive: false });
    gridEl.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (!cell) return;
      const line = cellLine(startR, startC, cell.r, cell.c);
      setSel(line || [{ r: startR, c: startC }]);
    }, { passive: false });
    gridEl.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      checkSel();
      setSel(null);
    });
    gridEl.addEventListener('pointercancel', () => { dragging = false; setSel(null); });
  }
}
