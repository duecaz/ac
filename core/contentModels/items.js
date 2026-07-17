// Content model `items`: lista plana de entradas con pregunta + imagen opcional.
// Lo usan Ruleta (wheel) y Abre Cajas (question-live) — y cualquier futura
// plantilla de "tarjetas" (flash cards, speaking cards…).
//
// VOCABULARIO RESERVADO (HOW_TO_ADD.md): el texto del ítem se llama `question`
// — igual que en `qa` — para que las conversiones no paguen impuesto de nombres.
// El campo legado `q` (v≤2 de wheel / v1 de question-live) se migra aquí.
import { rid } from '../ids.js';

export function newItem(question = '') { return { id: rid('it_'), question, image: null }; }

export function newEmpty() { return { items: [] }; }

export function validate(content) {
  const errs = [];
  if (!Array.isArray(content?.items)) errs.push('items must be an array');
  return errs;
}

// Migra las DOS formas antiguas a la actual — idempotente (contrato):
//   · entries planas ['a','b']            (wheel templateVersion 1)
//   · ítems con `q` en vez de `question`  (wheel v2 / question-live v1)
export function migrateLegacyItems(content) {
  if (Array.isArray(content?.entries) && !Array.isArray(content?.items)) {
    return { items: content.entries.map(e => newItem(String(e))) };
  }
  if (!Array.isArray(content?.items)) return content;
  let changed = false;
  const items = content.items.map(it => {
    if (typeof it === 'string') { changed = true; return newItem(it); }
    if (it && it.q != null && it.question == null) {
      changed = true;
      const { q, ...rest } = it;
      return { ...rest, question: String(q) };
    }
    return it;
  });
  return changed ? { ...content, items } : content;
}
