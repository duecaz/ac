// Memoria usa el mismo contenido que Emparejar (pares). Solo aporta sus
// paneles; el chasis lo pone el shell compartido (vía renderPairsEditor, el
// wrapper del modelo — core/contentModels/pairs.js).
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { newPair, paresDe } from '../../core/contentModels/pairs.js';
import { renderPairsEditor } from '../../core/editorPares.js';
import { itemControlsHtml, wireItemList, wireCampoTexto } from '../../core/editorPrimitives.js';
import { scoringPanelHtml, wireScoringPanel } from '../../core/editorPanels.js';
import { DEFAULT_REVEAL_MS } from './player.js';
import { memoryRules } from './template.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').Pair} Pair
 * @typedef {import('../../kernel/contracts/activity.js').PairsContent} PairsContent
 * @typedef {import('../../core/editorShell.js').EditorCtx} EditorCtx
 */

/**
 * @param {Element} root
 * @param {Activity} activity
 * @param {(activity: Activity) => void} onChange
 */
export function renderMemoryEditor(root, activity, onChange) {
  return renderPairsEditor(root, /** @type {import('../../kernel/contracts/activity.js').Activity<PairsContent>} */ (activity), onChange, {
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

/** @param {Activity} a */
function contentHtml(a) {
  const lista = paresDe(a);
  return `
    <p class="small text-muted">Cada par genera dos cartas (texto izquierdo y derecho).</p>
    ${lista.map((p, i) => `
      <div class="row g-2 mb-2">
        <div class="col-5"><input class="form-control mp-l" data-i="${i}" placeholder="Carta A" value="${escapeHtml(p.left || '')}"></div>
        <div class="col-5"><input class="form-control mp-r" data-i="${i}" placeholder="Carta B" value="${escapeHtml(p.right || '')}"></div>
        <div class="col-2 d-flex">${itemControlsHtml(i, lista.length)}</div>
      </div>`).join('')}
    <button class="btn btn-outline-primary mt-2" id="mp-add"><i class="bi bi-plus-lg"></i> Añadir par</button>`;
}
/** @param {Element} root @param {Activity} a @param {EditorCtx} ctx */
function wireContent(root, a, ctx) {
  wireCampoTexto(root, a, ctx, { selector: '.mp-l', lista: () => paresDe(a), campo: 'left' });
  wireCampoTexto(root, a, ctx, { selector: '.mp-r', lista: () => paresDe(a), campo: 'right' });
  wireItemList(root, a, ctx, { list: paresDe(a), añadir: { selector: '#mp-add', fabrica: newPair } });
}

/** @param {Activity} a */
function rulesHtml(a) {
  const rules = memoryRules(a);
  return `<div class="row g-3">
    <div class="col-md-4"><label class="form-label">Columnas</label>
      <select id="m-cols" class="form-select">
        ${[2, 3, 4, 5, 6].map(n => `<option value="${n}" ${rules.columns === n ? 'selected' : ''}>${n}</option>`).join('')}
      </select></div>
    <div class="col-md-4"><label class="form-label">Tiempo de revelado (ms)</label><input id="m-rev" type="number" min="200" max="5000" class="form-control" value="${rules.revealMs ?? DEFAULT_REVEAL_MS}"></div>
  </div>`;
}
/** @param {Element} root @param {Activity} a @param {EditorCtx} ctx */
function wireRules(root, a, ctx) {
  on(root, 'change', '#m-cols', (e, el) => { a.rules.columns = +(/** @type {HTMLSelectElement} */ (el).value); ctx.onChange(a); });
  on(root, 'input', '#m-rev', (e, el) => { a.rules.revealMs = +(/** @type {HTMLInputElement} */ (el).value) || DEFAULT_REVEAL_MS; ctx.onChange(a); });
}
