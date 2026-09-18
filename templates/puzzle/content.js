// EL CONTENIDO DE ROMPECABEZAS — qué forma tiene y cómo se deja jugable.
//
// Vive aparte del editor porque lo necesita también el PLAYER: `ensureContent`
// estaba en `editor.js` y jugar arrastraba el formulario entero detrás. Y la
// PARTIDA POR DEFECTO estaba tecleada CUATRO veces —`defaultContent` de la
// plantilla, el `ensureContent` del editor (dos: el ítem entero y el dibujo
// suelto) y el respaldo del player—: cuatro sitios para un mismo dato que
// tienen que decir lo mismo o el juego arranca con un dibujo y el editor con
// otro.
import { rid } from '../../core/ids.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').PuzzleContent} PuzzleContent
 * @typedef {import('../../kernel/contracts/activity.js').PuzzleItem} PuzzleItem
 */

/** CON QUÉ PARTIDA NACE un rompecabezas: la casa, en 3×3. Nacía en 2×2 «porque
 *  cuatro piezas las resuelve quien no lee», pero con cuatro el juego se acaba
 *  en dos gestos y aburre; nueve es el punto medio de los referentes (6-12) y,
 *  con el recorte del aire (v1.51.710), ya no deja ninguna pieza en blanco. La
 *  opción de partida «Fácil» sigue ofreciendo 2×2 (dueño, 2026-09-18).
 *  @returns {PuzzleItem} */
export const PUZZLE_POR_DEFECTO = () => ({ id: rid('it_'), dibujo: 'casa', filas: 3, columnas: 3 });

/** La actividad vista como la de ESTA plantilla — `ensureContent` es quien la
 *  deja en esta forma, así que antes de él el contenido puede ser otro.
 *  @param {Activity} a @returns {PuzzleContent} */
export function contenidoPuzzle(a) {
  return /** @type {PuzzleContent} */ (a.content);
}

/** @param {Activity} a @returns {Activity} */
export function ensureContent(a) {
  const c = /** @type {Partial<PuzzleContent>} */ (a.content || (a.content = { items: [] }));
  if (!Array.isArray(c.items) || !c.items[0]) c.items = [PUZZLE_POR_DEFECTO()];
  const it = c.items[0];
  const def = PUZZLE_POR_DEFECTO();
  if (!it.filas) it.filas = def.filas;
  if (!it.columnas) it.columnas = def.columnas;
  if (!it.dibujo) it.dibujo = def.dibujo;
  return a;
}
