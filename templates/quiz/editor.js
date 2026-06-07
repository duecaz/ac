// Editor for the quiz template. 4 tabs: Contenido / Reglas / Puntuación / Live.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { renderImagePicker, attachImagePicker } from '../../core/imagePicker.js';
import { listSkins, skinPreviewHtml } from '../../core/skins.js';
import { listBackgrounds, backgroundPreviewHtml } from '../../core/backgrounds.js';
import { itemControlsHtml, reorderArray } from '../../core/editorPrimitives.js';

export function renderQuizEditor(root, activity, onChange) {
  const a = activity;
  function commit() { onChange(a); paint(); }

  function paint() {
    mount(root, html`
      <div class="ww-editor">
        <div class="row g-2 mb-3">
          <div class="col-md-8"><label class="form-label small">Título</label><input class="form-control" id="f-title" value="${escapeHtml(a.title)}"></div>
          <div class="col-md-4"><label class="form-label small">Subtítulo</label><input class="form-control" id="f-subtitle" value="${escapeHtml(a.subtitle || '')}"></div>
        </div>

        <ul class="nav nav-tabs" role="tablist">
          <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-content">Contenido</button></li>
          <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-rules">Reglas</button></li>
          <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-scoring">Puntuación</button></li>
          <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-live">Live <i class="bi bi-broadcast"></i></button></li>
          <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-pres">Presentación <i class="bi bi-palette"></i></button></li>
        </ul>

        <div class="tab-content border border-top-0 p-3 rounded-bottom">
          <div class="tab-pane fade show active" id="tab-content">
            ${renderItems(a)}
            <div class="d-flex gap-2 flex-wrap">
              <button class="btn btn-outline-primary" id="add-item"><i class="bi bi-plus-lg"></i> Añadir pregunta</button>
              <button class="btn btn-outline-secondary" id="add-tf"><i class="bi bi-check2-square"></i> + Verdadero/Falso</button>
            </div>
          </div>
          <div class="tab-pane fade" id="tab-rules">${renderRules(a)}</div>
          <div class="tab-pane fade" id="tab-scoring">${renderScoring(a)}</div>
          <div class="tab-pane fade" id="tab-live">${renderLive(a)}</div>
          <div class="tab-pane fade" id="tab-pres">${renderPresentation(a)}</div>
        </div>
      </div>
    `);

    on(root, 'input', '#f-title', e => { a.title = e.target.value; onChange(a); });
    on(root, 'input', '#f-subtitle', e => { a.subtitle = e.target.value; onChange(a); });
    on(root, 'click', '#add-item', () => {
      a.content.items.push({ id:'q_'+Math.random().toString(36).slice(2,8), question:'', answer:'', options:['','','',''], points:1, image:null, audio:null });
      commit();
    });
    on(root, 'click', '#add-tf', () => {
      a.content.items.push({ id:'q_'+Math.random().toString(36).slice(2,8), question:'', answer:'Verdadero', options:['Verdadero','Falso'], points:1, image:null, audio:null, kind: 'truefalse' });
      commit();
    });
    on(root, 'click', '.item-del', (_, btn) => { a.content.items.splice(+btn.dataset.i, 1); commit(); });
    on(root, 'click', '.item-up',  (_, btn) => { reorderArray(a.content.items, +btn.dataset.i, -1); commit(); });
    on(root, 'click', '.item-down',(_, btn) => { reorderArray(a.content.items, +btn.dataset.i, +1); commit(); });
    on(root, 'input', '.it-q', (e, el) => { a.content.items[+el.dataset.i].question = e.target.value; onChange(a); });
    on(root, 'input', '.it-opt', (e, el) => {
      const i = +el.dataset.i, k = +el.dataset.k, item = a.content.items[i];
      item.options[k] = e.target.value;
      syncAnswerFromIdx(item); // refresh answer text from the correct indices
      onChange(a);
    });
    // Toggle an option correct BY INDEX (so duplicate/empty option texts don't
    // mark each other). The answer text is derived from the chosen indices for
    // the scorer/player: one correct → string, several → array.
    on(root, 'click', '.it-correct', (_, el) => {
      const i = +el.dataset.i, k = +el.dataset.k, item = a.content.items[i];
      const set = correctIdxSet(item);
      if (set.has(k)) set.delete(k); else set.add(k);
      item.answerIdx = [...set].sort((x, y) => x - y);
      syncAnswerFromIdx(item);
      commit(); // repaint so the green highlight follows the selection
    });
    on(root, 'input', '.it-pts', (e, el) => {
      a.content.items[+el.dataset.i].points = +e.target.value || 1;
      // Toggle the "uneven points" warning live without repainting (keeps focus).
      root.querySelector('#pts-warn')?.classList.toggle('d-none', !pointsAreUneven(a));
      onChange(a);
    });

    // Image pickers per item.
    a.content.items.forEach((item, i) => {
      attachImagePicker(root, `#img-${i}`, item.image, (url) => { item.image = url; onChange(a); });
    });

    // Rules
    on(root, 'change', '#f-rand', e => { a.rules.randomize = e.target.checked; onChange(a); });
    on(root, 'change', '#f-shuf', e => { a.rules.shuffleOptions = e.target.checked; onChange(a); });
    on(root, 'input', '#f-timer', e => { a.rules.timer = +e.target.value || 0; onChange(a); });
    // Scoring
    on(root, 'change', '#f-mode', e => { a.scoring.mode = e.target.value; onChange(a); });
    on(root, 'input', '#f-ppc', e => { a.scoring.pointsPerCorrect = +e.target.value || 1; onChange(a); });
    on(root, 'input', '#f-ppw', e => { a.scoring.pointsPerWrong = +e.target.value || 0; onChange(a); });
    // Live
    on(root, 'change', '#l-advance', e => { a.live.advanceMode = e.target.value; onChange(a); });
    on(root, 'input', '#l-qtimer', e => { a.live.questionTimer = +e.target.value || 20; onChange(a); });
    on(root, 'change', '#l-lock', e => { a.live.lockAnswersOn = e.target.value; onChange(a); });
    on(root, 'change', '#l-points', e => { a.live.pointsModel = e.target.value; onChange(a); });
    on(root, 'input', '#l-bonus', e => { a.live.speedBonusMax = +e.target.value || 0; onChange(a); });
    on(root, 'input', '#l-max', e => { a.live.maxPlayers = +e.target.value || 60; onChange(a); });
    on(root, 'change', '#l-late', e => { a.live.allowLateJoin = e.target.checked; onChange(a); });
    on(root, 'change', '#l-after', e => { a.live.showAnswerAfterEach = e.target.checked; onChange(a); });
    on(root, 'change', '#l-lb', e => { a.live.showLeaderboardBetween = e.target.checked; onChange(a); });
    on(root, 'change', '#l-nick', e => { a.live.nicknameFilter = e.target.checked; onChange(a); });
    on(root, 'change', '#l-streak', e => { a.live.streakBonus = e.target.checked; onChange(a); });
    on(root, 'input', '#l-streak-step', e => { a.live.streakBonusPerStep = +e.target.value || 0; onChange(a); });
    // Presentation: skin picker.
    on(root, 'click', '.skin-pick', (_, b) => {
      a.presentation.skin = b.dataset.name;
      onChange(a);
      paint();
    });
    on(root, 'click', '.bg-pick', (_, b) => {
      a.presentation.background = b.dataset.name;
      onChange(a);
      paint();
    });
  }
  paint();
}

