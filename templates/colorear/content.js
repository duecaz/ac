// EL CONTENIDO DE COLOREAR — qué forma tiene y cómo se deja jugable.
//
// Vive aparte del editor porque lo necesita también el PLAYER: `ensureContent`
// estaba en `editor.js` y el player lo importaba de ahí, así que jugar
// arrastraba el formulario entero (y con él el chasis del editor).
import { rid } from '../../core/ids.js';
import { DIBUJOS } from '../../core/bancoDibujos.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').ColorearContent} ColorearContent
 */

/** La actividad vista como la de ESTA plantilla — `ensureContent` es quien la
 *  deja en esta forma, así que antes de él el contenido puede ser otro.
 *  @param {Activity} a @returns {ColorearContent} */
export function contenidoColorear(a) {
  return /** @type {ColorearContent} */ (a.content);
}

/** Garantiza un ítem con dibujo válido (nunca la actividad nace sin uno).
 *  @param {Activity} a @returns {Activity} */
export function ensureContent(a) {
  const c = /** @type {Partial<ColorearContent>} */ (a.content || (a.content = { items: [] }));
  if (!Array.isArray(c.items) || !c.items[0]?.dibujo) {
    c.items = [{ id: rid('it_'), dibujo: DIBUJOS[0].nombre }];
  }
  return a;
}
