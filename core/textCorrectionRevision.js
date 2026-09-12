// EL VEREDICTO PALABRA POR PALABRA de una frase corregida, y las anulaciones
// que el docente puede hacerle encima.
//
// Es solo el juicio: quién pintó la frase (core/textCorrectionPasaje.js) y quién
// la pagina (core/textCorrectionSolo.js) no se miran desde aquí. Vive aparte
// porque su invariante —el «N / M» del pie y los aciertos del scorer son el
// MISMO número, con y sin anulaciones— se prueba sin DOM (`tests/tcRevision.test.mjs`).
import { escapeHtml } from './html.js';
import { applyTilde, wordAtPos } from './textMarks.js';

/** @typedef {import('../kernel/contracts/activity.js').Passage} Passage */
/** @typedef {import('./textCorrectionPasaje.js').Marca} Marca */
/** Una fila de la revisión palabra por palabra.
 *  @typedef {{pos: number, palabra: string, estado: 'ok'|'falta'|'demas'}} FilaRevision */

/** La palabra que contiene una marca, ESCRITA YA COMO DEBE QUEDAR («América»,
 *  no «America»): es lo que el alumno tiene que aprender a ver. `wordAtPos` da
 *  la palabra cruda del texto sin tildes; aquí se le aplica la marca en su sitio.
 *  Para la coma se muestra la palabra con la coma detrás. */
/**
 * @param {string} text
 * @param {number} pos
 * @param {Marca} kind
 * @returns {string}
 */
function palabraMarcada(text, pos, kind) {
  const cruda = wordAtPos(text, pos);
  if (!cruda) return '';
  const s = String(text);
  let ini = pos;
  while (ini > 0 && !/\s/.test(s[ini - 1])) ini--;
  const rel = pos - ini;
  if (kind === 'coma') return `${cruda.slice(0, rel + 1)},${cruda.slice(rel + 1)}`;
  return cruda.slice(0, rel) + applyTilde(cruda[rel] ?? '') + cruda.slice(rel + 1);
}

/** LA REVISIÓN, PALABRA POR PALABRA (rescatada de la app anterior; dueño
 *  2026-08-27 con capturas). La corrección se pintaba SOLO dentro del texto, en
 *  rojo: para saber qué había fallado había que releer la frase entera buscando
 *  letras de color, y desde el fondo del aula eso no se hace.
 *
 *  Lleva TRES clases de fila, no dos, y la tercera es la importante:
 *    · acertada  — la marca estaba y el alumno la puso;
 *    · sin marcar — estaba y no la puso;
 *    · DE MÁS    — la puso donde no tocaba.
 *  Las de más no salían en la app anterior, y aquí no se pueden callar: el
 *  puntaje es NETO (aciertos − de más), así que una lista que dijera «2 / 2
 *  correctas» junto a un 0 de puntos sería un número imposible de explicar con
 *  la clase delante.
 *
 *  @param {Passage} p
 *  @param {Marca} kind
 *  @param {Set<number>} got
 *  @returns {FilaRevision[]} */
export function filasRevision(p, kind, got) {
  const want = (p.marks || []).filter(m => m.kind === kind).map(m => m.pos);
  /** @type {FilaRevision[]} */
  const filas = want.map(pos => ({
    pos, palabra: palabraMarcada(p.text, pos, kind),
    estado: got.has(pos) ? 'ok' : 'falta',
  }));
  for (const pos of got) {
    if (want.includes(pos)) continue;
    filas.push({ pos, palabra: palabraMarcada(p.text, pos, kind), estado: 'demas' });
  }
  return filas.sort((a, b) => a.pos - b.pos);
}

/** @type {Record<string, string>} */
const ICONO = { ok: '✓', falta: '✗', demas: '+', perdon: '–' };
/** @type {Record<string, string>} */
const TITULO = { ok: 'Bien puesta', falta: 'Faltaba', demas: 'Marca de más', perdon: 'Marca de más, perdonada' };

/** El veredicto EFECTIVO de una fila tras las anulaciones del docente.
 *  PERDONAR UNA MARCA DE MÁS NO LA CONVIERTE EN ACIERTO. La primera versión
 *  volteaba las tres clases con el mismo `ok ↔ falta`, así que perdonar una de
 *  más la pintaba de verde y el pie decía «1 / 8 correctas» mientras el veredicto
 *  de al lado seguía en «0/8 aciertos». Dos números que no cuadran, en la pantalla
 *  cuyo trabajo es que cuadren. Perdonar significa «esto ya no resta», que es
 *  exactamente lo que hace el scorer al quitar esa posición. */