// Are all per-question points equal? Unequal points unbalance turn-based Teams.
function pointsAreUneven(a) {
  return new Set((a.content.items || []).map(it => it.points || 1)).size > 1;
}

function pointsWarningHtml(a) {
  return `<div id="pts-warn" class="alert alert-danger d-flex align-items-start gap-2 py-2 mb-2 ${pointsAreUneven(a) ? '' : 'd-none'}" role="alert">
    <i class="bi bi-exclamation-triangle-fill"></i>
    <div><b>No recomendado:</b> tus preguntas tienen <b>puntos distintos</b>. En el modo
    <b>Equipos</b> (por turnos) cada equipo responde preguntas diferentes, así que valores
    desiguales hacen que gane quien tuvo la pregunta más valiosa, no quien más sabe.
    Usa los mismos puntos en todas salvo que sea intencional.</div>
  </div>`;
}

// Which option INDICES are correct. Source of truth in the editor is
// `item.answerIdx` (a list of indices); if absent (older activities) we derive
// it from the answer text — but indices avoid the duplicate/empty-text trap
// where marking one option highlighted another with the same text.
function correctIdxSet(it) {
  if (Array.isArray(it.answerIdx)) {
    return new Set(it.answerIdx.filter(k => k >= 0 && k < (it.options || []).length));
  }
  const ans = it.answer;
  const set = new Set();
  (it.options || []).forEach((o, k) => {
    const match = Array.isArray(ans) ? ans.includes(o) : (ans != null && ans !== '' && ans === o);
    if (match) set.add(k);
  });
  return set;
}

