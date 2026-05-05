import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';

export function renderWheelEditor(root, activity, onChange) {
  const a = activity;
  if (!Array.isArray(a.content?.entries)) a.content = { entries: ['','','',''] };

  function paint() {
    mount(root, html`
      <div class="row g-2 mb-3">
        <div class="col-md-8"><label class="form-label small">Título</label><input class="form-control" id="f-title" value="${escapeHtml(a.title)}"></div>
        <div class="col-md-4"><label class="form-label small">Subtítulo</label><input class="form-control" id="f-subtitle" value="${escapeHtml(a.subtitle || '')}"></div>
      </div>

      <ul class="nav nav-tabs">
        <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-content">Entradas</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-rules">Reglas</button></li>
      </ul>
      <div class="tab-content border border-top-0 p-3 rounded-bottom">
        <div class="tab-pane fade show active" id="tab-content">
          <div class="row g-2">
            ${a.content.entries.map((e, i) => `
              <div class="col-md-6 d-flex gap-2">
                <input class="form-control we-entry" data-i="${i}" placeholder="Entrada ${i+1}" value="${escapeHtml(e)}">
                <button class="btn btn-outline-danger we-del" data-i="${i}"><i class="bi bi-x"></i></button>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-outline-primary mt-3" id="we-add"><i class="bi bi-plus-lg"></i> Añadir</button>
        </div>
        <div class="tab-pane fade" id="tab-rules">
          <div class="row g-3">
            <div class="col-md-4"><label class="form-label">Duración del giro (ms)</label><input id="we-dur" type="number" min="500" max="20000" class="form-control" value="${a.rules.spinDurationMs ?? 4000}"></div>
            <div class="col-md-4 form-check pt-4"><input class="form-check-input" type="checkbox" id="we-rm" ${a.rules.removeAfterSpin?'checked':''}><label class="form-check-label" for="we-rm">Quitar tras girar</label></div>
          </div>
        </div>
      </div>
    `);
    on(root, 'input', '#f-title', e => { a.title = e.target.value; onChange(a); });
    on(root, 'input', '#f-subtitle', e => { a.subtitle = e.target.value; onChange(a); });
    on(root, 'input', '.we-entry', (e, el) => { a.content.entries[+el.dataset.i] = e.target.value; onChange(a); });
    on(root, 'click', '.we-del', (_, b) => { a.content.entries.splice(+b.dataset.i, 1); onChange(a); paint(); });
    on(root, 'click', '#we-add', () => { a.content.entries.push(''); onChange(a); paint(); });
    on(root, 'input', '#we-dur', e => { a.rules.spinDurationMs = +e.target.value || 4000; onChange(a); });
    on(root, 'change', '#we-rm', e => { a.rules.removeAfterSpin = e.target.checked; onChange(a); });
  }
  paint();
}
