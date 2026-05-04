import { BaseEditor } from './base.js';
import { html, escapeHtml, mount, $, $$ } from '../core/html.js';
import { on } from '../core/events.js';

export class QuizEditor extends BaseEditor {
  static template = 'quiz';

  static render(root, activity, onChange) {
    const a = activity;
    function commit() { onChange(a); paint(); }
    function paint() {
      mount(root, html`
        <div class="ww-editor">
          <div class="row g-2 mb-3">
            <div class="col-md-8">
              <label class="form-label small">Título</label>
              <input class="form-control" id="f-title" value="${escapeHtml(a.title)}">
            </div>
            <div class="col-md-4">
              <label class="form-label small">Subtítulo</label>
              <input class="form-control" id="f-subtitle" value="${escapeHtml(a.subtitle || '')}">
            </div>
          </div>

          <ul class="nav nav-tabs" role="tablist">
            <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-content">Contenido</button></li>
            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-rules">Reglas</button></li>
            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-scoring">Puntuación</button></li>
            <li class="nav-item">
              <button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-live">
                Live <span class="badge bg-warning text-dark ms-1">Fase 2</span>
              </button>
            </li>
          </ul>

          <div class="tab-content border border-top-0 p-3 rounded-bottom">
            <div class="tab-pane fade show active" id="tab-content">
              ${renderContent(a)}
              <button class="btn btn-outline-primary" id="add-item"><i class="bi bi-plus-lg"></i> Añadir pregunta</button>
            </div>
            <div class="tab-pane fade" id="tab-rules">${renderRules(a)}</div>
            <div class="tab-pane fade" id="tab-scoring">${renderScoring(a)}</div>
            <div class="tab-pane fade" id="tab-live">${renderLive(a)}</div>
          </div>
        </div>
      `);

      on(root, 'input', '#f-title', e => { a.title = e.target.value; onChange(a); });
      on(root, 'input', '#f-subtitle', e => { a.subtitle = e.target.value; onChange(a); });

      on(root, 'click', '#add-item', () => {
        a.content.items.push({ id: 'q_'+Math.random().toString(36).slice(2,8), question:'', answer:'', options:['','','',''], points:1 });
        commit();
      });
      on(root, 'click', '.del-item', (_, btn) => {
        a.content.items.splice(+btn.dataset.i, 1); commit();
      });
      on(root, 'input', '.it-q', (e, el) => { a.content.items[+el.dataset.i].question = e.target.value; onChange(a); });
      on(root, 'input', '.it-a', (e, el) => { a.content.items[+el.dataset.i].answer = e.target.value; onChange(a); });
      on(root, 'input', '.it-opt', (e, el) => {
        const i = +el.dataset.i, k = +el.dataset.k;
        a.content.items[i].options[k] = e.target.value; onChange(a);
      });
      on(root, 'input', '.it-pts', (e, el) => { a.content.items[+el.dataset.i].points = +e.target.value || 1; onChange(a); });

      // Rules
      on(root, 'change', '#f-rand', e => { a.rules.randomize = e.target.checked; onChange(a); });
      on(root, 'change', '#f-shuf', e => { a.rules.shuffleOptions = e.target.checked; onChange(a); });
      on(root, 'input', '#f-timer', e => { a.rules.timer = +e.target.value || 0; onChange(a); });
      // Scoring
      on(root, 'change', '#f-mode', e => { a.scoring.mode = e.target.value; onChange(a); });
      on(root, 'input', '#f-ppc', e => { a.scoring.pointsPerCorrect = +e.target.value || 1; onChange(a); });
      on(root, 'input', '#f-ppw', e => { a.scoring.pointsPerWrong = +e.target.value || 0; onChange(a); });
    }
    paint();
  }
}

function renderContent(a) {
  if (!a.content.items.length) return `<p class="text-muted">No hay preguntas todavía.</p>`;
  return a.content.items.map((it, i) => `
    <div class="card mb-2"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-secondary">#${i+1}</span>
        <button class="btn btn-sm btn-outline-danger del-item" data-i="${i}"><i class="bi bi-trash"></i></button>
      </div>
      <input class="form-control mb-2 it-q" data-i="${i}" placeholder="Pregunta" value="${escapeHtml(it.question)}">
      <div class="row g-2 mb-2">
        ${(it.options||['','','','']).map((o,k)=>`<div class="col-6"><input class="form-control it-opt" data-i="${i}" data-k="${k}" placeholder="Opción ${k+1}" value="${escapeHtml(o)}"></div>`).join('')}
      </div>
      <div class="row g-2">
        <div class="col-md-8"><input class="form-control it-a" data-i="${i}" placeholder="Respuesta correcta (texto exacto de una opción)" value="${escapeHtml(it.answer ?? '')}"></div>
        <div class="col-md-4"><input type="number" min="1" class="form-control it-pts" data-i="${i}" placeholder="Puntos" value="${it.points||1}"></div>
      </div>
    </div></div>
  `).join('');
}