// Rebuild the scorer-facing answer (text|array) from the correct indices.
function syncAnswerFromIdx(it) {
  const idxs = [...correctIdxSet(it)].sort((a, b) => a - b);
  it.answerIdx = idxs;
  const texts = idxs.map(k => it.options[k]);
  it.answer = texts.length === 0 ? '' : (texts.length === 1 ? texts[0] : texts);
}

function renderItems(a) {
  if (!a.content.items.length) return `<p class="text-muted">No hay preguntas todavía.</p>`;
  const total = a.content.items.length;
  return pointsWarningHtml(a) + a.content.items.map((it, i) => `
    <div class="card mb-2"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-secondary">#${i+1}${it.kind==='truefalse'?' · V/F':''}</span>
        ${itemControlsHtml(i, total)}
      </div>
      <input class="form-control mb-2 it-q" data-i="${i}" placeholder="Pregunta" value="${escapeHtml(it.question)}">
      <div class="form-text mb-1"><i class="bi bi-check-circle text-success"></i> Toca el botón de una opción para marcarla correcta (verde). Tócalo de nuevo para quitarla.</div>
      <div class="row g-2 mb-2">
        <div class="col-md-8">
          <div class="row g-2">
            ${(() => { const cset = correctIdxSet(it); return (it.options||['','','','']).map((o,k)=>{
              const corr = cset.has(k);
              return `<div class="col-12 col-md-6"><div class="input-group">
                <button type="button" class="btn it-correct ${corr?'btn-success':'btn-outline-secondary'}" data-i="${i}" data-k="${k}" title="Marcar/quitar como correcta" aria-pressed="${corr}">
                  <i class="bi ${corr?'bi-check-circle-fill':'bi-circle'}"></i>
                </button>
                <input class="form-control it-opt ${corr?'border-success bg-success-subtle fw-semibold':''}" data-i="${i}" data-k="${k}" placeholder="Opción ${k+1}" value="${escapeHtml(o)}">
              </div></div>`;
            }).join(''); })()}
          </div>
        </div>
        <div class="col-md-4">
          <div id="img-${i}">${renderImagePicker(it.image)}</div>
        </div>
      </div>
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <button class="btn btn-sm btn-link text-muted p-0 text-decoration-none" type="button" data-bs-toggle="collapse" data-bs-target="#adv-${i}">
          <i class="bi bi-sliders"></i> Avanzado
        </button>
        <div class="collapse" id="adv-${i}">
          <div class="d-flex align-items-center gap-2">
            <label class="form-label small text-muted mb-0">Puntos</label>
            <input type="number" min="1" class="form-control form-control-sm it-pts" style="width:5rem" data-i="${i}" value="${it.points||1}">
          </div>
        </div>
      </div>
    </div></div>
  `).join('');
}

function renderRules(a) {
  return `<div class="row g-3">
    <div class="col-md-4"><label class="form-label">Timer (s, 0=off)</label><input type="number" min="0" class="form-control" id="f-timer" value="${a.rules.timer||0}"></div>
    <div class="col-md-4 form-check pt-4"><input class="form-check-input" type="checkbox" id="f-rand" ${a.rules.randomize?'checked':''}><label class="form-check-label" for="f-rand">Orden aleatorio</label></div>
    <div class="col-md-4 form-check pt-4"><input class="form-check-input" type="checkbox" id="f-shuf" ${a.rules.shuffleOptions?'checked':''}><label class="form-check-label" for="f-shuf">Mezclar opciones</label></div>
  </div>`;
}

