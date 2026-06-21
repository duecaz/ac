// Froggy Jumps editor — same QA content model as quiz, with Froggy-specific rules.
import { html, escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { renderImagePicker, attachImagePicker } from '../../core/imagePicker.js';
import { itemControlsHtml, reorderArray } from '../../core/editorPrimitives.js';
import { renderEditorShell } from '../../core/editorShell.js';
import { SCENARIOS } from './player.js';

export function renderFroggyEditor(root, activity, onChange) {
  (activity.content?.items || []).forEach(it => { if (!Array.isArray(it.options)) it.options = ['', '', '', '']; });
  renderEditorShell(root, activity, onChange, {
    content: { label: 'Preguntas', html: contentHtml, wire: wireContent },
    rules:   { html: rulesHtml,   wire: wireRules   },
    scoring: { html: scoringHtml, wire: wireScoring  },
    live:    { html: liveHtml,    wire: wireLive     },
  });
}

// ── Contenido ────────────────────────────────────────────────────────────────
function contentHtml(a) {
  return `
    ${renderItems(a)}
    <div class="d-flex gap-2 flex-wrap">
      <button class="btn btn-outline-primary" id="add-item"><i class="bi bi-plus-lg"></i> Añadir pregunta</button>
      <button class="btn btn-outline-secondary" id="add-tf"><i class="bi bi-check2-square"></i> + V/F</button>
    </div>`;
}

function wireContent(root, a, ctx) {
  on(root, 'click', '#add-item', () => {
    a.content.items.push({ id: 'fq_' + Math.random().toString(36).slice(2, 8), question: '', answer: '', options: ['', '', '', ''], points: 1, image: null });
    ctx.onChange(a); ctx.repaint();
  });
  on(root, 'click', '#add-tf', () => {
    a.content.items.push({ id: 'fq_' + Math.random().toString(36).slice(2, 8), question: '', answer: 'Verdadero', options: ['Verdadero', 'Falso'], points: 1, image: null, kind: 'truefalse' });
    ctx.onChange(a); ctx.repaint();
  });
  on(root, 'click', '.item-del',  (_, b) => { a.content.items.splice(+b.dataset.i, 1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-up',   (_, b) => { reorderArray(a.content.items, +b.dataset.i, -1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-down', (_, b) => { reorderArray(a.content.items, +b.dataset.i, +1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'input', '.it-q',   (e, el) => { a.content.items[+el.dataset.i].question = e.target.value; ctx.onChange(a); });
  on(root, 'click', '.it-correct', (_, el) => {
    const i = +el.dataset.i, k = +el.dataset.k, item = a.content.items[i];
    const opts = item.options || [];
    item.answer = opts[k] || '';
    ctx.onChange(a); ctx.repaint();
  });
  on(root, 'input', '.it-opt', (e, el) => {
    const i = +el.dataset.i, k = +el.dataset.k;
    a.content.items[i].options[k] = e.target.value;
    if (a.content.items[i].answer === '' && k === 0) a.content.items[i].answer = e.target.value;
    ctx.onChange(a);
  });
  a.content.items.forEach((item, i) => {
    attachImagePicker(root, `#frog-img-${i}`, item.image, (url) => { item.image = url; ctx.onChange(a); });
  });
}

function renderItems(a) {
  if (!a.content.items.length) return `<p class="text-muted">No hay preguntas. ¡Añade la primera!</p>`;
  return a.content.items.map((it, i) => {
    const ans = it.answer;
    return `
    <div class="card mb-2"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-success">🐸 ${i + 1}${it.kind === 'truefalse' ? ' · V/F' : ''}</span>
        ${itemControlsHtml(i, a.content.items.length)}
      </div>
      <input class="form-control mb-2 it-q" data-i="${i}" placeholder="Pregunta" value="${escapeHtml(it.question)}">
      <div class="row g-2 mb-2">
        <div class="col-md-8">
          <div class="row g-2">
            ${(it.options || ['','','','']).map((o, k) => {
              const corr = String(ans) === String(o) && o !== '';
              return `<div class="col-12 col-md-6"><div class="input-group">
                <button type="button" class="btn it-correct ${corr ? 'btn-success' : 'btn-outline-secondary'}" data-i="${i}" data-k="${k}">
                  <i class="bi ${corr ? 'bi-check-circle-fill' : 'bi-circle'}"></i>
                </button>
                <input class="form-control it-opt ${corr ? 'border-success' : ''}" data-i="${i}" data-k="${k}" placeholder="Opción ${k+1}" value="${escapeHtml(o)}">
              </div></div>`;
            }).join('')}
          </div>
        </div>
        <div class="col-md-4"><div id="frog-img-${i}">${renderImagePicker(it.image)}</div></div>
      </div>
    </div></div>`;
  }).join('');
}

// ── Reglas ────────────────────────────────────────────────────────────────────
function rulesHtml(a) {
  const r = a.rules || {};
  const scenarioOpts = Object.entries(SCENARIOS).map(([k, v]) =>
    `<option value="${k}" ${(r.froggyScenario || 'swamp') === k ? 'selected' : ''}>${v.label}</option>`
  ).join('');
  return `<div class="row g-3">
    <div class="col-md-4"><label class="form-label">Escenario</label>
      <select class="form-select" id="f-scene">${scenarioOpts}</select></div>
    <div class="col-md-4"><label class="form-label">Timer (s, 0=libre)</label>
      <input type="number" min="0" class="form-control" id="f-timer" value="${r.timer || 0}"></div>
    <div class="col-md-4 form-check pt-4">
      <input class="form-check-input" type="checkbox" id="f-rand" ${r.randomize ? 'checked' : ''}>
      <label class="form-check-label" for="f-rand">Orden aleatorio</label></div>
    <div class="col-md-4 form-check">
      <input class="form-check-input" type="checkbox" id="f-shuf" ${r.shuffleOptions !== false ? 'checked' : ''}>
      <label class="form-check-label" for="f-shuf">Mezclar opciones</label></div>
  </div>
  <div class="alert alert-info mt-3 py-2 small">
    <b>Mecánica de saltos:</b> respuesta correcta = 1 salto · respuesta rápida (+1) · racha 3× (×1.5) · racha 5× (⚡ ×2) · racha 10× (👑 ×3)
  </div>`;
}
function wireRules(root, a, ctx) {
  on(root, 'change', '#f-scene', e => { if (!a.rules) a.rules = {}; a.rules.froggyScenario = e.target.value; ctx.onChange(a); });
  on(root, 'input',  '#f-timer', e => { a.rules.timer = +e.target.value || 0; ctx.onChange(a); });
  on(root, 'change', '#f-rand',  e => { a.rules.randomize = e.target.checked; ctx.onChange(a); });
  on(root, 'change', '#f-shuf',  e => { a.rules.shuffleOptions = e.target.checked; ctx.onChange(a); });
}

// ── Puntuación ────────────────────────────────────────────────────────────────
function scoringHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-4"><label class="form-label">Modo</label>
      <select class="form-select" id="f-smode">
        <option value="flat"   ${a.scoring?.mode !== 'kahoot' ? 'selected':''}>Plano</option>
        <option value="kahoot" ${a.scoring?.mode === 'kahoot' ? 'selected':''}>Kahoot (bonus velocidad)</option>
      </select></div>
    <div class="col-md-4"><label class="form-label">Pts por acierto</label>
      <input type="number" min="1" class="form-control" id="f-ppc" value="${a.scoring?.pointsPerCorrect || 1}"></div>
    <div class="col-md-4"><label class="form-label">Pts por error</label>
      <input type="number" class="form-control" id="f-ppw" value="${a.scoring?.pointsPerWrong || 0}"></div>
  </div>`;
}
function wireScoring(root, a, ctx) {
  on(root, 'change', '#f-smode', e => { a.scoring.mode = e.target.value; ctx.onChange(a); });
  on(root, 'input',  '#f-ppc',   e => { a.scoring.pointsPerCorrect = +e.target.value || 1; ctx.onChange(a); });
  on(root, 'input',  '#f-ppw',   e => { a.scoring.pointsPerWrong = +e.target.value || 0; ctx.onChange(a); });
}

// ── En vivo ────────────────────────────────────────────────────────────────────
function liveHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-4"><label class="form-label">Timer pregunta (s)</label>
      <input id="l-qtimer" type="number" min="5" max="300" class="form-control" value="${a.live?.questionTimer || 20}"></div>
    <div class="col-md-4"><label class="form-label">Modelo de puntos</label>
      <select class="form-select" id="l-points">
        <option value="kahoot" ${(a.live?.pointsModel||'kahoot')==='kahoot'?'selected':''}>Kahoot (bonus velocidad)</option>
        <option value="flat"   ${a.live?.pointsModel==='flat'?'selected':''}>Plano</option>
      </select></div>
    <div class="col-md-4"><label class="form-label">Speed bonus máx</label>
      <input id="l-bonus" type="number" min="0" class="form-control" value="${a.live?.speedBonusMax ?? 1000}"></div>
    <div class="col-md-4"><label class="form-label">Máx. jugadores</label>
      <input id="l-max" type="number" min="1" max="500" class="form-control" value="${a.live?.maxPlayers || 60}"></div>
    <div class="col-md-4 form-check pt-4">
      <input id="l-late" class="form-check-input" type="checkbox" ${a.live?.allowLateJoin?'checked':''}>
      <label class="form-check-label" for="l-late">Permitir unirse tarde</label></div>
    <div class="col-md-4 form-check pt-4">
      <input id="l-lb" class="form-check-input" type="checkbox" ${a.live?.showLeaderboardBetween?'checked':''}>
      <label class="form-check-label" for="l-lb">Leaderboard entre preguntas</label></div>
  </div>`;
}
function wireLive(root, a, ctx) {
  const oc = ctx.onChange;
  on(root, 'input',  '#l-qtimer', e => { a.live.questionTimer = +e.target.value || 20; oc(a); });
  on(root, 'change', '#l-points', e => { a.live.pointsModel = e.target.value; oc(a); });
  on(root, 'input',  '#l-bonus',  e => { a.live.speedBonusMax = +e.target.value || 0; oc(a); });
  on(root, 'input',  '#l-max',    e => { a.live.maxPlayers = +e.target.value || 60; oc(a); });
  on(root, 'change', '#l-late',   e => { a.live.allowLateJoin = e.target.checked; oc(a); });
  on(root, 'change', '#l-lb',     e => { a.live.showLeaderboardBetween = e.target.checked; oc(a); });
}
