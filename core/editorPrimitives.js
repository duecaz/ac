// Shared editor primitives. Templates compose these instead of redefining
// title/subtitle inputs, tab strips, or list-item controls each time.
// Pure functions: return HTML strings; attach handlers via separate helpers.
import { escapeHtml } from './html.js';
import { on } from './events.js';
import { questionWindowMs, ITEM_SECONDS_MIN, ITEM_SECONDS_MAX } from './timings.js';




// Item-row control buttons: reorder up/down + delete. Use with .item-up,
// .item-down, .item-del classes; index in data-i.
export function itemControlsHtml(idx, total) {
  return `
    <div class="btn-group btn-group-sm">
      <button class="btn btn-outline-secondary item-up" data-i="${idx}" ${idx===0?'disabled':''} title="Subir"><i class="bi bi-arrow-up"></i></button>
      <button class="btn btn-outline-secondary item-down" data-i="${idx}" ${idx===total-1?'disabled':''} title="Bajar"><i class="bi bi-arrow-down"></i></button>
      <button class="btn btn-outline-danger item-del" data-i="${idx}" title="Eliminar"><i class="bi bi-trash"></i></button>
    </div>`;
}

// Mutate an array in place to reorder by direction (-1 up, +1 down).
export function reorderArray(arr, idx, direction) {
  const j = idx + direction;
  if (j < 0 || j >= arr.length) return false;
  const tmp = arr[idx]; arr[idx] = arr[j]; arr[j] = tmp;
  return true;
}


// R2 (ley del cuadro de modos): las reglas de juego configurables tienen ALCANCE
// declarado y el editor lo MUESTRA — antes el docente configuraba "Timer" u
// "Orden aleatorio" creyendo que aplicaban a todos los modos, pero solo las
// honran Individual y Tarea (VS/Equipos/En vivo llevan su propio ritmo).
// Extenderlas a más modos es una decisión de diseño por modo (modos-de-juego §9);
// mientras tanto, se dice la verdad en el formulario.
export function ruleScopeNote() {
  return `<div class="form-text mt-1"><i class="bi bi-info-circle"></i> El temporizador y el orden aleatorio aplican en <b>Individual</b> y <b>Tarea</b>; VS, Equipos y En vivo llevan su propio ritmo.</div>`;
}


// R-3 · CAMPO "tiempo en vivo" POR ÍTEM, compartido por los editores de rondas.
// El motor ya soporta `item.seconds` (core/timings.js); esto es solo su casilla,
// escrita UNA vez para que las cuatro plantillas de rondas no lleven cuatro
// copias que se desincronicen. Vacío = heredar el tiempo de la actividad.
export function itemSecondsFieldHtml(a, it, i) {
  return `<div class="d-flex align-items-center gap-2">
    <label class="form-label small text-muted mb-0" for="secs-${i}">Tiempo en vivo (s)</label>
    <input id="secs-${i}" type="number" min="${ITEM_SECONDS_MIN}" max="${ITEM_SECONDS_MAX}"
           class="form-control form-control-sm it-secs" style="width:6rem" data-i="${i}"
           value="${it?.seconds || ''}" placeholder="${Math.round(questionWindowMs(a) / 1000)}">
    <span class="form-text mb-0">vacío = el de la actividad</span>
  </div>`;
}

/** Cablea el campo anterior sobre `list` (items o passages). Guarda solo si hay
 *  valor: así el contenido antiguo no engorda con campos vacíos. */
export function wireItemSeconds(root, a, ctx, list) {
  on(root, 'input', '.it-secs', (e, el) => {
    const item = (list || a.content?.items || [])[+el.dataset.i];
    if (!item) return;
    const v = Math.round(+e.target.value || 0);
    if (v > 0) item.seconds = Math.min(ITEM_SECONDS_MAX, Math.max(ITEM_SECONDS_MIN, v));
    else delete item.seconds;
    ctx.onChange(a);
  });
}

/**
 * «PEGAR UN TEXTO» — la puerta para cuando el profe YA tiene el texto.
 *
 * La IA imita, y a veces esa es exactamente la respuesta equivocada: pedirle
 * frases de un poema concreto devolvió versos AL ESTILO del autor, ninguno del
 * poema. Cuando el texto ya existe no hay nada que inventar — pegarlo es exacto,
 * instantáneo, gratis y funciona sin red. Va al lado de «Escribir con IA» a
 * propósito: son las dos maneras de llenar la actividad de golpe, y el profe
 * elige según lo que tenga en la mano.
 *
 * @param {object} [o]
 * @param {string} [o.titulo]  qué se pega («un poema, una lectura…»)
 * @param {string} [o.nota]    cómo se va a cortar, dicho ANTES de pegar
 */
export function pegarTextoHtml(o = {}) {
  const titulo = escapeHtml(o.titulo || 'Pegar un texto');
  const nota = escapeHtml(o.nota || 'Cada línea (o cada frase) se convierte en un elemento. Se añade a lo que ya hay.');
  return `<details class="ww-pegar mb-3">
    <summary><i class="bi bi-clipboard-plus"></i> ${titulo}</summary>
    <p class="small text-muted mb-1 mt-2">${nota}</p>
    <textarea id="ww-pegar-txt" class="form-control" rows="5"
      placeholder="Pega aquí el poema, la lectura o las frases…"></textarea>
    <button type="button" class="btn btn-primary btn-sm mt-2" id="ww-pegar-go">
      <i class="bi bi-plus-lg"></i> Añadir estas frases
    </button>
    <span class="small text-danger ms-2" id="ww-pegar-err" hidden></span>
  </details>`;
}

/**
 * Cablea la puerta de pegar. `alPegar(frases)` recibe las frases YA partidas y
 * decide qué hacer con ellas (cada plantilla las analiza con SU parser: las
 * tildes y las comas no se derivan igual).
 */
export function wirePegarTexto(root, partir, alPegar) {
  on(root, 'click', '#ww-pegar-go', () => {
    const caja = document.getElementById('ww-pegar-txt');
    const err = document.getElementById('ww-pegar-err');
    const frases = partir(caja?.value || '');
    if (!frases.length) {
      // R6: no se queda mudo. Pegar algo y que no pase nada es peor que un error.
      if (err) { err.textContent = 'No se ha reconocido ninguna frase utilizable en ese texto.'; err.hidden = false; }
      return;
    }
    if (err) err.hidden = true;
    if (caja) caja.value = '';
    alPegar(frases);
  });
}
