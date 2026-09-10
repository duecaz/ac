// Content model `items`: lista plana de entradas con pregunta + imagen opcional.
// Lo usan Ruleta (wheel) y Abre Cajas (question-live) — y cualquier futura
// plantilla de "tarjetas" (flash cards, speaking cards…).
//
// VOCABULARIO RESERVADO (HOW_TO_ADD.md): el texto del ítem se llama `question`
// — igual que en `qa` — para que las conversiones no paguen impuesto de nombres.
// El campo legado `q` (v≤2 de wheel / v1 de question-live) se migra aquí.
import { rid } from '../ids.js';
import { erroresDeLista } from '../../kernel/content/models.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').CardItem} CardItem
 * @typedef {import('../../kernel/contracts/activity.js').ItemsContent} ItemsContent
 */

/**
 * Una tarjeta tal y como puede venir del contenido VIEJO: sin `id`, con el
 * texto en `q` en vez de en `question`. Es la entrada de la migración.
 * @typedef {Object} CardItemLegado
 * @property {string} [id]
 * @property {string} [question]
 * @property {string} [q]
 * @property {string|null} [image]
 */
/**
 * @typedef {Object} ItemsContentLegado
 * @property {Array<CardItemLegado|string>} [items]
 * @property {unknown[]} [entries]
 */

/** @returns {CardItem} */
export function newItem(question = '') { return { id: rid('it_'), question, image: null }; }

/** @returns {ItemsContent} */
export function newEmpty() { return { items: [] }; }

/**
 * FRONTERA: le llega cualquier contenido.
 * @param {unknown} content
 * @returns {string[]}
 */
export function validate(content) { return erroresDeLista(content, 'items'); }

// Migra las DOS formas antiguas a la actual — idempotente (contrato):
//   · entries planas ['a','b']            (wheel templateVersion 1)
//   · ítems con `q` en vez de `question`  (wheel v2 / question-live v1)
// Un ítem = una ronda (question-live/wheel, §21b: era el mismo cuerpo
// tecleado dos veces, `getRoundPayload` de question-live/template.js y
// wheel/template.js — los dos declaran el bucle `claim`, §26: puntúa el
// docente a mano, sin clave de respuesta).
// ANSWER-SAFETY (R5): whitelist de campos de PANTALLA — nunca el ítem crudo.
// El modelo `items` hoy no guarda clave de respuesta, pero un passthrough
// filtraría cualquier campo que un contenido importado traiga de más.
/**
 * @param {import('../../kernel/contracts/activity.js').Activity<ItemsContent>} activity
 * @param {number} itemIndex
 * @returns {import('../../kernel/contracts/session.js').RoundPayload|null}
 */
export function itemRoundPayload(activity, itemIndex) {
  const it = activity.content?.items?.[itemIndex];
  return it ? { id: it.id, question: it.question, image: it.image || null } : null;
}

/**
 * @param {ItemsContentLegado|null|undefined} content
 * @returns {ItemsContent}   Tras la migración el contenido YA tiene la forma actual.
 */
export function migrateLegacyItems(content) {
  const entries = content?.entries;
  if (Array.isArray(entries) && !Array.isArray(content?.items)) {
    return { items: entries.map(e => newItem(String(e))) };
  }
  const previos = content?.items;
  if (!Array.isArray(previos)) return /** @type {ItemsContent} */ (content);
  let changed = false;
  const items = previos.map(it => {
    if (typeof it === 'string') { changed = true; return newItem(it); }
    if (it && it.q != null && it.question == null) {
      changed = true;
      const { q, ...rest } = it;
      return { ...rest, question: String(q) };
    }
    return it;
  });
  return /** @type {ItemsContent} */ (changed ? { ...content, items } : content);
}
