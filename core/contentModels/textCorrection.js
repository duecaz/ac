// Content model: a list of passages, each with character-indexed marks
// indicating which positions need a tilde / coma / punto.
//
//   passages: [
//     {
//       id: 'p1',
//       text: 'la cancion popular',
//       marks: [
//         { pos: 6, kind: 'tilde' }   // 'cancion' -> 'canción' at position 6 ('o')
//       ]
//     }
//   ]
//
// Used by the 'tildes' template (and future siblings: 'comas', 'puntos').
// Mark kinds:
//   'tilde'  → adds an acute accent to the vowel at pos
//   'coma'   → inserts a comma after pos
//   'punto'  → inserts a period after pos
//
// Resolving the corrected text from text+marks is done in core/textMarks.js
// so editor preview and player share the logic.

import { rid } from '../ids.js';
import { getTemplate } from '../registry.js';

/** ¿Esta actividad es una HOJA DE TEXTO (Tildes/Comas)? Lo pregunta quien tiene
 *  que dejarle el ancho: el duelo apaga su animación central en ellas —el
 *  carril del centro roba el ancho que el texto necesita— y el panel del editor
 *  tiene que decir lo MISMO. La pregunta la responde el modelo, no cada vista
 *  con su `meta.contentModel === 'textCorrection'` a mano (estaba escrito en dos
 *  sitios y ya discrepaban: el editor decía «Animación: sí» donde la clase la
 *  veía apagada). */
export function esHojaDeTexto(activity) {
  return getTemplate(activity?.template)?.meta?.contentModel === 'textCorrection';
}

export function newEmpty() {
  return { passages: [{ id: rid('ps_'), text: '', marks: [] }] };
}

export function newPassage() {
  return { id: rid('ps_'), text: '', marks: [] };
}

export function validate(content) {
  const errs = [];
  if (!Array.isArray(content?.passages)) errs.push('passages must be an array');
  return errs;
}

/** Cuántas líneas seguidas forman un párrafo, y cuántos párrafos entran de una
 *  pegada. Decisión del dueño (2026-08-21) después de pegar un poema entero: le
 *  salieron 29 frases de un verso cada una. Un verso suelto es poco texto para
 *  corregir y demasiados elementos para jugar; tres líneas seguidas son un
 *  párrafo con sentido, y cuatro párrafos son una actividad de clase. */
export const LINEAS_POR_PARRAFO = 3;
export const MAX_PARRAFOS = 4;

/**
 * PARTIR UN TEXTO PEGADO EN PÁRRAFOS JUGABLES.
 *
 * Nació de un caso del dueño: pidió a la IA frases sobre «Poema 9 monstruos» y
 * el modelo escribió versos AL ESTILO de Vallejo —ninguno del poema—. Es lo que
 * un modelo de lenguaje hace bien y mal a la vez: imita. Cuando el profe ya
 * tiene el texto, no hay nada que inventar y pedírselo a una IA solo añade el
 * riesgo de que lo cambie. Pegarlo es exacto, gratis y no depende de la red.
 *
 * Se agrupan LÍNEAS SEGUIDAS, no frases sueltas: en un poema el verso es la
 * unidad de escritura, pero no la de trabajo — «jamás el fuego nunca» no da
 * para un ejercicio. Las líneas en blanco no cortan el grupo (separan estrofas,
 * no ideas), solo se ignoran.
 *
 * NO aplica el tope: devuelve todos los párrafos y deja que quien llama decida.
 * El motivo es que el tope se cuenta sobre los que SIRVEN, y qué sirve lo sabe
 * la plantilla (Tildes mira tildes, Comas mira comas), no este módulo.
 *
 * @param {string} texto
 * @param {object} [opts]
 * @param {number} [opts.lineas=3]    líneas seguidas por párrafo
 * @param {number} [opts.minimo=12]   caracteres mínimos de un párrafo utilizable
 * @param {number} [opts.maximo=600]  tope por párrafo (se corta por la última palabra entera)
 * @returns {string[]}
 */
export function partirEnParrafos(texto, opts = {}) {
  const { lineas = LINEAS_POR_PARRAFO, minimo = 12, maximo = 600 } = opts;
  const utiles = String(texto || '').split(/\r?\n/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const out = [];
  for (let i = 0; i < utiles.length; i += lineas) {
    const p = utiles.slice(i, i + lineas).join(' ').trim();
    if (p.length < minimo) continue;
    if (p.length <= maximo) { out.push(p); continue; }
    // Cortar a mitad de palabra deja «carnívo» en la pantalla de un alumno: se
    // corta por el último espacio que quepa.
    const recorte = p.slice(0, maximo);
    const corte = recorte.lastIndexOf(' ');
    out.push((corte > minimo ? recorte.slice(0, corte) : recorte).trim());
  }
  return out;
}
