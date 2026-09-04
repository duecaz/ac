import { on } from '../../core/events.js';
import { renderEditorJuego } from '../../core/editorJuego.js';
import { createBoard, randomBoard } from './game/board.js';
import { renderTubes } from './render/tubes.js';
import { listLevels } from './game/levels.js';

// content shape (single board per activity):
//   { level, mode, random, items: [ { id, board, mode } ] }
// The board is FROZEN here in the editor so every student in a live room sees
// the identical layout (fair). "Generar nuevo tablero" reshuffles it.

function freshBoard(level, random) {
  return random ? randomBoard(level) : createBoard(level);
}

export function ensureContent(a) {
  const c = a.content || (a.content = {});
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

export const renderBallsortEditor = (root, activity, onChange) =>
  renderEditorJuego(root, activity, onChange, { asegurar: ensureContent, etiqueta: 'Tablero', html: contentHtml, wire: wireContent });

function contentHtml(a) {
  const c = a.content;
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

function paintPreview(root, a) {
  const el = root.querySelector('#bs-preview');
  if (el) renderTubes(el, a.content.items[0].board, { interactive: false });
}

function regen(a) {
  const c = a.content;
  c.items = [{ id: 'bs1', board: freshBoard(c.level, c.random), mode: c.mode }];
}

function wireContent(root, a, ctx) {
  paintPreview(root, a);
  on(root, 'change', '.bs-level', (e) => { a.content.level = e.target.value; regen(a); ctx.onChange(a); ctx.repaint(); });
  on(root, 'change', '.bs-mode', (e) => { a.content.mode = e.target.value; a.content.items[0].mode = e.target.value; ctx.onChange(a); ctx.repaint(); });
  on(root, 'change', '.bs-random', (e) => { a.content.random = e.target.checked; regen(a); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.bs-shuffle', () => { regen(a); ctx.onChange(a); ctx.repaint(); });
}
