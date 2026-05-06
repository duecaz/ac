// Tildes editor: a passage list. For each passage, type the text WITHOUT
// accents, then click each vowel to toggle which ones should have a tilde.
// Live preview shows the corrected version.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { newPassage } from '../../core/contentModels/textCorrection.js';
import { applyMarks, isVowel } from '../../core/textMarks.js';
import { itemControlsHtml, reorderArray } from '../../core/editorPrimitives.js';
import { listSkins, skinPreviewHtml } from '../../core/skins.js';
import { listBackgrounds, backgroundPreviewHtml } from '../../core/backgrounds.js';

export function renderTildesEditor(root, activity, onChange) {
  const a = activity;
  if (!Array.isArray(a.content?.passages)) a.content = { passages: [newPassage()] };

  function commit() { onChange(a); paint(); }

  function paint() {
    mount(root, html`
      <div class="row g-2 mb-3">
        <div class="col-md-8"><label class="form-label small">Título</label><input class="form-control" id="f-title" value="${escapeHtml(a.title)}"></div>
        <div class="col-md-4"><label class="form-label small">Subtítulo</label><input class="form-control" id="f-subtitle" value="${escapeHtml(a.subtitle || '')}"></div>
      </div>

      <ul class="nav nav-tabs">
        <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-content">Frases</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-rules">Reglas</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-pres">Presentación</button></li>
      </ul>
      <div class="tab-content border border-top-0 p-3 rounded-bottom">
        <div class="tab-pane fade show active" id="tab-content">
          <p class="small text-muted">Escribe el texto SIN tildes. Después haz clic en cada vocal que debería llevar tilde.</p>
          ${a.content.passages.map((p, i) => renderPassage(p, i, a.content.passages.length)).join('')}
          <button class="btn btn-outline-primary mt-2" id="t-add"><i class="bi bi-plus-lg"></i> Añadir frase</button>
        </div>
        <div class="tab-pane fade" id="tab-rules">
          <div class="row g-3">
            <div class="col-md-4 form-check pt-4 ms-3"><input id="t-rand" class="form-check-input" type="checkbox" ${a.rules.randomize?'checked':''}><label class="form-check-label" for="t-rand">Mezclar frases</label></div>
            <div class="col-md-4 form-check pt-4"><input id="t-overflow" class="form-check-input" type="checkbox" ${a.rules.allowOverflow!==false?'checked':''}><label class="form-check-label" for="t-overflow">Tildes ilimitadas en la paleta</label></div>
            <div class="col-md-4"><label class="form-label">Puntos por acierto</label><input id="t-ppc" type="number" min="0" class="form-control" value="${a.scoring.pointsPerCorrect ?? 1}"></div>
            <div class="col-md-4"><label class="form-label">Puntos por error</label><input id="t-ppw" type="number" class="form-control" value="${a.scoring.pointsPerWrong ?? 0}"></div>
          </div>
        </div>
        <div class="tab-pane fade" id="tab-pres">${renderPresentation(a)}</div>
      </div>
    `);

    on(root, 'input', '#f-title', e => { a.title = e.target.value; onChange(a); });
    on(root, 'input', '#f-subtitle', e => { a.subtitle = e.target.value; onChange(a); });
    on(root, 'input', '.tp-text', (e, el) => {
      const idx = +el.dataset.i;
      const newText = e.target.value;
      const old = a.content.passages[idx];
      // If text shortens, drop marks past the new end.
      old.text = newText;
      old.marks = (old.marks || []).filter(m => m.pos < newText.length && isVowel(newText[m.pos]));
      onChange(a);
      paint();
    });
    on(root, 'click', '.tp-vowel', (_, el) => {
      const i = +el.dataset.i, pos = +el.dataset.pos;
      const p = a.content.passages[i];
      const exists = p.marks?.find(m => m.pos === pos && m.kind === 'tilde');
      if (exists) p.marks = p.marks.filter(m => !(m.pos === pos && m.kind === 'tilde'));
      else (p.marks ||= []).push({ pos, kind: 'tilde' });
      commit();
    });
    on(root, 'click', '#t-add', () => { a.content.passages.push(newPassage()); commit(); });
    on(root, 'click', '.item-del',  (_, b) => { a.content.passages.splice(+b.dataset.i, 1); commit(); });
    on(root, 'click', '.item-up',   (_, b) => { reorderArray(a.content.passages, +b.dataset.i, -1); commit(); });
    on(root, 'click', '.item-down', (_, b) => { reorderArray(a.content.passages, +b.dataset.i, +1); commit(); });

    on(root, 'change', '#t-rand', e => { a.rules.randomize = e.target.checked; onChange(a); });
    on(root, 'change', '#t-overflow', e => { a.rules.allowOverflow = e.target.checked; onChange(a); });
    on(root, 'input', '#t-ppc', e => { a.scoring.pointsPerCorrect = +e.target.value || 0; onChange(a); });
    on(root, 'input', '#t-ppw', e => { a.scoring.pointsPerWrong = +e.target.value || 0; onChange(a); });

    on(root, 'click', '.skin-pick', (_, b) => { a.presentation.skin = b.dataset.name; onChange(a); paint(); });
    on(root, 'click', '.bg-pick',   (_, b) => { a.presentation.background = b.dataset.name; onChange(a); paint(); });
  }

  function renderPassage(p, i, total) {
    const expected = new Set((p.marks || []).filter(m => m.kind === 'tilde').map(m => m.pos));
    const preview = applyMarks(p.text, p.marks || []);
    return `
      <div class="card mb-3"><div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="badge bg-secondary">Frase ${i + 1}</span>
          ${itemControlsHtml(i, total)}
        </div>
        <input class="form-control mb-2 tp-text" data-i="${i}" placeholder="Texto sin tildes" value="${escapeHtml(p.text)}">
        <div class="ww-tildes-edit-line fs-4 mb-2 user-select-none">
          ${[...p.text].map((ch, pos) => {
            if (isVowel(ch)) {
              const on = expected.has(pos);
              return `<span class="tp-vowel ${on?'is-tilded':''}" data-i="${i}" data-pos="${pos}" role="button" title="Click para alternar tilde">${escapeHtml(ch)}</span>`;
            }
            return ch === ' ' ? '&nbsp;' : escapeHtml(ch);
          }).join('')}
        </div>
        <div class="small text-muted">Vista previa: <b>${escapeHtml(preview)}</b></div>
      </div></div>`;
  }

  function renderPresentation(a) {
    const cs = a.presentation?.skin || 'default';
    const cb = a.presentation?.background || 'notebook';
    return `
      <h6 class="mb-2">Skin (colores y sonidos)</h6>
      <div class="d-flex flex-wrap gap-3 mb-4">
        ${listSkins().map(s => `
          <div class="ww-skin-tile skin-pick ${cs===s.name?'is-active':''}" data-name="${s.name}" role="button">
            ${skinPreviewHtml(s.name)}
            <div class="text-center small mt-1">${escapeHtml(s.description || '')}</div>
          </div>`).join('')}
      </div>
      <h6 class="mb-2">Fondo</h6>
      <div class="d-flex flex-wrap gap-3">
        ${listBackgrounds().map(b => `
          <div class="ww-skin-tile bg-pick ${cb===b.name?'is-active':''}" data-name="${b.name}" role="button" style="width:120px">
            ${backgroundPreviewHtml(b.name)}
            <div class="text-center small text-muted">${escapeHtml(b.description || '')}</div>
          </div>`).join('')}
      </div>`;
  }

  paint();
}
