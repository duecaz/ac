// Shared editor primitives. Templates compose these instead of redefining
// title/subtitle inputs, tab strips, or list-item controls each time.
// Pure functions: return HTML strings; attach handlers via separate helpers.
import { escapeHtml } from './html.js';
import { on } from './events.js';
import { toast } from './toast.js';
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


/** EL TEMPORIZADOR DE LA ACTIVIDAD (`rules.timer`, segundos por ítem; 0 = sin
 *  límite). Escrito UNA vez, como el de «tiempo en vivo» de abajo y por el mismo
 *  motivo: lo tenían Quiz y Sopa con dos redacciones distintas, y Tildes y Comas
 *  no lo tenían en absoluto… mientras `ruleScopeNote()` —justo al lado— prometía
 *  que «el temporizador aplica en Individual y Tarea». Un aviso que anuncia un
 *  control inexistente es peor que no decir nada: el profe lo busca y no está.
 *  @param {object} a  la actividad
 *  @param {string} etiqueta  cómo se llama la unidad en esta plantilla */
export function timerFieldHtml(a, etiqueta = 'ítem') {
  return `<div class="col-md-4">
    <label class="form-label" for="f-timer">Tiempo por ${escapeHtml(etiqueta)} (s)</label>
    <input id="f-timer" type="number" min="0" max="600" class="form-control"
           value="${a.rules?.timer || 0}" placeholder="0">
    <div class="form-text">0 = sin límite de tiempo</div>
  </div>`;
}

export function wireTimerField(root, a, ctx) {
  on(root, 'input', '#f-timer', (e) => {
    a.rules.timer = Math.max(0, +e.target.value || 0);
    ctx.onChange(a);
  });
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
 * LOS DOS NÚMEROS SE ELIGEN AQUÍ, y vienen ya puestos (R2: nada que configurar
 * para empezar). Nacieron de pegar un poema entero y recibir 29 elementos de un
 * verso cada uno: cuántas líneas hacen un párrafo y cuántos párrafos entran no
 * es lo mismo para un poema que para una lectura de sociales, y adivinarlo por
 * el profe se equivoca la mitad de las veces.
 */
export function pegarTextoHtml(o = {}) {
  const titulo = escapeHtml(o.titulo || 'Pegar un texto');
  const lineas = Number(o.lineas) || 3;
  const tope = Number(o.tope) || 4;
  return `<details class="ww-pegar mb-3">
    <summary><i class="bi bi-clipboard-plus"></i> ${titulo}</summary>
    <div class="d-flex flex-wrap align-items-end gap-2 mt-2 mb-2">
      <label class="small text-muted">Líneas por párrafo
        <input id="ww-pegar-lineas" type="number" class="form-control form-control-sm"
               style="width:5rem" min="1" max="12" value="${lineas}">
      </label>
      <label class="small text-muted">Cuántos añadir
        <input id="ww-pegar-tope" type="number" class="form-control form-control-sm"
               style="width:5rem" min="1" max="50" value="${tope}">
      </label>
      <span class="small text-muted">Se ignoran las líneas en blanco y las que no tengan nada que corregir.</span>
    </div>
    <textarea id="ww-pegar-txt" class="form-control" rows="5"
      placeholder="Pega aquí el poema, la lectura o las frases…"></textarea>
    <button type="button" class="btn btn-primary btn-sm mt-2" id="ww-pegar-go">
      <i class="bi bi-plus-lg"></i> Añadir
    </button>
    <span class="small text-danger ms-2" id="ww-pegar-err" hidden></span>
  </details>`;
}

/**
 * Cablea la puerta. `alPegar(parrafos, { tope })` recibe los párrafos ya
 * agrupados y devuelve `{ anadidas, omitidas, sobrantes }`: quién decide cuáles
 * SIRVEN es la plantilla —solo ella sabe qué es una marca—, y el tope se cuenta
 * sobre las que sirven, no sobre las que se pegaron. Pegar un poema entero metía
 * también los versos sin una sola tilde: en el juego no hay nada que tocar ahí,
 * y el panel de «lo que falta» se llenaba de reproches por líneas que el profe
 * no había escrito.
 */
export function wirePegarTexto(root, partir, alPegar) {
  on(root, 'click', '#ww-pegar-go', () => {
    const caja = document.getElementById('ww-pegar-txt');
    const err = document.getElementById('ww-pegar-err');
    const decir = (t) => { if (err) { err.textContent = t; err.hidden = false; } };
    const num = (id, def, min, max) => {
      const v = Math.round(Number(document.getElementById(id)?.value));
      return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
    };
    const lineas = num('ww-pegar-lineas', 3, 1, 12);
    const tope = num('ww-pegar-tope', 4, 1, 50);
    const parrafos = partir(caja?.value || '', { lineas });
    if (!parrafos.length) {
      // R6: no se queda mudo. Pegar algo y que no pase nada es peor que un error.
      decir('No se ha reconocido ningún párrafo utilizable en ese texto.');
      return;
    }
    if (err) err.hidden = true;
    const { anadidas = 0, omitidas = 0, sobrantes = 0 } = alPegar(parrafos, { tope }) || {};
    if (!anadidas) {
      decir(`Ninguno de los ${parrafos.length} párrafos tenía nada que corregir.`);
      return;
    }
    if (caja) caja.value = '';
    // Por `toast` y no en el hueco de al lado: al añadir se repinta el panel
    // entero, así que un mensaje ahí desaparecería en el mismo instante. Y se
    // cuenta lo que NO entró: pegas un poema, aparecen cuatro párrafos y sin
    // decir nada uno se queda contando versos.
    const resto = [
      omitidas ? `${omitidas} sin nada que corregir` : '',
      sobrantes ? `${sobrantes} por encima del tope` : '',
    ].filter(Boolean).join(' y ');
    toast(`${anadidas} párrafo${anadidas === 1 ? '' : 's'} añadido${anadidas === 1 ? '' : 's'}.`
      + (resto ? ` Quedaron fuera ${resto}.` : ''),
      resto ? 'warning' : 'success', 6000);
  });
}
