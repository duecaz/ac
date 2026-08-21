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

/**
 * PARTIR UN TEXTO PEGADO EN FRASES JUGABLES.
 *
 * Nació de un caso del dueño: pidió a la IA frases sobre «Poema 9 monstruos» y
 * el modelo escribió versos AL ESTILO de Vallejo —ninguno del poema—. Es lo que
 * un modelo de lenguaje hace bien y mal a la vez: imita. Cuando el profe ya
 * tiene el texto, no hay nada que inventar y pedírselo a una IA solo añade el
 * riesgo de que lo cambie. Pegarlo es exacto, gratis y no depende de la red.
 *
 * Se corta por SALTOS DE LÍNEA primero —en un poema el verso es la unidad— y
 * dentro de cada línea por punto, signo de cierre o punto y coma. Lo que queda
 * demasiado corto para tener tildes o comas no se cuela como frase suelta.
 *
 * @param {string} texto
 * @param {object} [opts]
 * @param {number} [opts.minimo=12]   caracteres mínimos de una frase utilizable
 * @param {number} [opts.maximo=300]  tope por frase (una frase de tres líneas no se lee en clase)
 * @returns {string[]}
 */
export function partirEnFrases(texto, opts = {}) {
  const { minimo = 12, maximo = 300 } = opts;
  const out = [];
  for (const linea of String(texto || '').split(/\r?\n/)) {
    // El punto y los signos de cierre TERMINAN frase y se quedan con ella; los
    // dos puntos y el punto y coma también cortan, que si no salen párrafos.
    for (const trozo of linea.split(/(?<=[.!?;:…])\s+/)) {
      const f = trozo.replace(/\s+/g, ' ').trim();
      if (f.length < minimo) continue;
      out.push(f.length > maximo ? f.slice(0, maximo).trim() : f);
    }
  }
  return out;
}
