// EL CONTENIDO DE TANGRAM — qué forma tiene y cómo se deja jugable.
//
// Vive aparte del editor porque lo necesita también el PLAYER: `ensureContent`
// estaba en `editor.js` y el player lo importaba de ahí, así que jugar
// arrastraba el formulario entero (y con él el chasis del editor).
import { rid } from '../../core/ids.js';
import { SILUETAS, ORDEN_SILUETAS } from './game/siluetas.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').TangramContent} TangramContent
 */

/** La actividad vista como la de ESTA plantilla: `ensureContent` es justamente
 *  quien la deja en esa forma, así que antes de él el contenido puede ser otro
 *  (o no estar).
 *  @param {Activity} a @returns {TangramContent} */
export function contenidoTangram(a) {
  return /** @type {TangramContent} */ (a.content);
}

/** La actividad SIEMPRE tiene un ítem con figura (nace así, y una figura
 *  desconocida en un JSON tocado a mano cae a la primera del catálogo).
 *  @param {Activity} a @returns {Activity} */
export function ensureContent(a) {
  const c = /** @type {Partial<TangramContent>|null|undefined} */ (a.content);
  if (!c || !Array.isArray(c.items) || !c.items.length) {
    a.content = { items: [{ id: rid('it_'), figura: ORDEN_SILUETAS[0] }] };
  }
  const item = contenidoTangram(a).items[0];
  if (!SILUETAS[item.figura]) item.figura = ORDEN_SILUETAS[0];
  return a;
}
