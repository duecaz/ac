// Editor compartido de Comas/Tildes (§21b: `templates/comas/editor.js` y
// `templates/tildes/editor.js` eran el MISMO editor con dos parseadores y dos
// tandas de texto — cotejado carácter a carácter, la única diferencia real
// era `kind`/`parse`/los textos que ve el profe). Sigue el mismo patrón
// `kind` que ya usa core/textCorrectionRound.js.
//
// Pega el texto CON la marca (comas o tildes); la app la quita y guarda las
// posiciones. Solo pinta sus paneles; el chasis lo pone core/editorShell.js.
import { escapeHtml, valorDe, marcado } from './html.js';
import { toast, TOAST_NORMAL } from './toast.js';
import { on } from './events.js';
import { newPassage, partirEnParrafos, frasesDe, ponerFrases } from './contentModels/textCorrection.js';
import { applyMarks } from './textMarks.js';
import { itemControlsHtml, wireItemList, ruleScopeNote, itemSecondsFieldHtml, wireItemSeconds, pegarTextoHtml, wirePegarTexto, corregirAlFinalHtml, wireCorregirAlFinal } from './editorPrimitives.js';
import { renderEditorShell } from './editorShell.js';

/** @typedef {import('../kernel/contracts/activity.js').Activity} Activity */
/** @typedef {import('../kernel/contracts/activity.js').TextCorrectionContent} TextCorrectionContent */
/** @typedef {import('../kernel/contracts/activity.js').Passage} Passage */
/** @typedef {import('../kernel/contracts/activity.js').TextMark} TextMark */
/** @typedef {import('./editorShell.js').EditorCtx} EditorCtx */
/** @typedef {(s: string) => {text: string, marks: TextMark[]}} Parser */
/** Los textos que ve el profe: lo ÚNICO que distingue a Comas de Tildes aquí.
 *  @typedef {Object} TextosEditor
 *  @property {string} instrucciones     sobre la lista de frases
 *  @property {string} [labelTextarea]   encima de cada textarea (comas no lo usa)
 *  @property {string} placeholder       placeholder de cada textarea */

/**
 * @param {Element} root
 * @param {Activity} activity
 * @param {(a: Activity) => void} onChange
 * @param {{kind: 'coma'|'tilde', parse: Parser, textos: TextosEditor}} opts
 */
export function renderTextCorrectionEditor(root, activity, onChange, { kind, parse, textos }) {
  const a = activity;
  // La hoja SIEMPRE tiene al menos una frase en blanco — es la misma invariante
  // que ya aplicaba «Quitar las N sin nada que corregir» al vaciar la lista.
  if (!frasesDe(a).length) a.content = { passages: [newPassage()] };
  renderEditorShell(root, a, onChange, {
    content: { label: 'Frases', html: (act) => contentHtml(act, textos), wire: (r, act, ctx) => wireContent(r, act, ctx, { parse, textos }) },
    rules: { html: rulesHtml, wire: wireRules },
  });
}

/** @param {Activity} a @param {TextosEditor} textos @returns {string} */
function contentHtml(a, textos) {
  const passages = frasesDe(a);
  return `
    ${pegarTextoHtml({ titulo: 'Pegar un texto (un poema, una lectura…)' })}
    <p class="small text-muted">${textos.instrucciones}</p>
    ${passages.map((p, i) => renderPassage(p, i, passages.length, a, textos)).join('')}
    <button class="btn btn-outline-primary mt-2" id="t-add"><i class="bi bi-plus-lg"></i> Añadir frase</button>
    ${limpiarBotonHtml(a, textos)}`;
}

/** QUITAR DE GOLPE LAS QUE NO DAN JUEGO. Una frase sin una sola marca no
 *  tiene nada que tocar, y el panel rojo la reprocha una por una: con un poema
 *  pegado eran cuarenta reproches y cuarenta borrados a mano. El botón solo
 *  aparece cuando hay algo que quitar, y dice CUÁNTAS — borrar a ciegas trabajo
 *  del profe es justo lo que §24 no permite. */
/** @param {Activity} a @param {TextosEditor} textos @returns {string} */
function limpiarBotonHtml(a, textos) {
  const n = frasesDe(a).filter(p => String(p.text || '').trim() && !(p.marks || []).length).length;
  if (!n) return '';
  return `<button class="btn btn-outline-danger mt-2 ms-2" id="t-limpiar">
    <i class="bi bi-eraser"></i> Quitar las ${n} frase${n === 1 ? '' : 's'} sin nada que corregir
  </button>`;
}
/**
 * @param {Element} root
 * @param {Activity} a
 * @param {EditorCtx} ctx
 * @param {{parse: Parser, textos: TextosEditor}} opts
 */
