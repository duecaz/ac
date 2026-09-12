import { escapeHtml, valorDe } from '../../core/html.js';
import { on } from '../../core/events.js';
import { renderEditorShell } from '../../core/editorShell.js';
import { wireCampoTexto } from '../../core/editorPrimitives.js';
import { palabraJugable, palabrasDe } from '../../core/contentModels/words.js';
import { autoLayout, buildGrid } from './generator.js';
import { rid } from '../../core/ids.js';

const uid = () => rid('cw_');

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').CrosswordWord} CrosswordWord
 * @typedef {import('../../core/editorShell.js').EditorCtx} EditorCtx
 */

/** Las fichas de ESTA actividad. La LISTA la da el modelo (`palabrasDe`); lo
 *  único que pone aquí el Crucigrama es de qué forma son SUS elementos —fichas
 *  con pista, no cadenas sueltas como en la Sopa—.
 *  @param {Activity} a @returns {CrosswordWord[]} */
const palabras = (a) => /** @type {CrosswordWord[]} */ (palabrasDe(a));

/**
 * @param {Element} root
 * @param {Activity} activity
 * @param {(activity: Activity) => void} onChange
 * @returns {void}
 */
export function renderCrosswordEditor(root, activity, onChange) {
  // Mismo blindaje que el resto de editores: con el contenido vacío o a medias
  // se pinta el estado vacío en vez de lanzar antes de dibujar nada.
  if (!activity.content || typeof activity.content !== 'object') activity.content = { words: [] };
  const contenido = /** @type {{words?: CrosswordWord[]}} */ (activity.content);
  if (!Array.isArray(contenido.words)) contenido.words = [];
  renderEditorShell(root, activity, onChange, {
    content: { label: 'Palabras', html: contentHtml, wire: wireContent },
    rules:   { html: rulesHtml,   wire: wireRules   },
  });
}

// ── Content tab ───────────────────────────────────────────────────────────────
/** @param {Activity} a @returns {string} */
function contentHtml(a) {
  const words = palabras(a);
  const previewHtml = buildPreviewHtml(words);

  return `
    <div class="row g-3">
      <!-- Word list -->
      <div class="col-lg-6">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <label class="form-label fw-semibold mb-0">${words.length} palabra(s)</label>
          <div class="d-flex gap-1">
            <button class="btn btn-outline-primary btn-sm" id="cw-auto"><i class="bi bi-magic"></i> Auto-colocar</button>
            <button class="btn btn-outline-success btn-sm" id="cw-add"><i class="bi bi-plus-lg"></i> Añadir palabra</button>
          </div>
        </div>

        <div class="table-responsive" style="max-height:420px;overflow-y:auto">
          <table class="table table-sm align-middle mb-0">
            <thead class="table-light sticky-top">
              <tr>
                <th>Palabra</th><th>Pista</th>
                <th style="width:55px">Fila</th><th style="width:55px">Col</th>
                <th style="width:70px">Dir</th><th style="width:36px"></th>
              </tr>
            </thead>
            <tbody>
              ${words.map((w, i) => `
                <tr>
                  <td><input class="form-control form-control-sm cw-word" data-i="${i}" value="${escapeHtml(w.word || '')}" placeholder="PALABRA" style="min-width:80px;text-transform:uppercase"></td>
                  <td><input class="form-control form-control-sm cw-clue" data-i="${i}" value="${escapeHtml(w.clue || '')}" placeholder="Definición" style="min-width:120px"></td>
                  <td><input type="number" class="form-control form-control-sm cw-row" data-i="${i}" value="${w.row ?? 0}" min="0" style="width:55px"></td>
                  <td><input type="number" class="form-control form-control-sm cw-col" data-i="${i}" value="${w.col ?? 0}" min="0" style="width:55px"></td>
                  <td>
                    <select class="form-select form-select-sm cw-dir" data-i="${i}" style="width:70px">
                      <option value="H" ${(w.dir || 'H') === 'H' ? 'selected' : ''}>→ H</option>
                      <option value="V" ${w.dir === 'V' ? 'selected' : ''}>↓ V</option>
                    </select>
                  </td>
                  <td><button class="btn btn-sm btn-outline-danger cw-del" data-i="${i}"><i class="bi bi-trash3"></i></button></td>
                </tr>`).join('')}
            </tbody>
          </table>
          ${!words.length ? `<p class="text-muted text-center py-3">Añade palabras para comenzar.</p>` : ''}
        </div>
      </div>

      <!-- Preview -->
      <div class="col-lg-6">
        <label class="form-label fw-semibold">Vista previa</label>
        <div class="cw-ed-preview" id="cw-ed-preview">${previewHtml}</div>
        <p class="small text-muted mt-1">Las palabras en rojo tienen conflictos de posición.</p>
      </div>
    </div>`;
}

