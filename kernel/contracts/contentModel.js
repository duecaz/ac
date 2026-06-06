// ContentModelContract — the shape of a content model module.
//
// A content model is the *abstract data* a teacher authors (questions, pairs,
// entries, annotated passages). Templates declare which model they consume via
// meta.contentModel. Sharing a model is what makes "switch template in one
// click" (Wordwall-style) possible: any template on the same model can render
// the same content, and converters bridge across models with graceful
// degradation.
//
// Existing model modules (core/contentModels/*) are partial today — some only
// expose isCorrect, others newEmpty/validate. This contract is the target shape
// we normalise them toward in F2; nothing here forces a runtime change.

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} ok
 * @property {string[]} errors  Human-readable problems; empty when ok.
 */

/**
 * @typedef {Object} ContentModelContract
 * @property {string} name                       Model id, e.g. 'qa', 'pairs', 'entries'.
 * @property {() => Object} newEmpty             Factory for a blank, valid content object.
 * @property {(content: Object) => ValidationResult} validate
 * @property {(fromModel: string, content: Object) => boolean} [canConvertFrom]
 *           True if `content` shaped as `fromModel` can become this model.
 * @property {(fromModel: string, content: Object) => (Object|null)} [convertFrom]
 *           Best-effort conversion; returns null when not possible. May drop
 *           fields the target model can't hold (graceful degradation).
 */

export {};
