// EL CONTENIDO DE ORDENA LAS PELOTAS — qué forma tiene y cómo se deja jugable.
//
// El tablero se CONGELA aquí (no al jugar) para que todos los alumnos de una
// sala vean exactamente el mismo reparto. Vive aparte del editor porque lo
// necesitan también el player y la plantilla: `ensureContent` estaba en
// `editor.js` y jugar arrastraba el formulario entero detrás.
import { createBoard, randomBoard } from './game/board.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').BallsortContent} BallsortContent
 * @typedef {import('../../kernel/contracts/activity.js').BallsortBoard} BallsortBoard
 */

/** El contenido de ESTA actividad es el tablero generado (modelo `ballsort`).
 * @param {Activity} a @returns {BallsortContent} */
export const bsContent = (a) => /** @type {BallsortContent} */ (a.content);

/** @param {string} level @param {boolean} random @returns {BallsortBoard} */
export function freshBoard(level, random) {
  return random ? randomBoard(level) : createBoard(level);
}

/** @param {Activity} a @returns {Activity} */
export function ensureContent(a) {
  const c = /** @type {BallsortContent} */ (a.content || (a.content = /** @type {BallsortContent} */ ({})));
  if (!c.level) c.level = 'classic';
  if (!c.mode) c.mode = 'moves';
  if (c.random == null) c.random = true;
  if (!Array.isArray(c.items) || !c.items[0]?.board) {
    c.items = [{ id: 'bs1', board: freshBoard(c.level, c.random), mode: c.mode }];
  }
  // keep item mirrors in sync
  c.items[0].mode = c.mode;
  return a;
}