function wireContent(root, a, ctx, { parse, textos }) {
  wireItemSeconds(root, a, ctx, frasesDe(a));   // R-3 · tiempo por frase
  on(root, 'input', '.tp-accented', (_, el) => {
    const idx = Number(el.dataset.i);
    const { text, marks } = parse(valorDe(el));
    const p = frasesDe(a)[idx];
    if (!p) return;
    p.text = text; p.marks = marks;
    ctx.onChange(a);
    const preview = document.querySelector(`[data-preview="${idx}"]`);
    if (preview) preview.textContent = text || '(vacío)';
    const expected = document.querySelector(`[data-expected="${idx}"]`);
    if (expected) expected.textContent = applyMarks(text, marks);
  });
  // Pegar un texto EXISTENTE: se parte en frases y cada una pasa por el parser
  // de esta plantilla, el mismo que usa el profe al teclear. No inventa nada —
  // que es justo lo que se le pedía a la IA y no podía cumplir con un poema.
  wirePegarTexto(root, partirEnParrafos, (parrafos, { tope }) => {
    // Solo entran los que TIENEN algo que corregir —un párrafo sin una sola
    // marca no da juego, no hay nada que tocar— y se para al llegar al tope,
    // que se cuenta sobre los que sirven: pedir cuatro y recibir uno porque tres
    // no tenían marcas sería cumplir el número y fallar la promesa.
    let omitidas = 0; let anadidas = 0; let i = 0;
    for (; i < parrafos.length && anadidas < tope; i++) {
      const trozo = parse(parrafos[i]);
      if (!trozo.marks.length) { omitidas++; continue; }
      frasesDe(a).push({ ...newPassage(), ...trozo });
      anadidas++;
    }
    // La frase vacía con la que nace la plantilla no cuenta como trabajo del
    // profe: dejarla deja un hueco delante de lo que acaba de pegar (mismo
    // criterio que `fusionarContenido` usa con lo que escribe la IA).
    if (anadidas) {
      ponerFrases(a, frasesDe(a).filter(p => String(p.text || '').trim() !== ''));
      ctx.onChange(a); ctx.repaint();
    }
    return { anadidas, omitidas, sobrantes: parrafos.length - i };
  });
  on(root, 'click', '#t-limpiar', () => {
    const antes = frasesDe(a).length;
    ponerFrases(a, frasesDe(a).filter(p => !String(p.text || '').trim() || (p.marks || []).length));
    const fuera = antes - frasesDe(a).length;
    if (!frasesDe(a).length) frasesDe(a).push(newPassage());
    ctx.onChange(a); ctx.repaint();
    toast(`Quitada${fuera === 1 ? '' : 's'} ${fuera} frase${fuera === 1 ? '' : 's'} sin nada que corregir.`, 'success', TOAST_NORMAL);
  });
  // Añadir · borrar · subir · bajar: el primitivo, no su copia manual.
  wireItemList(root, a, ctx, { list: frasesDe(a), añadir: { selector: '#t-add', fabrica: newPassage } });
}

// NOTA: aquí vivía «Comas/Tildes ilimitadas». El tope NUNCA se implementó (la
// ronda no cuenta marcas disponibles), así que desmarcarlo no hacía nada. Se
// quita el mando y la función queda como deuda escrita en CLAUDE.md — un
// control que no controla engaña al que prepara la clase.
/** @param {Activity} a @returns {string} */
function rulesHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-4 form-check pt-4 ms-3"><input id="t-rand" class="form-check-input" type="checkbox" ${a.rules.randomize ? 'checked' : ''}><label class="form-check-label" for="t-rand">Mezclar frases</label></div>
    <div class="col-12">${ruleScopeNote()}</div>
    ${corregirAlFinalHtml(a, 'frase')}
  </div>`;
}
/** @param {Element} root @param {Activity} a @param {EditorCtx} ctx */
function wireRules(root, a, ctx) {
  on(root, 'change', '#t-rand', (_, el) => { a.rules.randomize = marcado(el); ctx.onChange(a); });
  wireCorregirAlFinal(root, a, ctx);
}

/**
 * @param {Passage} p
 * @param {number} i
 * @param {number} total
 * @param {Activity} A
 * @param {TextosEditor} textos
 * @returns {string}
 */
function renderPassage(p, i, total, A, textos) {
  const accented = applyMarks(p.text || '', p.marks || []);
  const label = textos.labelTextarea
    ? `<label class="form-label small text-muted">${textos.labelTextarea}</label>`
    : '';
  return `
    <div class="card mb-3"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-secondary">Frase ${i + 1}</span>
        ${itemControlsHtml(i, total)}
      </div>
      ${label}
      <textarea class="form-control mb-2 tp-accented" data-i="${i}" rows="2" placeholder="${escapeHtml(textos.placeholder)}">${escapeHtml(accented)}</textarea>
      <div class="row small">
        <div class="col-md-6"><span class="text-muted">Lo que verá el alumno:</span> <span data-preview="${i}" class="font-monospace">${escapeHtml(p.text || '(vacío)')}</span></div>
        <div class="col-md-6"><span class="text-muted">Solución:</span> <b data-expected="${i}">${escapeHtml(accented)}</b></div>
      </div>
      <div class="mt-2">${itemSecondsFieldHtml(A, p, i)}</div>
    </div></div>`;
}
