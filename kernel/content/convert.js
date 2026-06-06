// Converters between content models — the bridge that lets a teacher switch a
// Quiz into a Match, a Match into a Wheel, etc., keeping the content they
// authored. Best-effort with graceful degradation: a converter returns null
// when it genuinely can't produce valid content, and may drop fields the target
// model can't represent.
//
// Conversion graph (high-confidence only):
//   qa    → pairs     (question→left, answer→right)        Quiz → Match/Memory
//   qa    → entries   (question→entry)                     Quiz → Wheel
//   pairs → qa        (left→question, right→answer+option) Match → Quiz
//   pairs → entries   (left & right → entries)             Match → Wheel
//
// textCorrection has no converters (its data is structurally unique) — switch
// options simply won't offer cross-model targets for it. That's the graceful
// path, not a bug.

function rid(p) { return p + Math.random().toString(36).slice(2, 8); }
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

  'qa->entries'(content) {
    const items = Array.isArray(content?.items) ? content.items : [];
    const out = items.map(it => it.question).filter(nonEmpty).map(String);
    return out.length ? { entries: out } : null;
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

  'pairs->entries'(content) {
    const ps = Array.isArray(content?.pairs) ? content.pairs : [];
    const out = ps.flatMap(p => [p.left, p.right]).filter(nonEmpty).map(String);
    return out.length ? { entries: out } : null;
  },
};

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