function renderRules(a) {
  return `
    <div class="row g-3">
      <div class="col-md-4"><label class="form-label">Timer (s, 0=off)</label><input type="number" min="0" class="form-control" id="f-timer" value="${a.rules.timer||0}"></div>
      <div class="col-md-4 form-check pt-4"><input class="form-check-input" type="checkbox" id="f-rand" ${a.rules.randomize?'checked':''}><label class="form-check-label" for="f-rand">Orden aleatorio</label></div>
      <div class="col-md-4 form-check pt-4"><input class="form-check-input" type="checkbox" id="f-shuf" ${a.rules.shuffleOptions?'checked':''}><label class="form-check-label" for="f-shuf">Mezclar opciones</label></div>
    </div>`;
}

function renderScoring(a) {
  return `
    <div class="row g-3">
      <div class="col-md-4"><label class="form-label">Modo</label>
        <select class="form-select" id="f-mode">
          <option value="flat" ${a.scoring.mode==='flat'?'selected':''}>Plano</option>
          <option value="kahoot" ${a.scoring.mode==='kahoot'?'selected':''}>Kahoot (bonus por velocidad)</option>
        </select></div>
      <div class="col-md-4"><label class="form-label">Puntos por acierto</label><input type="number" class="form-control" id="f-ppc" value="${a.scoring.pointsPerCorrect}"></div>
      <div class="col-md-4"><label class="form-label">Puntos por error</label><input type="number" class="form-control" id="f-ppw" value="${a.scoring.pointsPerWrong}"></div>
    </div>`;
}

function renderLive(a) {
  // All controls disabled (Fase 2). Values still persisted via the shared
  // activity object, so they survive when Fase 2 enables this tab.
  const d = 'disabled';
  return `
    <div class="alert alert-warning"><i class="bi bi-info-circle"></i> Estos ajustes se activan en Fase 2 (modo Live).</div>
    <div class="row g-3">
      <div class="col-md-4"><label class="form-label">Modo de avance</label>
        <select class="form-select" ${d}>
          <option ${a.live.advanceMode==='manual'?'selected':''}>manual</option>
          <option ${a.live.advanceMode==='autoOnAllAnswered'?'selected':''}>autoOnAllAnswered</option>
          <option ${a.live.advanceMode==='autoOnTimer'?'selected':''}>autoOnTimer</option>
        </select></div>
      <div class="col-md-4"><label class="form-label">Timer pregunta (s)</label><input ${d} type="number" class="form-control" value="${a.live.questionTimer}"></div>
      <div class="col-md-4"><label class="form-label">Bloquear respuestas</label>
        <select class="form-select" ${d}>
          <option ${a.live.lockAnswersOn==='firstOf'?'selected':''}>firstOf</option>
          <option ${a.live.lockAnswersOn==='timer'?'selected':''}>timer</option>
          <option ${a.live.lockAnswersOn==='allAnswered'?'selected':''}>allAnswered</option>
        </select></div>
      <div class="col-md-4"><label class="form-label">Modelo de puntos</label>
        <select class="form-select" ${d}>
          <option ${a.live.pointsModel==='kahoot'?'selected':''}>kahoot</option>
          <option ${a.live.pointsModel==='flat'?'selected':''}>flat</option>
        </select></div>
      <div class="col-md-4"><label class="form-label">Speed bonus máx</label><input ${d} type="number" class="form-control" value="${a.live.speedBonusMax}"></div>
      <div class="col-md-4"><label class="form-label">Máx. jugadores</label><input ${d} type="number" class="form-control" value="${a.live.maxPlayers}"></div>
      <div class="col-md-4 form-check pt-4"><input ${d} class="form-check-input" type="checkbox" ${a.live.allowLateJoin?'checked':''}><label class="form-check-label">Permitir unirse tarde</label></div>
      <div class="col-md-4 form-check pt-4"><input ${d} class="form-check-input" type="checkbox" ${a.live.showAnswerAfterEach?'checked':''}><label class="form-check-label">Mostrar respuesta tras cada</label></div>
      <div class="col-md-4 form-check pt-4"><input ${d} class="form-check-input" type="checkbox" ${a.live.showLeaderboardBetween?'checked':''}><label class="form-check-label">Leaderboard entre preguntas</label></div>
      <div class="col-md-4 form-check pt-4"><input ${d} class="form-check-input" type="checkbox" ${a.live.nicknameFilter?'checked':''}><label class="form-check-label">Filtro de apodos</label></div>
    </div>`;
}
