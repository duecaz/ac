/** Lo que el contrato entrega como `unknown`, leído como el ítem `qa` que esta
 *  plantilla sí conoce. Dueño único de ese estrechamiento: lo piden la vista de
 *  proyector (hostView.js) y la analítica por partes (template.js), y escrito
 *  dos veces acabarían tolerando cosas distintas.
 * @param {unknown} item
 * @returns {import('../../kernel/contracts/activity.js').QaItem|null}
 */
export function comoQaItem(item) {
  if (!item || typeof item !== 'object') return null;
  return /** @type {import('../../kernel/contracts/activity.js').QaItem} */ (item);
}
