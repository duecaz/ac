// Editor del quiz. Solo aporta sus paneles (Contenido/Individual/Puntuación/En
// vivo); el chasis (título, pestañas, Modos, Presentación) lo pone el shell
// compartido (core/editorShell.js).
import { html, escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { renderImagePicker, attachImagePicker } from '../../core/imagePicker.js';
import { itemControlsHtml, reorderArray, itemSecondsFieldHtml, wireItemSeconds } from '../../core/editorPrimitives.js';
import { rid } from '../../core/ids.js';
import { hasCorrectAnswer } from '../../core/contentModels/qa.js';
import { renderEditorShell } from '../../core/editorShell.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').QaItem} QaItem
 * @typedef {import('../../core/editorShell.js').EditorCtx} EditorCtx
 */

/** Las preguntas de ESTA actividad: el modelo es `qa` y los dos editores que
 *  montan este panel (Quiz y Globos) lo saben.
 *  @param {Activity|null|undefined} a @returns {QaItem[]} */
const preguntas = (a) => /** @type {{items?: QaItem[]}} */ (a?.content ?? {}).items ?? [];

/** Lo tecleado en el campo que disparó el evento. @param {Event} e @returns {string} */
function valorDe(e) {
  const el = /** @type {HTMLInputElement|null} */ (e.target);
  return el ? el.value : '';
}

/** Si el interruptor que disparó el evento queda marcado. @param {Event} e @returns {boolean} */
function marcado(e) {
  const el = /** @type {HTMLInputElement|null} */ (e.target);
  return !!el?.checked;
}

/**
 * @param {Element} root
 * @param {Activity} activity
 * @param {(activity: Activity) => void} onChange
 * @returns {void}
 */
export function renderQuizEditor(root, activity, onChange) {
  const a = activity;
  // Auto-cura ítems sin opciones (p. ej. convertidos desde Matemáticas) para que
  // el editor no falle al escribir en item.options[k].
  // El editor no puede reventar con el contenido vacío: lo produce una actividad
  // recién creada y también un JSON importado a medias. Antes `renderItems`
  // leía `a.content.items.length` y lanzaba antes de pintar nada.
  if (!a.content || typeof a.content !== 'object') a.content = { items: [] };
  const contenido = /** @type {{items?: QaItem[]}} */ (a.content);
  if (!Array.isArray(contenido.items)) contenido.items = [];
  contenido.items.forEach(it => { if (!Array.isArray(it.options)) it.options = ['', '', '', '']; });
  renderEditorShell(root, a, onChange, {
    content: { label: 'Contenido', html: contentHtml, wire: wireContent },
    rules: { html: rulesHtml, wire: wireRules },
    // Puntuación y En vivo ya NO los declara la plantilla: son los paneles por
    // defecto del chasis (core/editorPanels.js) y ahora los tienen todas, no
    // solo Quiz. Salieron literalmente de aquí.
  });
}

// ── Contenido ──
/** @param {Activity} a @returns {string} */
function contentHtml(a) {
  return `
    ${renderItems(a)}
    <div class="d-flex gap-2 flex-wrap">
      <button class="btn btn-outline-primary" id="add-item"><i class="bi bi-plus-lg"></i> Añadir pregunta</button>
      <button class="btn btn-outline-secondary" id="add-tf"><i class="bi bi-check2-square"></i> + Verdadero/Falso</button>
    </div>`;
}

