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

/** CON QUÉ PARTIDA NACE un rompecabezas: la casa, en 2×2 (cuatro piezas es lo
 *  que resuelve sin ayuda quien todavía no lee).
 *  @returns {PuzzleItem} */
export const PUZZLE_POR_DEFECTO = () => ({ id: rid('it_'), dibujo: 'casa', filas: 2, columnas: 2 });

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
