import { on } from '../../core/events.js';
import { renderEditorJuego } from '../../core/editorJuego.js';
import { createBoard, randomBoard } from './game/board.js';
import { renderTubes } from './render/tubes.js';
import { listLevels } from './game/levels.js';

// content shape (single board per activity):
//   { level, mode, random, items: [ { id, board, mode } ] }
// The board is FROZEN here in the editor so every student in a live room sees
// the identical layout (fair). "Generar nuevo tablero" reshuffles it.

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').BallsortContent} BallsortContent
 * @typedef {import('../../kernel/contracts/activity.js').BallsortBoard} BallsortBoard
 * @typedef {import('../../core/editorShell.js').EditorCtx} EditorCtx
 */

/** El contenido de ESTA actividad es el tablero generado (modelo `ballsort`).
 * @param {Activity} a @returns {BallsortContent} */
export const bsContent = (a) => /** @type {BallsortContent} */ (a.content);

/** @param {string} level @param {boolean} random @returns {BallsortBoard} */
function freshBoard(level, random) {
  return random ? randomBoard(level) : createBoard(level);
}

/** @param {Activity} a @returns {Activity} */
export function ensureContent(a) {
  const c = /** @type {BallsortContent} */ (a.content || (a.content = /** @type {BallsortContent} */ ({})));
  if (!c.level) c.level = 'classic';
  if (!c.mode) c.mode = 'moves';
  if (c.random == null) c.random = true;
  if (!Array.isArray(c.items) || !c.items[0]?.board) {
    c.items = [{ id: 'bs1', board: freshBoard(c.level, c.random), mode: c.mode }];
  }
  // keep item mirrors in sync
  c.items[0].mode = c.mode;
  return a;
}

/**
 * @param {Element} root
 * @param {Activity} activity
 * @param {(activity: Activity) => void} onChange
 */
export const renderBallsortEditor = (root, activity, onChange) =>
  renderEditorJuego(root, activity, onChange, { asegurar: ensureContent, etiqueta: 'Tablero', html: contentHtml, wire: wireContent });

/** @param {Activity} a */
function contentHtml(a) {
  const c = bsContent(a);
  const levels = listLevels();
  return `
    <p class="small text-muted">Ordena las pelotas: mueve la de arriba de un tubo a otro hasta que cada tubo tenga un solo color. En vivo (modo <b>Carrera libre</b>) cada alumno resuelve el <b>mismo</b> tablero y el profesor ve los tableros en directo; gana quien resuelve con menos ${c.mode === 'time' ? 'tiempo' : 'movimientos'}.</p>
    <div class="row g-3 mb-3">
      <div class="col-sm-4">
        <label class="form-label fw-bold">Nivel</label>
        <select class="form-select bs-level">
          ${levels.map(l => `<option value="${l.id}" ${c.level === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
        </select>
      </div>
      <div class="col-sm-4">
        <label class="form-label fw-bold">Gana por</label>
        <select class="form-select bs-mode">
          <option value="moves" ${c.mode === 'moves' ? 'selected' : ''}>Menos movimientos</option>
          <option value="time"  ${c.mode === 'time' ? 'selected' : ''}>Menos tiempo</option>
        </select>
      </div>
      <div class="col-sm-4 d-flex align-items-end">
        <div class="form-check">
          <input class="form-check-input bs-random" type="checkbox" id="bs-random" ${c.random ? 'checked' : ''}>
          <label class="form-check-label" for="bs-random">Tablero aleatorio</label>
        </div>
      </div>
    </div>
    <button type="button" class="btn btn-outline-primary mb-3 bs-shuffle"><i class="bi bi-shuffle"></i> Generar nuevo tablero</button>
    <div class="ww-bs"><div id="bs-preview" class="tubes"></div></div>`;
}

/** @param {Element} root @param {Activity} a */
function paintPreview(root, a) {
  const el = /** @type {HTMLElement|null} */ (root.querySelector('#bs-preview'));
  if (el) renderTubes(el, bsContent(a).items[0].board, { interactive: false });
}

/** @param {Activity} a */
function regen(a) {
  const c = bsContent(a);
  c.items = [{ id: 'bs1', board: freshBoard(c.level, c.random), mode: c.mode }];
}

/** @param {HTMLElement} el @returns {string} */
const valorDe = (el) => /** @type {HTMLSelectElement} */ (el).value;

/** @param {Element} root @param {Activity} a @param {EditorCtx} ctx */
function wireContent(root, a, ctx) {
  const c = bsContent(a);
  paintPreview(root, a);
  on(root, 'change', '.bs-level', (_e, el) => { c.level = valorDe(el); regen(a); ctx.onChange(a); ctx.repaint(); });
  on(root, 'change', '.bs-mode', (_e, el) => {
    const v = /** @type {'moves'|'time'} */ (valorDe(el));
    c.mode = v; c.items[0].mode = v;
    ctx.onChange(a); ctx.repaint();
  });
  on(root, 'change', '.bs-random', (_e, el) => {
    c.random = /** @type {HTMLInputElement} */ (el).checked;
    regen(a); ctx.onChange(a); ctx.repaint();
  });
  on(root, 'click', '.bs-shuffle', () => { regen(a); ctx.onChange(a); ctx.repaint(); });
}