/** @param {Element} root @param {Activity} a @param {EditorCtx} ctx @returns {void} */
function wireContent(root, a, ctx) {
  const items = preguntas(a);
  on(root, 'click', '#add-item', () => {
    // SIN `points`: sembrarlo hacía que la pregunta ignorara «Puntos por
    // acierto» del panel. El campo de Avanzado lo escribe si el profe quiere
    // que ESTA pregunta valga distinto.
    items.push({ id: rid('q_'), question: '', answer: '', options: ['', '', '', ''], image: null, audio: null });
    ctx.onChange(a); ctx.repaint();
  });
  on(root, 'click', '#add-tf', () => {
    items.push({ id: rid('q_'), question: '', answer: 'Verdadero', options: ['Verdadero', 'Falso'], image: null, audio: null, kind: 'truefalse' });
    ctx.onChange(a); ctx.repaint();
  });
  on(root, 'click', '.item-del', (_, btn) => { items.splice(+(btn.dataset.i ?? 0), 1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-up', (_, btn) => { reorderArray(items, +(btn.dataset.i ?? 0), -1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-down', (_, btn) => { reorderArray(items, +(btn.dataset.i ?? 0), +1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'input', '.it-q', (e, el) => { items[+(el.dataset.i ?? 0)].question = valorDe(e); ctx.onChange(a); });
  on(root, 'input', '.it-opt', (e, el) => {
    const i = +(el.dataset.i ?? 0), k = +(el.dataset.k ?? 0), item = items[i];
    setOptionText(item, k, valorDe(e));
    // Si al reescribir el texto la pregunta se quedó SIN respuesta correcta, el
    // aviso aparece al instante (no al terminar la partida).
    root.querySelector('#ans-warn')?.classList.toggle('d-none', !someItemHasNoAnswer(a));
    ctx.onChange(a);
  });
  // Toggle an option correct BY INDEX (duplicate/empty texts don't collide).
  on(root, 'click', '.it-correct', (_, el) => {
    const i = +(el.dataset.i ?? 0), k = +(el.dataset.k ?? 0), item = items[i];
    const set = correctIdxSet(item);
    if (set.has(k)) set.delete(k); else set.add(k);
    item.answerIdx = [...set].sort((x, y) => x - y);
    syncAnswerFromIdx(item);
    ctx.onChange(a); ctx.repaint();
  });
  wireItemSeconds(root, a, ctx, items);   // R-3 · tiempo por pregunta
  on(root, 'input', '.it-pts', (e, el) => {
    items[+(el.dataset.i ?? 0)].points = +valorDe(e) || 1;
    root.querySelector('#pts-warn')?.classList.toggle('d-none', !pointsAreUneven(a));
    ctx.onChange(a);
  });
  items.forEach((item, i) => {
    attachImagePicker(root, `#img-${i}`, item.image, (url, atribucion) => {
      item.image = url;
      // El crédito viaja CON el píxel (§24) o se va con él.
      if (atribucion) item.imageCredit = atribucion; else delete item.imageCredit;
      ctx.onChange(a);
    }, { credito: item.imageCredit || null, consulta: item.question || '' });
  });
}

// ── Individual (reglas) ──
/** @param {Activity} a @returns {string} */
function rulesHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-4 form-check pt-4"><input class="form-check-input" type="checkbox" id="f-rand" ${a.rules.randomize ? 'checked' : ''}><label class="form-check-label" for="f-rand">Orden aleatorio</label></div>
    <div class="col-md-4 form-check pt-4"><input class="form-check-input" type="checkbox" id="f-shuf" ${a.rules.shuffleOptions ? 'checked' : ''}><label class="form-check-label" for="f-shuf">Mezclar opciones</label></div>
  </div>`;
}
/** @param {Element} root @param {Activity} a @param {EditorCtx} ctx @returns {void} */
function wireRules(root, a, ctx) {
  on(root, 'change', '#f-rand', e => { a.rules.randomize = marcado(e); ctx.onChange(a); });
  on(root, 'change', '#f-shuf', e => { a.rules.shuffleOptions = marcado(e); ctx.onChange(a); });
}



// ── helpers (sin cambios de lógica) ──
/** @param {Activity} a @returns {boolean} */
function pointsAreUneven(a) {
  return new Set(preguntas(a).map(it => it.points || 1)).size > 1;
}
/** @param {Activity} a @returns {string} */
function pointsWarningHtml(a) {
  return `<div id="pts-warn" class="alert alert-danger d-flex align-items-start gap-2 py-2 mb-2 ${pointsAreUneven(a) ? '' : 'd-none'}" role="alert">
    <i class="bi bi-exclamation-triangle-fill"></i>
    <div><b>No recomendado:</b> tus preguntas tienen <b>puntos distintos</b>. En el modo
    <b>Equipos</b> (por turnos) cada equipo responde preguntas diferentes, así que valores
    desiguales hacen que gane quien tuvo la pregunta más valiosa, no quien más sabe.
    Usa los mismos puntos en todas salvo que sea intencional.</div>
  </div>`;
}
/** @param {QaItem} it @returns {Set<number>} */
function correctIdxSet(it) {
  if (Array.isArray(it.answerIdx)) {
    return new Set(it.answerIdx.filter(k => k >= 0 && k < (it.options || []).length));
  }
  const ans = it.answer;
  /** @type {Set<number>} */
  const set = new Set();
  (it.options || []).forEach((o, k) => {
    const match = Array.isArray(ans) ? ans.includes(o) : (ans != null && ans !== '' && ans === o);
    if (match) set.add(k);
  });
  return set;
}
/** @param {QaItem} it @returns {void} */
function syncAnswerFromIdx(it) {
  const idxs = [...correctIdxSet(it)].sort((a, b) => a - b);
  it.answerIdx = idxs;
  const opciones = it.options || [];
  const texts = idxs.map(k => opciones[k]);
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
/**
 * @param {QaItem} item
 * @param {number} k
 * @param {string} text
 * @returns {QaItem}
 */
export function setOptionText(item, k, text) {
  const idxs = [...correctIdxSet(item)].sort((a, b) => a - b);  // ANTES de mutar
  item.answerIdx = idxs;
  if (!Array.isArray(item.options)) item.options = [];
  item.options[k] = text;
  syncAnswerFromIdx(item);
  return item;
}

/** ¿Esta pregunta puede puntuarse? Sin correcta marcada, TODA respuesta cuenta
 *  como fallo — el modo de fallar silencioso que nadie ve hasta jugar. */
// La regla vive en el modelo (core/contentModels/qa.js). Esta copia miraba solo
// `answer`, así que daba por buena una pregunta cuya opción marcada se había
// quedado sin texto — y ahí el scorer falla TODAS las respuestas.
/** @param {QaItem|null|undefined} it @returns {boolean} */
export function itemHasNoAnswer(it) { return !hasCorrectAnswer(it); }
/** @param {Activity|null|undefined} a @returns {boolean} */
export function someItemHasNoAnswer(a) {
  return preguntas(a).some(itemHasNoAnswer);
}

/** @param {Activity} a @returns {string} */
function answerWarningHtml(a) {
  return `<div id="ans-warn" class="alert alert-danger d-flex align-items-start gap-2 py-2 mb-2 ${someItemHasNoAnswer(a) ? '' : 'd-none'}" role="alert">
    <i class="bi bi-exclamation-octagon-fill"></i>
    <div><b>Hay preguntas SIN respuesta correcta marcada.</b> Están en rojo abajo.
    Tal como están, cualquier respuesta del alumno contará como fallo (en Individual,
    VS, Equipos y En vivo). Toca el botón de la opción correcta para marcarla en verde.</div>
  </div>`;
}
/** @param {Activity} a @returns {string} */
function renderItems(a) {
  const items = preguntas(a);
  if (!items.length) return `<p class="text-muted">No hay preguntas todavía.</p>`;
  const total = items.length;
  return answerWarningHtml(a) + pointsWarningHtml(a) + items.map((it, i) => `
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
          <div id="img-${i}">${renderImagePicker(it.image, it.imageCredit || null)}</div>
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
              <input type="number" min="1" class="form-control form-control-sm it-pts" style="width:5rem" data-i="${i}" value="${it.points ?? (a.scoring?.pointsPerCorrect ?? 1)}">
            </div>
            ${itemSecondsFieldHtml(a, it, i)}
          </div>
        </div>
      </div>
    </div></div>
  `).join('');
}