function renderScoring(a) {
  return `<div class="row g-3">
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
  return `<div class="row g-3">
    <div class="col-md-4"><label class="form-label">Modo de avance</label>
      <select class="form-select" id="l-advance">
        <option value="manual" ${a.live.advanceMode==='manual'?'selected':''}>manual</option>
        <option value="autoOnAllAnswered" ${a.live.advanceMode==='autoOnAllAnswered'?'selected':''}>autoOnAllAnswered</option>
        <option value="autoOnTimer" ${a.live.advanceMode==='autoOnTimer'?'selected':''}>autoOnTimer</option>
      </select></div>
    <div class="col-md-4"><label class="form-label">Timer pregunta (s)</label><input id="l-qtimer" type="number" min="5" max="300" class="form-control" value="${a.live.questionTimer}"></div>
    <div class="col-md-4"><label class="form-label">Bloquear respuestas</label>
      <select class="form-select" id="l-lock">
        <option value="firstOf" ${a.live.lockAnswersOn==='firstOf'?'selected':''}>firstOf</option>
        <option value="timer" ${a.live.lockAnswersOn==='timer'?'selected':''}>timer</option>
        <option value="allAnswered" ${a.live.lockAnswersOn==='allAnswered'?'selected':''}>allAnswered</option>
      </select></div>
    <div class="col-md-4"><label class="form-label">Modelo de puntos</label>
      <select class="form-select" id="l-points">
        <option value="kahoot" ${a.live.pointsModel==='kahoot'?'selected':''}>kahoot</option>
        <option value="flat" ${a.live.pointsModel==='flat'?'selected':''}>flat</option>
      </select></div>
    <div class="col-md-4"><label class="form-label">Speed bonus máx</label><input id="l-bonus" type="number" min="0" class="form-control" value="${a.live.speedBonusMax}"></div>
    <div class="col-md-4"><label class="form-label">Máx. jugadores</label><input id="l-max" type="number" min="1" max="500" class="form-control" value="${a.live.maxPlayers}"></div>
    <div class="col-md-4 form-check pt-4"><input id="l-late" class="form-check-input" type="checkbox" ${a.live.allowLateJoin?'checked':''}><label class="form-check-label" for="l-late">Permitir unirse tarde</label></div>
    <div class="col-md-4 form-check pt-4"><input id="l-after" class="form-check-input" type="checkbox" ${a.live.showAnswerAfterEach?'checked':''}><label class="form-check-label" for="l-after">Mostrar respuesta tras cada</label></div>
    <div class="col-md-4 form-check pt-4"><input id="l-lb" class="form-check-input" type="checkbox" ${a.live.showLeaderboardBetween?'checked':''}><label class="form-check-label" for="l-lb">Leaderboard entre preguntas</label></div>
    <div class="col-md-4 form-check pt-4"><input id="l-nick" class="form-check-input" type="checkbox" ${a.live.nicknameFilter?'checked':''}><label class="form-check-label" for="l-nick">Filtro de apodos</label></div>
    <div class="col-md-12">
      <hr>
      <div class="form-check"><input id="l-streak" class="form-check-input" type="checkbox" ${a.live.streakBonus?'checked':''}><label class="form-check-label" for="l-streak"><b>Bonus por racha</b> — suma puntos extra por aciertos consecutivos</label></div>
      <div class="row mt-2"><div class="col-md-4"><label class="form-label small">Puntos extra por paso de racha</label><input id="l-streak-step" type="number" min="0" max="500" class="form-control form-control-sm" value="${a.live.streakBonusPerStep ?? 50}"></div></div>
      <small class="text-muted d-block mt-1">Ej: con paso 50, una racha de 3 aciertos seguidos da +50 al 2º, +100 al 3º.</small>
    </div>
  </div>`;
}

function renderPresentation(a) {
  const currentSkin = a.presentation?.skin || 'default';
  const currentBg = a.presentation?.background || 'none';
  const skins = listSkins();
  const bgs = listBackgrounds();
  return `
    <h6 class="mb-2">Skin (colores y sonidos)</h6>
    <div class="d-flex flex-wrap gap-3 mb-4">
      ${skins.map(s => `
        <div class="ww-skin-tile skin-pick ${currentSkin===s.name?'is-active':''}" data-name="${s.name}" role="button">
          ${skinPreviewHtml(s.name)}
          <div class="text-center small mt-1">${escapeHtml(s.description || '')}</div>
        </div>
      `).join('')}
    </div>
    <h6 class="mb-2">Fondo</h6>
    <div class="d-flex flex-wrap gap-3">
      ${bgs.map(b => `
        <div class="ww-skin-tile bg-pick ${currentBg===b.name?'is-active':''}" data-name="${b.name}" role="button" style="width:120px">
          ${backgroundPreviewHtml(b.name)}
          <div class="text-center small text-muted">${escapeHtml(b.description || '')}</div>
        </div>
      `).join('')}
    </div>
  `;
}
