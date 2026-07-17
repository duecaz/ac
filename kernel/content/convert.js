// Converters between content models — the bridge that lets a teacher switch a
// Quiz into a Match, a Match into a Wheel, etc., keeping the content they
// authored. Best-effort with graceful degradation: a converter returns null
// when it genuinely can't produce valid content, and may drop fields the target
// model can't represent.
//
// Conversion graph (high-confidence only):
//   qa    → pairs   (question→left, answer→right)        Quiz/Math → Match/Memory
//   qa    → items   (question→q, conserva image)         Quiz/Math → Ruleta/Abre Cajas
//   pairs → qa      (left→question, right→answer+option) Match → Quiz
//   pairs → items   (left y right → entradas)            Match → Ruleta/Abre Cajas
//
// REGLA: todo conversor apunta a un modelo usado por ≥1 plantilla VIVA (lo
// verifica tests/content.test.mjs). Los antiguos `→ entries` se retiraron
// cuando la Ruleta migró entries→items (templateVersion 2): apuntaban a un
// modelo huérfano, así que Quiz→Ruleta dejó de ofrecerse EN SILENCIO — este
// check existe para que eso no vuelva a pasar.
//
// textCorrection has no converters (its data is structurally unique) — switch
// options simply won't offer cross-model targets for it. That's the graceful
// path, not a bug.
import { rid } from '../../core/ids.js';

const nonEmpty = (s) => String(s ?? '').trim() !== '';

/** @type {Record<string, (content: Object) => (Object|null)>} */
const CONVERTERS = {
  'qa->pairs'(content) {
    const items = Array.isArray(content?.items) ? content.items : [];
    const out = items
      .filter(it => nonEmpty(it.question) && nonEmpty(it.answer))
      .map(it => ({ id: rid('p_'), left: String(it.question), right: String(it.answer) }));
    return out.length ? { pairs: out } : null;
  },

  // Ruleta / Abre Cajas: ítems {id, q, image}. Se conserva la imagen del qa.
  'qa->items'(content) {
    const items = Array.isArray(content?.items) ? content.items : [];
    const out = items
      .filter(it => nonEmpty(it.question))
      .map(it => ({ id: rid('it_'), q: String(it.question), image: it.image ?? null }));
    return out.length ? { items: out } : null;
  },

  'pairs->qa'(content) {
    const ps = Array.isArray(content?.pairs) ? content.pairs : [];
    const valid = ps.filter(p => nonEmpty(p.left) && nonEmpty(p.right));
    if (!valid.length) return null;
    const allRights = valid.map(p => String(p.right));
    const items = valid.map(p => {
      const answer = String(p.right);
      // Distractors: up to 3 other distinct rights.
      const distractors = allRights.filter(r => r !== answer).slice(0, 3);
      return { id: rid('q_'), question: String(p.left), answer, options: [answer, ...distractors], points: 1, image: null, audio: null };
    });
    return { items };
  },

  // Cada lado del par se vuelve una entrada de la ruleta (conserva su imagen).
  'pairs->items'(content) {
    const ps = Array.isArray(content?.pairs) ? content.pairs : [];
    const out = ps.flatMap(p => [
      nonEmpty(p.left) ? { id: rid('it_'), q: String(p.left), image: p.leftImage ?? p.image ?? null } : null,
      nonEmpty(p.right) ? { id: rid('it_'), q: String(p.right), image: p.rightImage ?? null } : null,
    ]).filter(Boolean);
    return out.length ? { items: out } : null;
  },
};

/** Claves 'from->to' del grafo — para el check de "modelos vivos" del test. */
export function converterKeys() { return Object.keys(CONVERTERS); }

/** @returns {boolean} */
export function canConvert(fromModel, toModel) {
  if (fromModel === toModel) return true;
  return (`${fromModel}->${toModel}`) in CONVERTERS;
}

/**
 * Convert content from one model to another. Identity when models match.
 * @returns {Object|null} converted content, or null if not possible.
 */
export function convert(fromModel, toModel, content) {
  if (fromModel === toModel) return content;
  const fn = CONVERTERS[`${fromModel}->${toModel}`];
  return fn ? fn(content) : null;
}

/** @returns {string[]} target model names reachable from `fromModel` (excludes self). */
export function convertibleTargets(fromModel) {
  return Object.keys(CONVERTERS)
    .filter(k => k.startsWith(fromModel + '->'))
    .map(k => k.split('->')[1]);
}
