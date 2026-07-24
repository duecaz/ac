import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { itemControlsHtml, reorderArray } from '../../core/editorPrimitives.js';
import { renderEditorShell } from '../../core/editorShell.js';
import { generateGrid, SIZE_MAP } from './generator.js';

export function renderWordsearchEditor(root, activity, onChange) {
  renderEditorShell(root, activity, onChange, {
    content: { label: 'Palabras', html: contentHtml, wire: wireContent },
    rules:   { html: rulesHtml,   wire: wireRules   },
    scoring: { html: scoringHtml, wire: wireScoring  },
  });
}

// ── Contenido ────────────────────────────────────────────────────────────────
function contentHtml(a) {
  const words = a.content?.words || [];
  const size  = SIZE_MAP[a.rules?.gridSize] || 15;
  const max   = size * size;   // theoretical max, but much fewer fit in practice

  // Live preview: generate grid thumbnail
  const { grid, placed, failed, rows, cols } = generateGrid(words, {
    rows: size, cols: size, dirs: a.rules?.directions || 'medium',
  });
  const previewHtml = gridPreviewHtml(grid, placed, rows, cols);

  return `
    <div class="row g-3">
      <!-- Word list -->
      <div class="col-md-5">
        <label class="form-label fw-semibold">Lista de palabras</label>
        <p class="small text-muted mb-2">
          ${words.length} palabra(s) · tablero ${size}×${size}
          ${failed?.length ? `<span class="text-danger"> · ${failed.length} no colocada(s)</span>` : ''}
        </p>
        <div class="d-flex flex-column gap-2 mb-3">
          ${words.map((w, i) => {
            const ok = placed.some(p => p.word === String(w).toUpperCase().replace(/\s+/g, ''));
            return `
            <div class="d-flex gap-2 align-items-center">
              <span class="ws-ed-dot ${ok ? 'text-success' : 'text-danger'}" title="${ok ? 'Colocada' : 'No cabe en el tablero'}">${ok ? '✓' : '✗'}</span>
              <input class="form-control form-control-sm ws-ed-word" data-i="${i}" value="${escapeHtml(w)}" placeholder="Palabra ${i + 1}">
              ${itemControlsHtml(i, words.length)}
            </div>`;
          }).join('')}
        </div>
        <button id="ws-add" class="btn btn-outline-primary btn-sm"><i class="bi bi-plus-lg"></i> Añadir palabra</button>
        <button id="ws-bulk" class="btn btn-outline-secondary btn-sm ms-1" data-bs-toggle="collapse" data-bs-target="#ws-bulk-area"><i class="bi bi-list-ul"></i> Bulk</button>
        <div class="collapse mt-2" id="ws-bulk-area">
          <textarea id="ws-bulk-txt" class="form-control form-control-sm" rows="4" placeholder="Una palabra por línea"></textarea>
          <button id="ws-bulk-ok" class="btn btn-primary btn-sm mt-1">Importar</button>
        </div>
      </div>

      <!-- Grid preview -->
      <div class="col-md-7">
        <label class="form-label fw-semibold">Vista previa del tablero</label>
        <div class="ws-ed-preview">
          ${previewHtml}
        </div>
        <p class="small text-muted mt-1">Las palabras marcadas en color están colocadas. El tablero se regenera al guardar.</p>
      </div>
    </div>`;
}

function gridPreviewHtml(grid, placed, rows, cols) {
  // Build set of highlighted cells
  const foundCells = new Set();
  placed.forEach((p, idx) => {
    p.cells.forEach(({ r, c }) => foundCells.add(`${r},${c}|${idx % 8}`));
  });

  const COLORS = ['#3b82f6','#ef4444','#10b981','#f59e0b','#a855f7','#ec4899','#14b8a6','#eab308'];

  const cells = grid.flatMap((row, r) => row.map((l, c) => {
    const key = [...foundCells].find(k => k.startsWith(`${r},${c}|`));
    const bg = key ? COLORS[+key.split('|')[1]] : '';
    const style = bg ? `style="background:${bg}20;color:${bg};font-weight:800"` : '';
    return `<span class="ws-ed-cell" ${style}>${l}</span>`;
  })).join('');

  return `<div class="ws-ed-grid" style="--ws-cols:${cols}">${cells}</div>`;
}