/** @param {CrosswordWord[]} words @returns {string} */
function buildPreviewHtml(words) {
  if (!words.length) return `<div class="text-muted text-center py-4">Sin palabras</div>`;
  const filtered = words.filter(palabraJugable);
  if (!filtered.length) return `<div class="text-muted text-center py-4">Configura posiciones</div>`;

  try {
    const { grid, rows, cols } = buildGrid(filtered);
    if (!rows || !cols) return `<div class="text-danger small">Error al generar el tablero</div>`;

    const maxCells = 25; // limit preview size
    const skip = rows > maxCells || cols > maxCells;
    if (skip) return `<div class="text-muted small text-center py-3">Tablero grande (${rows}×${cols}) — guarda para previsualizar</div>`;

    const cellPx = Math.max(22, Math.min(34, Math.floor(360 / Math.max(rows, cols))));
    const cells = grid.flatMap(row => row.map(cell => {
      if (cell.blocked) return `<div class="cw-pre-blk"></div>`;
      const num = cell.number != null ? `<span style="font-size:${Math.max(7, cellPx * 0.35)}px;position:absolute;top:1px;left:2px;line-height:1;color:#6c757d">${cell.number}</span>` : '';
      return `<div class="cw-pre-cell" style="width:${cellPx}px;height:${cellPx}px;position:relative">${num}<span style="font-size:${Math.max(9, cellPx * 0.5)}px;font-weight:700">${cell.letter}</span></div>`;
    })).join('');

    return `<div style="display:grid;grid-template-columns:repeat(${cols},${cellPx}px);gap:1px;background:#dee2e6;border:1px solid #dee2e6;border-radius:6px;overflow:hidden;display:inline-grid">${cells}</div>`;
  } catch {
    return `<div class="text-danger small">Error al generar la vista previa</div>`;
  }
}

/** @param {Element} root @param {Activity} a @param {EditorCtx} ctx @returns {void} */
function wireContent(root, a, ctx) {
  const words = () => palabras(a);

  on(root, 'click', '#cw-add', () => {
    words().push({ id: uid(), word: '', clue: '', row: 0, col: words().length, dir: 'H' });
    ctx.onChange(a); ctx.repaint();
    setTimeout(() => {
      const rows = root.querySelectorAll('.cw-word');
      const ultima = /** @type {HTMLElement|undefined} */ (rows[rows.length - 1]);
      ultima?.focus();
    }, 50);
  });

  on(root, 'click', '#cw-auto', () => {
    const defs = words().map(w => ({ word: w.word, clue: w.clue })).filter(w => w.word);
    if (!defs.length) return;
    const laid = autoLayout(defs);
    // Preserve IDs and clues from existing words
    const existing = words().slice();
    (/** @type {{words: CrosswordWord[]}} */ (a.content)).words = laid.map((l, i) => ({
      ...(existing[i] || {}),
      id: existing[i]?.id || uid(),
      word: l.word, clue: l.clue,
      row: l.row, col: l.col, dir: l.dir,
    }));
    ctx.onChange(a); ctx.repaint();
  });

  on(root, 'click', '.cw-del', (_, btn) => {
    words().splice(+(btn.dataset.i ?? 0), 1);
    ctx.onChange(a); ctx.repaint();
  });

  // Debounced preview refresh on any field change
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let previewTimer;
  const refreshPreview = () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const prev = document.getElementById('cw-ed-preview');
      if (prev) prev.innerHTML = buildPreviewHtml(words());
    }, 500);
  };

  wireCampoTexto(root, a, ctx, { selector: '.cw-clue', lista: words, campo: 'clue' });
  on(root, 'input', '.cw-word', (e, el) => {
    const campo = /** @type {HTMLInputElement|null} */ (e.target);
    const w = words()[+(el.dataset.i ?? 0)];
    w.word = valorDe(e).toUpperCase().replace(/\s+/g, '');
    if (campo) campo.value = w.word;
    ctx.onChange(a); refreshPreview();
  });
  on(root, 'input', '.cw-row',   (e, el) => { words()[+(el.dataset.i ?? 0)].row  = Math.max(0, +valorDe(e) || 0); ctx.onChange(a); refreshPreview(); });
  on(root, 'input', '.cw-col',   (e, el) => { words()[+(el.dataset.i ?? 0)].col  = Math.max(0, +valorDe(e) || 0); ctx.onChange(a); refreshPreview(); });
  // El desplegable solo ofrece H y V: se lee como lo que es, no como texto libre.
  on(root, 'change', '.cw-dir',  (e, el) => { words()[+(el.dataset.i ?? 0)].dir = valorDe(e) === 'V' ? 'V' : 'H'; ctx.onChange(a); refreshPreview(); });
}

// ── Rules tab ─────────────────────────────────────────────────────────────────
/** @param {Activity} a @returns {string} */
function rulesHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-6">
      <label class="form-label">Mostrar letras de ayuda</label>
      <select class="form-select" id="cw-hint-mode">
        <option value="none"  ${(a.rules?.hintMode||'none')==='none'?'selected':''}>Sin ayuda</option>
        <option value="first" ${a.rules?.hintMode==='first'?'selected':''}>Primera letra de cada palabra</option>
      </select>
    </div>
  </div>
  <div class="alert alert-info mt-3 py-2 small">
    <b>Tip:</b> Usa el botón <b>Auto-colocar</b> en la pestaña Palabras para que el sistema
    coloque automáticamente las palabras formando cruces. Después ajusta manualmente si lo necesitas.
  </div>`;
}
/** @param {Element} root @param {Activity} a @param {EditorCtx} ctx @returns {void} */
function wireRules(root, a, ctx) {
  on(root, 'change', '#cw-hint-mode', e => { a.rules.hintMode = valorDe(e); ctx.onChange(a); });
}
