// Word search player: solo + VS-round variant.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { trySaveResult } from '../../core/results.js';
import { resultScreenHtml } from '../../core/resultScreen.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import * as Streaks from '../../core/streaks.js';
import { generateGrid, cellLine, SIZE_MAP } from './generator.js';

// Per-player color palette (supports up to 6 players)
const PLAYER_COLORS = [
  { stroke: '#3b82f6', bg: 'rgba(59,130,246,.30)', label: 'Azul'    },
  { stroke: '#ef4444', bg: 'rgba(239,68,68,.30)',   label: 'Rojo'    },
  { stroke: '#10b981', bg: 'rgba(16,185,129,.30)',  label: 'Verde'   },
  { stroke: '#f59e0b', bg: 'rgba(245,158,11,.30)',  label: 'Ámbar'   },
  { stroke: '#a855f7', bg: 'rgba(168,85,247,.30)',  label: 'Morado'  },
  { stroke: '#ec4899', bg: 'rgba(236,72,153,.30)',  label: 'Rosa'    },
];

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
  const ppc      = scoring.pointsPerCorrect || 10;
  const color    = PLAYER_COLORS[opts.playerIndex || 0];

  const { grid, placed, rows, cols } = generateGrid(rawWords, {
    rows: gridN, cols: gridN, dirs: rules.directions || 'medium',
  });

  const total      = placed.length;
  const startedAt  = Date.now();
  const timerSecs  = rules.timer || 0;
  let timerRemain  = timerSecs;
  let timerHandle  = null;

  const state = { score: 0, found: new Set() };

  function rootEl() { return typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel; }

  // ── Build the initial DOM (render once; then mutate for performance) ────────
  function render() {
    mount(rootSel, html`
      <div class="ww-ws">
        <div class="ww-ws-head">
          <div class="ww-ws-head-left">
            <span class="badge bg-secondary ww-ws-count">0/${total}</span>
            <div class="progress ww-ws-progress"><div class="progress-bar bg-success ww-ws-pbar" style="width:0%"></div></div>
          </div>
          ${timerSecs > 0 ? `<span class="badge bg-danger ww-ws-timer">⏱ ${timerSecs}s</span>` : ''}
          <span class="badge bg-primary ww-ws-score">★ 0</span>
        </div>

        <div class="ww-ws-body">
          <div class="ww-ws-grid-wrap">
            <div class="ww-ws-grid" id="ws-grid" style="--ws-cols:${cols}">
              ${grid.flatMap((row, r) => row.map((l, c) =>
                `<span class="ws-cell" data-r="${r}" data-c="${c}">${l}</span>`
              )).join('')}
            </div>
            <svg id="ws-svg" class="ww-ws-svg" viewBox="0 0 ${cols} ${rows}"
                 preserveAspectRatio="none" aria-hidden="true"></svg>
          </div>

          <div class="ww-ws-words">
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
    for (const { r, c } of line) {
      getCell(r, c)?.classList.add('ws-sel');
      selSet.add(`${r},${c}`);
    }
    // Draw SVG selection line
    const svg = document.getElementById('ws-svg');
    let el = svg?.querySelector('#ws-sel-ln');
    if (!el && svg && line.length > 1) {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      el.id = 'ws-sel-ln';
      el.setAttribute('stroke', color.stroke);
      el.setAttribute('stroke-width', '0.72');
      el.setAttribute('stroke-linecap', 'round');
      el.setAttribute('opacity', '0.55');
      svg.appendChild(el);
    }
    if (el && line.length > 1) {
      const s = line[0], e = line[line.length - 1];
      el.setAttribute('x1', s.c + 0.5); el.setAttribute('y1', s.r + 0.5);
      el.setAttribute('x2', e.c + 0.5); el.setAttribute('y2', e.r + 0.5);
    } else el?.remove();
  }

  function clearSel() { setSel(null); document.getElementById('ws-sel-ln')?.remove(); }

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
      setTimeout(() => el.classList.remove('ws-wrong'), 380);
    }
  }

  // ── Word found ──────────────────────────────────────────────────────────────
  function wordFound(p) {
    state.found.add(p.word);
    const pts = ppc + (p.word.length > 6 ? Math.round(ppc * 0.5) : 0);
    state.score += pts;

    const streak = Streaks.bump('solo', activity.id, true);
    emitGame(GameEvents.ANSWER_CORRECT, { idx: state.found.size - 1, points: pts, streak });
    if (streak >= 3) emitGame(GameEvents.STREAK, { count: streak });

    // Mark cells with player color
    const colorIdx = opts.playerIndex || 0;
    for (const { r, c } of p.cells) getCell(r, c)?.classList.add(`ws-found-${colorIdx}`);

    // Permanent SVG line
    const svg = document.getElementById('ws-svg');
    if (svg) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const s = p.cells[0], e = p.cells[p.cells.length - 1];
      line.setAttribute('x1', s.c + 0.5); line.setAttribute('y1', s.r + 0.5);
      line.setAttribute('x2', e.c + 0.5); line.setAttribute('y2', e.r + 0.5);
      line.setAttribute('stroke', color.stroke);
      line.setAttribute('stroke-width', '0.72');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('opacity', '0.72');
      svg.appendChild(line);
    }

    // Update word list
    const wEl = rootEl()?.querySelector(`[data-word="${p.word}"]`);
    if (wEl) { wEl.classList.add('ws-word-found'); wEl.querySelector('.ws-word-dot').textContent = '✓'; }

    // Update counters
    const found = state.found.size;
    rootEl()?.querySelector('.ww-ws-count')?.setText?.(`${found}/${total}`);
    const countEl = rootEl()?.querySelector('.ww-ws-count');
    if (countEl) countEl.textContent = `${found}/${total}`;
    const pbar = rootEl()?.querySelector('.ww-ws-pbar');
    if (pbar) pbar.style.width = `${Math.round(found / total * 100)}%`;
    const scoreEl = rootEl()?.querySelector('.ww-ws-score');
    if (scoreEl) scoreEl.textContent = `★ ${state.score}`;

    if (found >= total) finish();
  }

  // ── Timer ────────────────────────────────────────────────────────────────────
  function startTimer() {
    timerHandle = setInterval(() => {
      timerRemain--;
      emitGame(GameEvents.TICK, { remainSec: timerRemain });
      const el = rootEl()?.querySelector('.ww-ws-timer');
      if (el) el.textContent = `⏱ ${timerRemain}s`;
      if (timerRemain <= 0) { clearInterval(timerHandle); timerHandle = null; finish(); }
    }, 1000);
  }

  // ── Finish ───────────────────────────────────────────────────────────────────
  function finish() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
    const timeUsed = Math.round((Date.now() - startedAt) / 1000);
    const max = total * ppc;
    Streaks.reset('solo', activity.id);
    emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score: state.score }] });
    mount(rootSel, resultScreenHtml({
      lead: `Palabras: <b>${state.found.size}/${total}</b> · Puntos: <b>${state.score}</b>`,
      stats: `Tiempo: ${timeUsed}s`,
      score: state.score, maxScore: max,
    }));
    trySaveResult(opts, {
      activityId: activity.id, scoreAuto: state.score, scoreFinal: state.score,
      maxScore: max, timeUsed,
    });
    if (opts.onFinish) opts.onFinish({ score: state.score, found: [...state.found], startedAt });
  }

  render();
}

// ── VS / Equipos round renderer ──────────────────────────────────────────────
// Shows the full grid with the target word highlighted at top.
// Player drags to find it; onSubmit(word) fires on success, onSubmit(null) on skip.
export function renderWordsearchRound(root, payload, { onSubmit } = {}) {
  if (!payload) return;
  const { grid, rows, cols, word, color = PLAYER_COLORS[0] } = payload;
  let dragging = false, startR = 0, startC = 0;
  let selSet = new Set(), cellMap;

  root.innerHTML = `
    <div class="ww-ws" style="padding:.5rem">
      <div class="ww-ws-round-target">
        Encuentra: <span class="ww-ws-target-word">${escapeHtml(word)}</span>
      </div>
      <div class="ww-ws-body" style="margin-top:.5rem">
        <div class="ww-ws-grid-wrap">
          <div class="ww-ws-grid" id="ws-grid-r" style="--ws-cols:${cols}">
            ${grid.flatMap((row, r) => row.map((l, c) =>
              `<span class="ws-cell" data-r="${r}" data-c="${c}">${l}</span>`
            )).join('')}
          </div>
          <svg class="ww-ws-svg" viewBox="0 0 ${cols} ${rows}" preserveAspectRatio="none" aria-hidden="true"></svg>
        </div>
      </div>
      <div class="text-center mt-2">
        <button id="ws-skip" class="btn btn-sm btn-outline-secondary">Omitir</button>
      </div>
    </div>`;

  // Build cell map
  cellMap = new Map();
  root.querySelectorAll('.ws-cell').forEach(el => cellMap.set(`${el.dataset.r},${el.dataset.c}`, el));
  const getCell = (r, c) => cellMap.get(`${r},${c}`) ?? null;
  const cellFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el?.dataset?.r ? { r: +el.dataset.r, c: +el.dataset.c } : null;
  };

  const svg = root.querySelector('.ww-ws-svg');

  function setSel(line) {
    for (const k of selSet) { const [r, c] = k.split(','); getCell(r, c)?.classList.remove('ws-sel'); }
    selSet.clear();
    if (!line) { svg?.querySelector('#ws-sel-ln')?.remove(); return; }
    for (const { r, c } of line) { getCell(r, c)?.classList.add('ws-sel'); selSet.add(`${r},${c}`); }
    if (svg && line.length > 1) {
      let el = svg.querySelector('#ws-sel-ln');
      if (!el) {
        el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        el.id = 'ws-sel-ln';
        el.setAttribute('stroke', color.stroke);
        el.setAttribute('stroke-width', '0.72');
        el.setAttribute('stroke-linecap', 'round');
        el.setAttribute('opacity', '0.55');
        svg.appendChild(el);
      }
      const s = line[0], e = line[line.length - 1];
      el.setAttribute('x1', s.c + 0.5); el.setAttribute('y1', s.r + 0.5);
      el.setAttribute('x2', e.c + 0.5); el.setAttribute('y2', e.r + 0.5);
    }
  }

  function checkSel() {
    if (!selSet.size) return;
    const cells = [...selSet].map(k => k.split(',').map(Number)).map(([r, c]) => ({ r, c }));
    const letters  = cells.map(({ r, c }) => grid[r]?.[c] || '').join('');
    const reversed = letters.split('').reverse().join('');
    if (letters === word || reversed === word) {
      onSubmit?.(word);
    } else {
      for (const { r, c } of cells) {
        const el = getCell(r, c);
        if (!el) continue;
        el.classList.add('ws-wrong');
        setTimeout(() => el.classList.remove('ws-wrong'), 380);
      }
    }
  }

  const gridEl = root.querySelector('#ws-grid-r');
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

  root.querySelector('#ws-skip')?.addEventListener('click', () => onSubmit?.(null));
}
