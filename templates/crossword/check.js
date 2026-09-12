// LA COMPROBACIÓN DEL CRUCIGRAMA — qué está bien, sin DOM.
//
// Decide si una palabra está resuelta, qué sale al pulsar «Verificar» (qué
// palabras quedan bien, cuáles mal y qué LETRAS concretas están equivocadas),
// qué letra regala una pista y cuánto se lleva quien acabó. El player se queda
// con pintarlo. Estaba todo dentro del player, así que la única forma de
// comprobar que «Verificar» no marca de más era jugar a mano.
import { celdasDe } from './cursor.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').CrosswordWord} CrosswordWord
 */

/** @param {string[][]} userGrid @param {number} r @param {number} c @returns {string} */
const letra = (userGrid, r, c) => userGrid[r]?.[c] || '';

/** ¿Está la palabra escrita entera y correcta?
 * @param {CrosswordWord} w @param {string[][]} userGrid @returns {boolean} */
export function palabraResuelta(w, userGrid) {
  return celdasDe(w).every(({ r, c, i }) => letra(userGrid, r, c) === w.word[i]);
}

/**
 * «Verificar»: el veredicto de TODAS las palabras de una vez.
 * Las ya resueltas se confirman sin volver a tocar sus letras (así una pista ya
 * regalada no se repinta como error).
 * @param {CrosswordWord[]} words
 * @param {string[][]} userGrid
 * @param {Set<string>|Iterable<string>} [resueltas] las que ya se daban por buenas
 * @returns {{palabras: {id: string, estado: 'correct'|'wrong'}[],
 *            letrasMal: {r: number, c: number}[], letrasBien: {r: number, c: number}[],
 *            resueltas: string[], todas: boolean}}
 */
export function revisarTodo(words, userGrid, resueltas = new Set()) {
  const ya = new Set(resueltas);
  /** @type {{id: string, estado: 'correct'|'wrong'}[]} */
  const palabras = [];
  /** @type {{r: number, c: number}[]} */
  const letrasMal = [];
  /** @type {{r: number, c: number}[]} */
  const letrasBien = [];
  for (const w of words) {
    if (ya.has(w.id)) { palabras.push({ id: w.id, estado: 'correct' }); continue; }
    let bien = true;
    for (const { r, c, i } of celdasDe(w)) {
      const escrita = letra(userGrid, r, c);
      const ok = escrita === w.word[i];
      if (!ok) bien = false;
      if (escrita && !ok) letrasMal.push({ r, c });
      else letrasBien.push({ r, c });
    }
    if (bien) ya.add(w.id);
    palabras.push({ id: w.id, estado: bien ? 'correct' : 'wrong' });
  }
  return { palabras, letrasMal, letrasBien, resueltas: [...ya], todas: ya.size >= words.length };
}

/** La palabra a la que regalar letra con «Pista»: la activa si sigue sin
 *  resolver, y si no la primera pendiente.
 * @param {CrosswordWord[]} words @param {Set<string>} resueltas @param {string|null} activa
 * @returns {CrosswordWord|null} */
export function palabraParaPista(words, resueltas, activa) {
  const pendientes = words.filter(w => !resueltas.has(w.id));
  if (!pendientes.length) return null;
  return pendientes.find(w => w.id === activa) || pendientes[0];
}

/** La primera casilla vacía de una palabra, con la letra que le toca.
 * @param {CrosswordWord} w @param {string[][]} userGrid
 * @returns {{r: number, c: number, letra: string}|null} */
export function primeraVacia(w, userGrid) {
  const hueco = celdasDe(w).find(({ r, c }) => !letra(userGrid, r, c));
  return hueco ? { r: hueco.r, c: hueco.c, letra: w.word[hueco.i] } : null;
}

/** El puntaje y su TECHO, con el scorer de la plantilla (§ un solo scorer): el
 *  techo es, por definición, lo que da resolverlas todas.
 * @param {CrosswordWord[]} words
 * @param {Set<string>} resueltas
 * @param {(w: CrosswordWord) => number} puntosDe
 * @returns {{score: number, maxScore: number}} */
export function puntuarCrucigrama(words, resueltas, puntosDe) {
  return {
    score: words.filter(w => resueltas.has(w.id)).reduce((s, w) => s + puntosDe(w), 0),
    maxScore: words.reduce((s, w) => s + puntosDe(w), 0),
  };
}
