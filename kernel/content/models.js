// Central, normalised registry of content models. Wraps the existing leaf
// modules in core/contentModels/* (which have inconsistent surfaces — some only
// expose isCorrect, others newEmpty/validate) into one ContentModelContract
// shape: { name, newEmpty(), validate() -> {ok, errors} }.
//
// Leaf modules stay where they are (templates already import them); this layer
// adapts without moving. Pure — safe to import in Node.
//
// @typedef {import('../contracts/contentModel.js').ContentModelContract} ContentModelContract
// @typedef {import('../contracts/contentModel.js').ValidationResult} ValidationResult

import * as pairs from '../../core/contentModels/pairs.js';
import * as entries from '../../core/contentModels/entries.js';
import * as textCorrection from '../../core/contentModels/textCorrection.js';

/** Wrap a leaf validate (returns string[]) into a ValidationResult. */
function wrap(leafValidate) {
  /** @param {Object} content @returns {ValidationResult} */
  return (content) => {
    const errors = leafValidate(content) || [];
    return { ok: errors.length === 0, errors };
  };
}

function rid(p) { return p + Math.random().toString(36).slice(2, 8); }

/** @type {Record<string, ContentModelContract>} */
export const MODELS = {
  // qa's leaf module only exposes isCorrect; define the contract surface here.
  qa: {
    name: 'qa',
    newEmpty: () => ({ items: [{ id: rid('q_'), question: '', answer: '', options: ['', '', '', ''], points: 1, image: null, audio: null }] }),
    validate(content) {
      const errors = [];
      if (!Array.isArray(content?.items)) errors.push('items must be an array');
      else if (content.items.length === 0) errors.push('needs at least one item');
      return { ok: errors.length === 0, errors };
    }
  },
  pairs:          { name: 'pairs',          newEmpty: pairs.newEmpty,          validate: wrap(pairs.validate) },
  entries:        { name: 'entries',        newEmpty: entries.newEmpty,        validate: wrap(entries.validate) },
  textCorrection: { name: 'textCorrection', newEmpty: textCorrection.newEmpty, validate: wrap(textCorrection.validate) },
};

/** @param {string} name @returns {ContentModelContract|null} */
export function getModel(name) { return MODELS[name] || null; }

/** @returns {string[]} */
export function listModelNames() { return Object.keys(MODELS); }
