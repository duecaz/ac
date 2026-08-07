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
