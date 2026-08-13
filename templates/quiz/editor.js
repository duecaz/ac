// Editor del quiz. Solo aporta sus paneles (Contenido/Individual/Puntuación/En
// vivo); el chasis (título, pestañas, Modos, Presentación) lo pone el shell
// compartido (core/editorShell.js).
import { html, escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { renderImagePicker, attachImagePicker } from '../../core/imagePicker.js';
import { itemControlsHtml, reorderArray, ruleScopeNote, itemSecondsFieldHtml, wireItemSeconds } from '../../core/editorPrimitives.js';
import { rid } from '../../core/ids.js';
import { renderEditorShell } from '../../core/editorShell.js';

export function renderQuizEditor(root, activity, onChange) {
  const a = activity;
  // Auto-cura ítems sin opciones (p. ej. convertidos desde Matemáticas) para que
  // el editor no falle al escribir en item.options[k].
  // El editor no puede reventar con el contenido vacío: lo produce una actividad
  // recién creada y también un JSON importado a medias. Antes `renderItems`
  // leía `a.content.items.length` y lanzaba antes de pintar nada.
  if (!a.content || typeof a.content !== 'object') a.content = {};
  if (!Array.isArray(a.content.items)) a.content.items = [];
  a.content.items.forEach(it => { if (!Array.isArray(it.options)) it.options = ['', '', '', '']; });
  renderEditorShell(root, a, onChange, {
    content: { label: 'Contenido', html: contentHtml, wire: wireContent },
    rules: { html: rulesHtml, wire: wireRules },
    // Puntuación y En vivo ya NO los declara la plantilla: son los paneles por
    // defecto del chasis (core/editorPanels.js) y ahora los tienen las 13, no
    // solo Quiz. Salieron literalmente de aquí.
  });
}

// ── Contenido ──
function contentHtml(a) {
  return `
    ${renderItems(a)}
    <div class="d-flex gap-2 flex-wrap">
      <button class="btn btn-outline-primary" id="add-item"><i class="bi bi-plus-lg"></i> Añadir pregunta</button>
      <button class="btn btn-outline-secondary" id="add-tf"><i class="bi bi-check2-square"></i> + Verdadero/Falso</button>
    </div>`;
}

function wireContent(root, a, ctx) {
  on(root, 'click', '#add-item', () => {
    a.content.items.push({ id: rid('q_'), question: '', answer: '', options: ['', '', '', ''], points: 1, image: null, audio: null });
    ctx.onChange(a); ctx.repaint();
  });
  on(root, 'click', '#add-tf', () => {
    a.content.items.push({ id: rid('q_'), question: '', answer: 'Verdadero', options: ['Verdadero', 'Falso'], points: 1, image: null, audio: null, kind: 'truefalse' });
    ctx.onChange(a); ctx.repaint();
  });
  on(root, 'click', '.item-del', (_, btn) => { a.content.items.splice(+btn.dataset.i, 1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-up', (_, btn) => { reorderArray(a.content.items, +btn.dataset.i, -1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-down', (_, btn) => { reorderArray(a.content.items, +btn.dataset.i, +1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'input', '.it-q', (e, el) => { a.content.items[+el.dataset.i].question = e.target.value; ctx.onChange(a); });
  on(root, 'input', '.it-opt', (e, el) => {
    const i = +el.dataset.i, k = +el.dataset.k, item = a.content.items[i];
    setOptionText(item, k, e.target.value);
    // Si al reescribir el texto la pregunta se quedó SIN respuesta correcta, el
    // aviso aparece al instante (no al terminar la partida).
    root.querySelector('#ans-warn')?.classList.toggle('d-none', !someItemHasNoAnswer(a));
    ctx.onChange(a);
  });
  // Toggle an option correct BY INDEX (duplicate/empty texts don't collide).
  on(root, 'click', '.it-correct', (_, el) => {
    const i = +el.dataset.i, k = +el.dataset.k, item = a.content.items[i];
    const set = correctIdxSet(item);
    if (set.has(k)) set.delete(k); else set.add(k);
    item.answerIdx = [...set].sort((x, y) => x - y);
    syncAnswerFromIdx(item);
    ctx.onChange(a); ctx.repaint();
  });
  wireItemSeconds(root, a, ctx, a.content.items);   // R-3 · tiempo por pregunta
  on(root, 'input', '.it-pts', (e, el) => {
    a.content.items[+el.dataset.i].points = +e.target.value || 1;
    root.querySelector('#pts-warn')?.classList.toggle('d-none', !pointsAreUneven(a));
    ctx.onChange(a);
  });
  a.content.items.forEach((item, i) => {
    attachImagePicker(root, `#img-${i}`, item.image, (url) => { item.image = url; ctx.onChange(a); });
  });
}

// ── Individual (reglas) ──
function rulesHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-4"><label class="form-label">Timer (s, 0=off)</label><input type="number" min="0" class="form-control" id="f-timer" value="${a.rules.timer || 0}"></div>
    <div class="col-md-4 form-check pt-4"><input class="form-check-input" type="checkbox" id="f-rand" ${a.rules.randomize ? 'checked' : ''}><label class="form-check-label" for="f-rand">Orden aleatorio</label></div>
    <div class="col-12">${ruleScopeNote()}</div>
    <div class="col-md-4 form-check pt-4"><input class="form-check-input" type="checkbox" id="f-shuf" ${a.rules.shuffleOptions ? 'checked' : ''}><label class="form-check-label" for="f-shuf">Mezclar opciones</label></div>
  </div>`;
}
function wireRules(root, a, ctx) {
  on(root, 'change', '#f-rand', e => { a.rules.randomize = e.target.checked; ctx.onChange(a); });
  on(root, 'change', '#f-shuf', e => { a.rules.shuffleOptions = e.target.checked; ctx.onChange(a); });
  on(root, 'input', '#f-timer', e => { a.rules.timer = +e.target.value || 0; ctx.onChange(a); });
}



// ── helpers (sin cambios de lógica) ──
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
function syncAnswerFromIdx(it) {
  const idxs = [...correctIdxSet(it)].sort((a, b) => a - b);
  it.answerIdx = idxs;
  const texts = idxs.map(k => it.options[k]);
  it.answer = texts.length === 0 ? '' : (texts.length === 1 ? texts[0] : texts);
}

/** Reescribe el TEXTO de una opción SIN perder cuál era la correcta.
 *
 *  El bug (VS/Live: "clico la correcta y me la da mala"): en un ítem heredado
 *  —sin `answerIdx`, que es como quedaron las actividades creadas antes de que
 *  existiera— la correcta se deducía comparando `answer` con el TEXTO de las
 *  opciones. Al corregir una errata en la opción correcta, el handler mutaba el
 *  texto PRIMERO y luego re-deducía: ya no coincidía con nada, así que la
 *  pregunta se quedaba con `answer: ''` — todas las respuestas malas para
 *  siempre, sin decir nada (el editor seguía pintando el verde hasta repintar).
 *
 *  Ahora se FIJA el índice correcto ANTES de tocar el texto: la marca vive en
 *  `answerIdx` (posición, no texto) y `answer` se re-deriva de ahí, así que
 *  editar el texto de la correcta la SIGUE. */
export function setOptionText(item, k, text) {
  const idxs = [...correctIdxSet(item)].sort((a, b) => a - b);  // ANTES de mutar
  item.answerIdx = idxs;
  item.options[k] = text;
  syncAnswerFromIdx(item);
  return item;
}

/** ¿Esta pregunta puede puntuarse? Sin correcta marcada, TODA respuesta cuenta
 *  como fallo — el modo de fallar silencioso que nadie ve hasta jugar. */
export function itemHasNoAnswer(it) {
  const ans = it?.answer;
  if (Array.isArray(ans)) return ans.filter(s => String(s ?? '').trim() !== '').length === 0;
  return String(ans ?? '').trim() === '';
}
export function someItemHasNoAnswer(a) {
  return (a?.content?.items || []).some(itemHasNoAnswer);
}

function answerWarningHtml(a) {
  return `<div id="ans-warn" class="alert alert-danger d-flex align-items-start gap-2 py-2 mb-2 ${someItemHasNoAnswer(a) ? '' : 'd-none'}" role="alert">
    <i class="bi bi-exclamation-octagon-fill"></i>
    <div><b>Hay preguntas SIN respuesta correcta marcada.</b> Están en rojo abajo.
    Tal como están, cualquier respuesta del alumno contará como fallo (en Individual,
    VS, Equipos y En vivo). Toca el botón de la opción correcta para marcarla en verde.</div>
  </div>`;
}
function renderItems(a) {
  if (!a.content.items.length) return `<p class="text-muted">No hay preguntas todavía.</p>`;
  const total = a.content.items.length;
  return answerWarningHtml(a) + pointsWarningHtml(a) + a.content.items.map((it, i) => `
    <div class="card mb-2 ${itemHasNoAnswer(it) ? 'border-danger' : ''}"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge ${itemHasNoAnswer(it) ? 'bg-danger' : 'bg-secondary'}">#${i + 1}${it.kind === 'truefalse' ? ' · V/F' : ''}</span>
        ${itemHasNoAnswer(it) ? '<span class="text-danger small"><i class="bi bi-exclamation-octagon-fill"></i> sin respuesta correcta</span>' : ''}
        ${itemControlsHtml(i, total)}
      </div>
      <input class="form-control mb-2 it-q" data-i="${i}" placeholder="Pregunta" value="${escapeHtml(it.question)}">
      <div class="form-text mb-1"><i class="bi bi-check-circle text-success"></i> Toca el botón de una opción para marcarla correcta (verde). Tócalo de nuevo para quitarla.</div>
      <div class="row g-2 mb-2">
        <div class="col-md-8">
          <div class="row g-2">
            ${(() => { const cset = correctIdxSet(it); return (it.options || ['', '', '', '']).map((o, k) => {
              const corr = cset.has(k);
              return `<div class="col-12 col-md-6"><div class="input-group">
                <button type="button" class="btn it-correct ${corr ? 'btn-success' : 'btn-outline-secondary'}" data-i="${i}" data-k="${k}" title="Marcar/quitar como correcta" aria-pressed="${corr}">
                  <i class="bi ${corr ? 'bi-check-circle-fill' : 'bi-circle'}"></i>
                </button>
                <input class="form-control it-opt ${corr ? 'border-success bg-success-subtle fw-semibold' : ''}" data-i="${i}" data-k="${k}" placeholder="Opción ${k + 1}" value="${escapeHtml(o)}">
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
          <div class="d-flex align-items-center gap-3 flex-wrap">
            <div class="d-flex align-items-center gap-2">
              <label class="form-label small text-muted mb-0">Puntos</label>
              <input type="number" min="1" class="form-control form-control-sm it-pts" style="width:5rem" data-i="${i}" value="${it.points || 1}">
            </div>
            ${itemSecondsFieldHtml(a, it, i)}
          </div>
        </div>
      </div>
    </div></div>
  `).join('');
}