/**
 * @param {FilaRevision} fila
 * @param {boolean} anulada
 * @returns {'ok'|'falta'|'demas'|'perdon'}
 */
export const efectivoDe = (fila, anulada) => {
  if (!anulada) return fila.estado;
  if (fila.estado === 'demas') return 'perdon';
  return fila.estado === 'ok' ? 'falta' : 'ok';
};

/** EL CONTADOR DEL PIE, con dueño. Cuenta SOLO las marcas que la frase pedía:
 *  las de más no suman ni restan aquí (restan en el puntaje, que es donde se
 *  ven). Vive fuera del panel para que `tests/tcRevision.test.mjs` pueda fijar el
 *  invariante que de verdad importa: este «N / M» y los aciertos que reporta el
 *  scorer son SIEMPRE el mismo número, con y sin anulaciones. */
/**
 * @param {FilaRevision[]} filas
 * @param {Set<number>} [anulados]
 * @returns {{buenas: number, total: number}}
 */
export function resumenRevision(filas, anulados = new Set()) {
  const pedidas = filas.filter(f => f.estado !== 'demas');
  return {
    buenas: pedidas.filter(f => efectivoDe(f, anulados.has(f.pos)) === 'ok').length,
    total: pedidas.length,
  };
}

/** ANULAR = CAMBIAR LAS POSICIONES MARCADAS, y volver a preguntar al MISMO
 *  scorer. Es la única forma de que la anulación no abra una segunda aritmética:
 *  la ley del repo es un solo scorer por plantilla, y aquí se cumple sola porque
 *  el veredicto anulado se EXPRESA como lo que el alumno habría marcado.
 *    · dar por buena una que faltaba  → se añade su posición;
 *    · dar por mala una acertada, o perdonar una de más → se quita.
 *  Recalcular a mano «hits+1, points+ppc» habría sido más corto y habría dejado
 *  el puntaje del docente y el del scorer pudiendo divergir. */
/**
 * @param {Array<number|string>|null|undefined} value
 * @param {Iterable<number>} anulados
 * @param {Passage} p
 * @param {Marca} kind
 * @returns {number[]}
 */
export function valorAnulado(value, anulados, p, kind) {
  const want = new Set((p.marks || []).filter(m => m.kind === kind).map(m => m.pos));
  const v = new Set((value || []).map(Number));
  for (const pos of anulados) {
    if (want.has(pos)) { if (v.has(pos)) v.delete(pos); else v.add(pos); }
    else v.delete(pos);       // una marca de MÁS solo se puede perdonar
  }
  return [...v];
}

/** El panel. `anulable` lo decide el CALLER (§0): anular es cosa del docente con
 *  el aparato en la mano, no del alumno haciendo una tarea desde casa. */
/**
 * @param {FilaRevision[]} filas
 * @param {Set<number>} anulados
 * @param {{anulable?: boolean}} o
 * @returns {string}
 */
export function panelRevisionHtml(filas, anulados, { anulable }) {
  // El pie cuenta SOLO las marcas que la frase pedía: las de más no suman ni
  // restan aquí (restan en el puntaje, que es donde se ven). Así este «N / M» y
  // el «N/M aciertos» del veredicto son el mismo número siempre.
  const { buenas, total } = resumenRevision(filas, anulados);
  return `<aside class="tc-review-side" aria-label="Revisión">
    <h6 class="tc-review-side__t">Revisión</h6>
    <ul class="tc-review-list">
      ${filas.map(f => {
        const anulada = anulados.has(f.pos);
        // Anular una fila la repinta con lo que el docente acaba de decidir:
        // verlo aplicado es la mitad del sentido del botón.
        const efectivo = efectivoDe(f, anulada);
        return `<li class="tc-rev tc-rev--${efectivo}${anulada ? ' is-anulada' : ''}">
          <span class="tc-rev__ico" title="${TITULO[efectivo] || ''}">${ICONO[efectivo]}</span>
          <span class="tc-rev__w">${escapeHtml(f.palabra)}</span>
          ${anulable ? `<button type="button" class="tc-rev__btn" data-anular="${f.pos}"
            aria-pressed="${anulada}"
            title="${anulada ? 'Deshacer el cambio' : 'Cambiar el veredicto de esta palabra'}"
            aria-label="Cambiar el veredicto de ${escapeHtml(f.palabra)}">${anulada ? '↺' : (f.estado === 'ok' ? '✗' : '✓')}</button>` : ''}
        </li>`;
      }).join('')}
    </ul>
    <div class="tc-review-side__pie">${buenas} / ${total} correctas</div>
  </aside>`;
}
