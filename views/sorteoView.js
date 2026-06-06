// Sorteo — a standalone classroom WHEEL utility (not tied to an activity): spin
// to pick a team, a student or any entry at random. Useful to choose whose turn
// it is in Equipos, or to draw names. Reuses the pure wheel logic + SVG drawing.
import { html, escapeHtml, mount, $ } from '../core/html.js';
import { on } from '../core/events.js';
import { normalizeEntries, pickIndex, landingRotation, removeAt } from '../templates/wheel/logic.js';
import { wheelSvg } from '../templates/wheel/render.js';
import { GameEvents, emitGame } from '../core/gameEvents.js';

const DUR = 4000;
const DEFAULT = ['Equipo 1', 'Equipo 2', 'Equipo 3', 'Equipo 4'];

export function renderSorteoView(rootSel) {
  let entries = DEFAULT.slice();
  let remove = false;       // draw without replacement
  let history = [];
  let rotation = 0;
  let spinning = false;

  paint();

  function paint(winner = null) {
    mount(rootSel, html`
      <div class="sorteo container py-3">
        <a href="#/home" class="btn btn-sm btn-link"><i class="bi bi-arrow-left"></i> Inicio</a>
        <h3 class="mb-1"><i class="bi bi-bullseye text-success"></i> Sorteo</h3>
        <p class="text-muted">Gira para elegir al azar: equipo, turno o alumno.</p>
        <div class="row g-4 align-items-start">
          <div class="col-12 col-lg-5">
            <label class="form-label small text-muted">Opciones (una por línea)</label>
            <textarea id="sorteo-list" class="form-control" rows="8" ${spinning ? 'disabled' : ''}>${escapeHtml(entries.join('\n'))}</textarea>
            <div class="form-check mt-2">
              <input class="form-check-input" type="checkbox" id="sorteo-remove" ${remove ? 'checked' : ''}>
              <label class="form-check-label" for="sorteo-remove">Quitar al elegido (sorteo sin repetición)</label>
            </div>
            <div class="d-flex flex-wrap gap-2 mt-2">
              <button class="btn btn-sm btn-outline-secondary" data-preset="nums">Números 1–30</button>
              <button class="btn btn-sm btn-outline-secondary" data-preset="teams">Equipos 1–4</button>
              <button class="btn btn-sm btn-outline-secondary" id="sorteo-clear">Vaciar</button>
            </div>
          </div>
          <div class="col-12 col-lg-7 text-center">
            <div style="position:relative;display:inline-block">
              ${wheelSvg(normalizeEntries(entries), { rotation, dur: DUR, spinning })}
              <div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:36px;color:#000">▼</div>
            </div>
            <div class="mt-3" style="min-height:3rem">
              ${winner != null ? `<div class="alert alert-success d-inline-block fs-4 mb-0"><b>${escapeHtml(winner)}</b></div>` : ''}
            </div>
            <button class="btn btn-success btn-lg" id="sorteo-spin" ${spinning ? 'disabled' : ''}><i class="bi bi-arrow-repeat"></i> Girar</button>
            ${history.length ? `<div class="mt-3 small text-muted">Salieron: ${history.map(escapeHtml).join(' · ')}</div>` : ''}
          </div>
        </div>
      </div>`);
    wire();
  }

  function readList() {
    const ta = $('#sorteo-list');
    if (ta) entries = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
  }

  function wire() {
    on(rootSel, 'input', '#sorteo-list', () => { /* captured on spin */ });
    on(rootSel, 'change', '#sorteo-remove', (_, el) => { remove = el.checked; });
    on(rootSel, 'click', '[data-preset]', (_, b) => {
      entries = b.dataset.preset === 'nums'
        ? Array.from({ length: 30 }, (_, i) => String(i + 1))
        : DEFAULT.slice();
      history = []; rotation = 0; paint();
    });
    on(rootSel, 'click', '#sorteo-clear', () => { entries = []; history = []; rotation = 0; paint(); });
    on(rootSel, 'click', '#sorteo-spin', spin);
  }

  function spin() {
    readList();
    const list = normalizeEntries(entries);
    const target = pickIndex(list.length);
    const winner = list[target];
    spinning = true;
    rotation = landingRotation(target, list.length);
    paint();
    setTimeout(() => {
      spinning = false;
      history.push(winner);
      emitGame(GameEvents.ANSWER_CORRECT, {}); // a little flourish
      if (remove) { entries = removeAt(list, target); rotation = 0; }
      paint(winner);
    }, DUR);
  }
}
