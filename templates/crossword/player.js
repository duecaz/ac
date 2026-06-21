// Crucigrama — solo player.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { trySaveResult } from '../../core/results.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { buildGrid } from './generator.js';

export async function renderCrosswordPlayer(rootSel, activity, opts = {}) {
  const wordsRaw = (activity.content?.words || [])
    .filter(w => w.word && w.clue && w.row != null && w.col != null && w.dir);

  if (!wordsRaw.length) {
    mount(rootSel, html`<div class="alert alert-warning m-3">No hay palabras configuradas.</div>`);
    return;
  }

  const { grid, rows, cols, wordNums, words } = buildGrid(wordsRaw);
  if (!rows || !cols) {
    mount(rootSel, html`<div class="alert alert-danger m-3">Error al generar el crucigrama.</div>`);
    return;
  }

  const startedAt = Date.now();
  const totalWords = words.length;

  // User state: 2D array of typed letters, set of solved word IDs
  const userGrid  = Array.from({ length: rows }, () => Array(cols).fill(''));
  const solvedIds = new Set();

  // Interaction state
  let activeR = -1, activeC = -1;
  let activeDir = 'H';    // 'H' | 'V'
  let activeWordId = null;

  // ── Render ────────────────────────────────────────────────────────────────

  function buildHtml() {
    const hWords = words.filter(w => w.dir === 'H').sort((a,b) => wordNums[a.id] - wordNums[b.id]);
    const vWords = words.filter(w => w.dir === 'V').sort((a,b) => wordNums[a.id] - wordNums[b.id]);

    const gridCells = grid.flatMap(row => row.map(cell => {
      if (cell.blocked) return `<div class="cw-cell cw-blocked"></div>`;
      const numHtml = cell.number != null ? `<span class="cw-num">${cell.number}</span>` : '';
      return `<div class="cw-cell cw-white" data-r="${cell.r}" data-c="${cell.c}" tabindex="0">
        ${numHtml}<span class="cw-letter" id="cwl-${cell.r}-${cell.c}"></span>
      </div>`;
    })).join('');

    const clueList = (list, label) => `
      <div class="cw-clue-section">
        <div class="cw-clue-heading">${label}</div>
        ${list.map(w => `<div class="cw-clue" data-wid="${w.id}" id="cwc-${w.id}">
          <b>${wordNums[w.id]}.</b> ${escapeHtml(w.clue)}
        </div>`).join('')}
      </div>`;

    return html`
      <div class="cw-wrap">
        <!-- Header -->
        <div class="cw-header">
          <span class="cw-title">${escapeHtml(activity.title || 'Crucigrama')}</span>
          <div class="cw-progress-wrap">
            <div class="cw-progress-bar" id="cw-pbar" style="width:0%"></div>
          </div>
          <span class="cw-progress-txt" id="cw-ptxt">0 / ${totalWords}</span>
        </div>

        <!-- Body: clues + grid -->
        <div class="cw-body">
          <div class="cw-clues" id="cw-clues">
            ${clueList(hWords, 'Horizontales →')}
            ${clueList(vWords, 'Verticales ↓')}
          </div>
          <div class="cw-grid-wrap">
            <div class="cw-grid" id="cw-grid" style="--cw-cols:${cols};--cw-rows:${rows}">
              ${gridCells}
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="cw-footer">
          <button class="btn btn-success btn-sm" id="cw-check"><i class="bi bi-check2-circle"></i> Verificar</button>
          <button class="btn btn-outline-secondary btn-sm" id="cw-hint"><i class="bi bi-lightbulb"></i> Pista</button>
          <button class="btn btn-outline-danger btn-sm" id="cw-reset"><i class="bi bi-arrow-counterclockwise"></i> Reiniciar</button>
        </div>

        <!-- Hidden input for mobile keyboard -->
        <input id="cw-ki" type="text" inputmode="text" autocomplete="off" autocorrect="off"
               autocapitalize="characters" spellcheck="false"
               style="position:fixed;opacity:0;pointer-events:none;left:0;top:0;width:1px;height:1px">
      </div>`;
  }

  mount(rootSel, buildHtml());
  requestAnimationFrame(fitGrid);
  attachInteraction();

  // ── Fit grid to available space ──────────────────────────────────────────

  function fitGrid() {
    const wrap = document.querySelector(`${rootSel} .cw-grid-wrap`);
    const grid = document.querySelector(`${rootSel} #cw-grid`);
    if (!wrap || !grid) return;
    const availW = wrap.clientWidth  - 4;  // 4px = border*2
    const availH = wrap.clientHeight - 4;
    if (!availW || !availH) return;
    const cellPx = Math.max(18, Math.floor(Math.min(availW / cols, availH / rows)));
    grid.style.setProperty('--cw-cell', `${cellPx}px`);
  }

  // Recalculate if container resizes; disconnect when game finishes
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    const wrap = document.querySelector(`${rootSel} .cw-grid-wrap`);
    if (wrap) {
      ro = new ResizeObserver(() => fitGrid());
      ro.observe(wrap);
    }
  }

  // ── Interaction ──────────────────────────────────────────────────────────

  function attachInteraction() {
    const ki = document.getElementById('cw-ki'); // keyboard input (mobile)
    const gridEl = document.getElementById('cw-grid');

    // Click on a cell
    on(rootSel, 'pointerdown', '.cw-white', (e, el) => {
      e.preventDefault();
      const r = +el.dataset.r, c = +el.dataset.c;
      if (r === activeR && c === activeC) {
        // Toggle direction
        activeDir = activeDir === 'H' ? 'V' : 'H';
      } else {
        selectCell(r, c);
      }
      highlightActive();
      ki?.focus();
    });

    // Mobile / desktop keyboard input
    ki?.addEventListener('keydown', (e) => {
      if (activeR < 0) return;
      if (e.key === 'Backspace') { e.preventDefault(); eraseLetter(); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); move(0, 1); return; }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); move(0,-1); return; }
      if (e.key === 'ArrowDown')  { e.preventDefault(); move(1, 0); return; }
      if (e.key === 'ArrowUp')    { e.preventDefault(); move(-1,0); return; }
      if (e.key === 'Tab') { e.preventDefault(); activeDir === 'H' ? nextWord('H') : nextWord('V'); return; }
    });

    ki?.addEventListener('input', (e) => {
      if (activeR < 0) return;
      const raw = e.target.value.replace(/\s/g, '');
      e.target.value = '';
      if (!raw) return;
      const char = raw.slice(-1).toUpperCase();
      if (/[A-ZÁÉÍÓÚÜÑ]/.test(char)) setLetter(char);
    });

    // Clue click → go to word start
    on(rootSel, 'click', '.cw-clue', (_, el) => {
      const wid = el.dataset.wid;
      const w = words.find(x => x.id === wid);
      if (!w) return;
      activeDir = w.dir;
      selectCell(w.row, w.col);
      highlightActive();
      ki?.focus();
    });

    // Buttons
    on(rootSel, 'click', '#cw-check', checkAll);
    on(rootSel, 'click', '#cw-hint',  giveHint);
    on(rootSel, 'click', '#cw-reset', resetGrid);
  }

  // ── Cell helpers ──────────────────────────────────────────────────────────

  function cellEl(r, c) {
    return document.querySelector(`#cw-grid [data-r="${r}"][data-c="${c}"]`);
  }
  function letterEl(r, c) { return document.getElementById(`cwl-${r}-${c}`); }
  function clueEl(wid)    { return document.getElementById(`cwc-${wid}`); }

  function isWhite(r, c) {
    return r >= 0 && r < rows && c >= 0 && c < cols && !grid[r][c].blocked;
  }

  function wordAtCell(r, c, dir) {
    const cell = grid[r]?.[c];
    if (!cell || cell.blocked) return null;
    return cell.wordIds.find(id => {
      const w = words.find(x => x.id === id);
      return w && w.dir === dir;
    }) ?? cell.wordIds[0] ?? null;
  }

  function selectCell(r, c) {
    if (!isWhite(r, c)) return;
    activeR = r; activeC = c;
    // Prefer the word matching activeDir; fall back to the other direction
    const wid = wordAtCell(r, c, activeDir) ?? wordAtCell(r, c, activeDir === 'H' ? 'V' : 'H');
    if (wid) {
      const w = words.find(x => x.id === wid);
      if (w) activeDir = w.dir;
    }
    activeWordId = wordAtCell(r, c, activeDir);
  }

  function highlightActive() {
    // Clear all highlights
    document.querySelectorAll(`${rootSel} .cw-white`).forEach(el => el.classList.remove('cw-active-word', 'cw-active-cell'));
    document.querySelectorAll(`${rootSel} .cw-clue`).forEach(el => el.classList.remove('cw-clue-active'));
    if (activeR < 0) return;

    // Highlight all cells of active word
    if (activeWordId) {
      const w = words.find(x => x.id === activeWordId);
      if (w) {
        for (let i = 0; i < w.word.length; i++) {
          const r = w.dir === 'H' ? w.row       : w.row + i;
          const c = w.dir === 'H' ? w.col + i   : w.col;
          cellEl(r, c)?.classList.add('cw-active-word');
        }
        clueEl(w.id)?.classList.add('cw-clue-active');
        // Scroll clue into view
        clueEl(w.id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    // Highlight active cell itself
    cellEl(activeR, activeC)?.classList.add('cw-active-cell');
  }

  function setLetter(char) {
    if (!isWhite(activeR, activeC)) return;
    userGrid[activeR][activeC] = char;
    const el = letterEl(activeR, activeC);
    if (el) { el.textContent = char; el.classList.remove('cw-wrong-letter'); }
    // Remove wrong state from cell
    cellEl(activeR, activeC)?.classList.remove('cw-wrong-word');

    // Check if the words through this cell are now solved
    const cell = grid[activeR]?.[activeC];
    if (cell) {
      cell.wordIds.forEach(wid => {
        if (!solvedIds.has(wid)) checkWord(wid);
      });
    }

    advanceCursor();
  }

  function eraseLetter() {
    const el = letterEl(activeR, activeC);
    if (el && userGrid[activeR]?.[activeC]) {
      userGrid[activeR][activeC] = '';
      el.textContent = '';
      el.classList.remove('cw-wrong-letter');
      cellEl(activeR, activeC)?.classList.remove('cw-correct-word', 'cw-wrong-word');
      // Un-solve if word was solved
      const cell = grid[activeR]?.[activeC];
      if (cell) {
        cell.wordIds.forEach(wid => {
          if (solvedIds.has(wid)) {
            solvedIds.delete(wid);
            markWord(wid, 'none');
          }
        });
      }
    } else {
      // Move back and erase
      movePrev();
      const el2 = letterEl(activeR, activeC);
      if (el2) { userGrid[activeR][activeC] = ''; el2.textContent = ''; }
    }
    updateProgress();
  }

  function advanceCursor() {
    // Move to next empty cell in the current word, else next cell overall
    const w = words.find(x => x.id === activeWordId);
    if (!w) { move(activeDir === 'H' ? 0 : 1, activeDir === 'H' ? 1 : 0); return; }

    // Find current index in word using the word's own direction, not activeDir
    const idx = w.dir === 'H' ? activeC - w.col : activeR - w.row;
    // Try next cells in word
    for (let i = idx + 1; i < w.word.length; i++) {
      const r = w.dir === 'H' ? w.row       : w.row + i;
      const c = w.dir === 'H' ? w.col + i   : w.col;
      if (!userGrid[r][c]) {
        selectCell(r, c); highlightActive(); return;
      }
    }
    // Word full — just advance one step
    move(activeDir === 'H' ? 0 : 1, activeDir === 'H' ? 1 : 0);
  }

  function movePrev() {
    const w = words.find(x => x.id === activeWordId);
    if (!w) return;
    const idx = w.dir === 'H' ? activeC - w.col : activeR - w.row;
    if (idx > 0) {
      const r = w.dir === 'H' ? w.row       : w.row + idx - 1;
      const c = w.dir === 'H' ? w.col + idx - 1 : w.col;
      selectCell(r, c); highlightActive();
    }
  }

  function move(dr, dc) {
    let r = activeR + dr, c = activeC + dc;
    while (r >= 0 && r < rows && c >= 0 && c < cols) {
      if (isWhite(r, c)) { selectCell(r, c); highlightActive(); return; }
      r += dr; c += dc;
    }
  }

  function nextWord(dir) {
    const sorted = words.filter(w => w.dir === dir).sort((a,b) => wordNums[a.id] - wordNums[b.id]);
    const cur = sorted.findIndex(w => w.id === activeWordId);
    const nxt = sorted[(cur + 1) % sorted.length];
    if (nxt) { activeDir = nxt.dir; selectCell(nxt.row, nxt.col); highlightActive(); }
  }

  // ── Word validation ──────────────────────────────────────────────────────

  function checkWord(wid) {
    const w = words.find(x => x.id === wid);
    if (!w) return false;
    for (let i = 0; i < w.word.length; i++) {
      const r = w.dir === 'H' ? w.row : w.row + i;
      const c = w.dir === 'H' ? w.col + i : w.col;
      if ((userGrid[r]?.[c] || '') !== w.word[i]) return false;
    }
    // Correct!
    solvedIds.add(wid);
    markWord(wid, 'correct');
    updateProgress();
    if (solvedIds.size === totalWords) finishGame();
    return true;
  }

  function markWord(wid, state) {
    const w = words.find(x => x.id === wid);
    if (!w) return;
    for (let i = 0; i < w.word.length; i++) {
      const r = w.dir === 'H' ? w.row : w.row + i;
      const c = w.dir === 'H' ? w.col + i : w.col;
      const el = cellEl(r, c);
      el?.classList.remove('cw-correct-word', 'cw-wrong-word');
      if (state === 'correct') el?.classList.add('cw-correct-word');
      if (state === 'wrong')   el?.classList.add('cw-wrong-word');
    }
    const cl = clueEl(wid);
    cl?.classList.remove('cw-clue-solved', 'cw-clue-wrong');
    if (state === 'correct') cl?.classList.add('cw-clue-solved');
    if (state === 'wrong')   cl?.classList.add('cw-clue-wrong');
  }

  function checkAll() {
    let allCorrect = true;
    for (const w of words) {
      if (solvedIds.has(w.id)) { markWord(w.id, 'correct'); continue; }
      // Check letter by letter
      let wordOk = true;
      for (let i = 0; i < w.word.length; i++) {
        const r = w.dir === 'H' ? w.row : w.row + i;
        const c = w.dir === 'H' ? w.col + i : w.col;
        const typed = userGrid[r]?.[c] || '';
        const correct = typed === w.word[i];
        if (!correct) wordOk = false;
        if (typed && !correct) letterEl(r, c)?.classList.add('cw-wrong-letter');
        else letterEl(r, c)?.classList.remove('cw-wrong-letter');
      }
      if (wordOk) {
        solvedIds.add(w.id); markWord(w.id, 'correct');
      } else {
        allCorrect = false; markWord(w.id, 'wrong');
      }
    }
    updateProgress();
    if (solvedIds.size === totalWords) finishGame();
  }

  function giveHint() {
    // Reveal one random unsolved letter in the active word (or any word)
    const unsolved = words.filter(w => !solvedIds.has(w.id));
    if (!unsolved.length) return;
    const w = words.find(x => x.id === activeWordId && !solvedIds.has(x.id)) || unsolved[0];
    for (let i = 0; i < w.word.length; i++) {
      const r = w.dir === 'H' ? w.row : w.row + i;
      const c = w.dir === 'H' ? w.col + i : w.col;
      if (!userGrid[r][c]) {
        userGrid[r][c] = w.word[i];
        const el = letterEl(r, c);
        if (el) { el.textContent = w.word[i]; el.classList.add('cw-hint-letter'); }
        checkWord(w.id);
        updateProgress();
        return;
      }
    }
  }

  function resetGrid() {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        userGrid[r][c] = '';
        const el = letterEl(r, c);
        if (el) { el.textContent = ''; el.className = 'cw-letter'; }
        cellEl(r, c)?.classList.remove('cw-correct-word', 'cw-wrong-word');
      }
    solvedIds.clear();
    document.querySelectorAll(`${rootSel} .cw-clue`).forEach(el => el.classList.remove('cw-clue-solved','cw-clue-wrong'));
    updateProgress();
  }

  // ── Progress + finish ─────────────────────────────────────────────────────

  function updateProgress() {
    const pct = totalWords ? Math.round(solvedIds.size / totalWords * 100) : 0;
    const pbar = document.getElementById('cw-pbar');
    const ptxt = document.getElementById('cw-ptxt');
    if (pbar) pbar.style.width = `${pct}%`;
    if (ptxt) ptxt.textContent = `${solvedIds.size} / ${totalWords}`;
  }

  function finishGame() {
    ro?.disconnect();
    const timeUsed = Math.round((Date.now() - startedAt) / 1000);
    emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score: totalWords }] });
    const celebEl = document.createElement('div');
    celebEl.className = 'cw-celebration';
    celebEl.innerHTML = `
      <div class="cw-celeb-box">
        <div style="font-size:3rem">🎉</div>
        <h3>¡Crucigrama completado!</h3>
        <p class="text-muted">Tiempo: ${timeUsed}s · ${totalWords} palabras encontradas</p>
        <button class="btn btn-primary" id="cw-celeb-close">Continuar</button>
      </div>`;
    document.querySelector('.cw-wrap')?.appendChild(celebEl);
    document.getElementById('cw-celeb-close')?.addEventListener('click', () => {
      celebEl.remove();
    });
    trySaveResult(opts, { activityId: activity.id, scoreAuto: totalWords, scoreFinal: totalWords, maxScore: totalWords, timeUsed });
    if (opts.onFinish) opts.onFinish({ score: totalWords, timeUsed });
  }

  // Select the first cell of the first word on load
  if (words.length) {
    const first = words.sort((a,b) => (wordNums[a.id]||0) - (wordNums[b.id]||0))[0];
    activeDir = first.dir;
    selectCell(first.row, first.col);
    highlightActive();
  }
}
