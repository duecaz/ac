// Memoria usa el mismo contenido que Emparejar (pares). Solo aporta sus
// paneles; el chasis lo pone el shell compartido (vía renderPairsEditor, el
// wrapper del modelo — core/contentModels/pairs.js).
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { newPair, renderPairsEditor } from '../../core/contentModels/pairs.js';
import { itemControlsHtml, wireItemList } from '../../core/editorPrimitives.js';
import { scoringPanelHtml, wireScoringPanel } from '../../core/editorPanels.js';
import { DEFAULT_REVEAL_MS } from './player.js';

export function renderMemoryEditor(root, activity, onChange) {
  return renderPairsEditor(root, activity, onChange, {
    seedCount: 3,
    panels: {
      content: { label: 'Pares', html: contentHtml, wire: wireContent },
      rules: { html: rulesHtml, wire: wireRules },
      // Sin el selector "Modo" (bonus por velocidad): Memoria no va a Live
      // (`modes.live: false`) — no hay ronda que premiar por rapidez.
      scoring: { html: (a) => scoringPanelHtml(a, { conModo: false }), wire: wireScoringPanel },
    },
  });
}

function contentHtml(a) {
  return `
    <p class="small text-muted">Cada par genera dos cartas (texto izquierdo y derecho).</p>
    ${a.content.pairs.map((p, i) => `
      <div class="row g-2 mb-2">
        <div class="col-5"><input class="form-control mp-l" data-i="${i}" placeholder="Carta A" value="${escapeHtml(p.left || '')}"></div>
        <div class="col-5"><input class="form-control mp-r" data-i="${i}" placeholder="Carta B" value="${escapeHtml(p.right || '')}"></div>
        <div class="col-2 d-flex">${itemControlsHtml(i, a.content.pairs.length)}</div>
      </div>`).join('')}
    <button class="btn btn-outline-primary mt-2" id="mp-add"><i class="bi bi-plus-lg"></i> Añadir par</button>`;
}
function wireContent(root, a, ctx) {
  on(root, 'input', '.mp-l', (e, el) => { a.content.pairs[+el.dataset.i].left = e.target.value; ctx.onChange(a); });
  on(root, 'input', '.mp-r', (e, el) => { a.content.pairs[+el.dataset.i].right = e.target.value; ctx.onChange(a); });
  wireItemList(root, a, ctx, { list: a.content.pairs, añadir: { selector: '#mp-add', fabrica: newPair } });
}

function rulesHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-4"><label class="form-label">Columnas</label>
      <select id="m-cols" class="form-select">
        ${[2, 3, 4, 5, 6].map(n => `<option value="${n}" ${a.rules.columns === n ? 'selected' : ''}>${n}</option>`).join('')}
      </select></div>
    <div class="col-md-4"><label class="form-label">Tiempo de revelado (ms)</label><input id="m-rev" type="number" min="200" max="5000" class="form-control" value="${a.rules.revealMs ?? DEFAULT_REVEAL_MS}"></div>
  </div>`;
}
function wireRules(root, a, ctx) {
  on(root, 'change', '#m-cols', e => { a.rules.columns = +e.target.value; ctx.onChange(a); });
  on(root, 'input', '#m-rev', e => { a.rules.revealMs = +e.target.value || DEFAULT_REVEAL_MS; ctx.onChange(a); });
}