function wireContent(root, a, ctx) {
  on(root, 'input', '.ws-ed-word', (e, el) => {
    a.content.words[+el.dataset.i] = e.target.value;
    ctx.onChange(a);
    // Defer repaint to avoid interrupting typing
    clearTimeout(root._wsRepaintTimer);
    root._wsRepaintTimer = setTimeout(() => ctx.repaint(), 600);
  });
  on(root, 'click', '.item-del', (_, btn) => {
    a.content.words.splice(+btn.dataset.i, 1);
    ctx.onChange(a); ctx.repaint();
  });
  on(root, 'click', '.item-up',   (_, btn) => { reorderArray(a.content.words, +btn.dataset.i, -1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-down', (_, btn) => { reorderArray(a.content.words, +btn.dataset.i, +1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '#ws-add', () => {
    a.content.words.push('');
    ctx.onChange(a); ctx.repaint();
    // Focus new input
    setTimeout(() => {
      const inputs = root.querySelectorAll('.ws-ed-word');
      inputs[inputs.length - 1]?.focus();
    }, 50);
  });
  on(root, 'click', '#ws-bulk-ok', () => {
    const txt = root.querySelector('#ws-bulk-txt')?.value || '';
    const newWords = txt.split('\n').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (newWords.length) { a.content.words.push(...newWords); ctx.onChange(a); ctx.repaint(); }
  });
}

// ── Reglas ────────────────────────────────────────────────────────────────────
function rulesHtml(a) {
  const r = a.rules || {};
  return `
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label">Tamaño del tablero</label>
        <select class="form-select" id="ws-size">
          <option value="easy"   ${r.gridSize === 'easy'   ? 'selected' : ''}>Fácil (10×10)</option>
          <option value="medium" ${r.gridSize === 'medium' || !r.gridSize ? 'selected' : ''}>Medio (15×15)</option>
          <option value="hard"   ${r.gridSize === 'hard'   ? 'selected' : ''}>Difícil (20×20)</option>
        </select>
      </div>
      <div class="col-md-4">
        <label class="form-label">Direcciones</label>
        <select class="form-select" id="ws-dirs">
          <option value="easy"   ${r.directions === 'easy'   ? 'selected' : ''}>Fácil (→ ↓)</option>
          <option value="medium" ${r.directions === 'medium' || !r.directions ? 'selected' : ''}>Medio (+ diagonales)</option>
          <option value="hard"   ${r.directions === 'hard'   ? 'selected' : ''}>Difícil (todas, incl. ← ↑)</option>
        </select>
      </div>
      <div class="col-md-4">
        <label class="form-label">Tiempo límite (s, 0=libre)</label>
        <input type="number" min="0" class="form-control" id="ws-timer" value="${r.timer || 0}">
      </div>
    </div>`;
}
function wireRules(root, a, ctx) {
  on(root, 'change', '#ws-size',  e => { a.rules.gridSize    = e.target.value; ctx.onChange(a); ctx.repaint(); });
  on(root, 'change', '#ws-dirs',  e => { a.rules.directions  = e.target.value; ctx.onChange(a); ctx.repaint(); });
  on(root, 'input',  '#ws-timer', e => { a.rules.timer       = +e.target.value; ctx.onChange(a); });
}

// ── Puntuación ────────────────────────────────────────────────────────────────
function scoringHtml(a) {
  return `
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label">Modo</label>
        <select class="form-select" id="ws-smode">
          <option value="flat"   ${a.scoring?.mode !== 'kahoot' ? 'selected' : ''}>Plano</option>
          <option value="kahoot" ${a.scoring?.mode === 'kahoot' ? 'selected' : ''}>Kahoot (bonus velocidad, para VS)</option>
        </select>
      </div>
      <div class="col-md-4">
        <label class="form-label">Puntos por palabra</label>
        <input type="number" min="1" class="form-control" id="ws-ppc" value="${a.scoring?.pointsPerCorrect || 1}">
      </div>
    </div>
    <p class="small text-muted mt-2">Las palabras largas (más de 6 letras) valen 50% más puntos automáticamente.</p>`;
}
function wireScoring(root, a, ctx) {
  on(root, 'change', '#ws-smode', e => { a.scoring.mode = e.target.value; ctx.onChange(a); });
  on(root, 'input',  '#ws-ppc',   e => { a.scoring.pointsPerCorrect = +e.target.value || 1; ctx.onChange(a); });
}
