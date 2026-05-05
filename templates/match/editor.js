import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { newPair } from '../../core/contentModels/pairs.js';

export function renderMatchEditor(root, activity, onChange) {
  const a = activity;
  if (!Array.isArray(a.content?.pairs)) a.content = { pairs: [newPair(), newPair()] };

  function paint() {
    mount(root, html`
      <div class="row g-2 mb-3">
        <div class="col-md-8"><label class="form-label small">Título</label><input class="form-control" id="f-title" value="${escapeHtml(a.title)}"></div>
        <div class="col-md-4"><label class="form-label small">Subtítulo</label><input class="form-control" id="f-subtitle" value="${escapeHtml(a.subtitle || '')}"></div>
      </div>

      <ul class="nav nav-tabs">
        <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-content">Pares</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-rules">Reglas</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-scoring">Puntuación</button></li>
      </ul>
      <div class="tab-content border border-top-0 p-3 rounded-bottom">
        <div class="tab-pane fade show active" id="tab-content">
          <div class="row g-2 mb-2 fw-bold small text-muted">
            <div class="col-5">Izquierda</div>
            <div class="col-5">Derecha</div>
            <div class="col-2"></div>
          </div>
          ${a.content.pairs.map((p, i) => `
            <div class="row g-2 mb-2">
              <div class="col-5"><input class="form-control mp-l" data-i="${i}" placeholder="Pareja ${i+1} izq" value="${escapeHtml(p.left || '')}"></div>
              <div class="col-5"><input class="form-control mp-r" data-i="${i}" placeholder="Pareja ${i+1} der" value="${escapeHtml(p.right || '')}"></div>
              <div class="col-2"><button class="btn btn-outline-danger w-100 mp-del" data-i="${i}"><i class="bi bi-x"></i></button></div>
            </div>
          `).join('')}
          <button class="btn btn-outline-primary mt-2" id="mp-add"><i class="bi bi-plus-lg"></i> Añadir par</button>
        </div>
        <div class="tab-pane fade" id="tab-rules">
          <div class="row g-3">
            <div class="col-md-4 form-check pt-4 ms-3"><input class="form-check-input" type="checkbox" id="m-rand" ${a.rules.randomize?'checked':''}><label class="form-check-label" for="m-rand">Mezclar columnas</label></div>
            <div class="col-md-4"><label class="form-label">Timer (s, 0=off)</label><input id="m-timer" type="number" min="0" class="form-control" value="${a.rules.timer||0}"></div>
          </div>
        </div>
        <div class="tab-pane fade" id="tab-scoring">
          <div class="row g-3">
            <div class="col-md-4"><label class="form-label">Puntos por acierto</label><input id="m-ppc" type="number" min="0" class="form-control" value="${a.scoring.pointsPerCorrect ?? 1}"></div>
            <div class="col-md-4"><label class="form-label">Puntos por error</label><input id="m-ppw" type="number" class="form-control" value="${a.scoring.pointsPerWrong ?? 0}"></div>
          </div>
        </div>
      </div>
    `);

    on(root, 'input', '#f-title', e => { a.title = e.target.value; onChange(a); });
    on(root, 'input', '#f-subtitle', e => { a.subtitle = e.target.value; onChange(a); });
    on(root, 'input', '.mp-l', (e, el) => { a.content.pairs[+el.dataset.i].left = e.target.value; onChange(a); });
    on(root, 'input', '.mp-r', (e, el) => { a.content.pairs[+el.dataset.i].right = e.target.value; onChange(a); });
    on(root, 'click', '.mp-del', (_, b) => { a.content.pairs.splice(+b.dataset.i, 1); onChange(a); paint(); });
    on(root, 'click', '#mp-add', () => { a.content.pairs.push(newPair()); onChange(a); paint(); });
    on(root, 'change', '#m-rand', e => { a.rules.randomize = e.target.checked; onChange(a); });
    on(root, 'input', '#m-timer', e => { a.rules.timer = +e.target.value || 0; onChange(a); });
    on(root, 'input', '#m-ppc', e => { a.scoring.pointsPerCorrect = +e.target.value || 0; onChange(a); });
    on(root, 'input', '#m-ppw', e => { a.scoring.pointsPerWrong = +e.target.value || 0; onChange(a); });
  }
  paint();
}
