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
import * as diagram from '../../core/contentModels/diagram.js';
import * as itemsModel from '../../core/contentModels/items.js';
import { rid } from '../../core/ids.js';

/** Wrap a leaf validate (returns string[]) into a ValidationResult. */
function wrap(leafValidate) {
  /** @param {Object} content @returns {ValidationResult} */
  return (content) => {
    const errors = leafValidate(content) || [];
    return { ok: errors.length === 0, errors };
  };
}


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
  diagram:        { name: 'diagram',        newEmpty: diagram.newEmpty,        validate: wrap(diagram.validate) },
  // Los tres de abajo no tienen módulo hoja en core/contentModels/ (sus formas
  // viven en la plantilla); el contrato mínimo se define aquí. HUECO que destapó
  // tests/templateContract.test.mjs: estas plantillas declaraban un contentModel
  // NO registrado, así que switchOptions()/el contrato no podían validarlas.
  // Ruleta / Abre Cajas / futuras tarjetas: [{ id, question, image? }] — la hoja
  // (core/contentModels/items.js) también aporta migrateLegacyItems (entries y
  // el campo legado `q` → `question`).
  items: { name: 'items', newEmpty: itemsModel.newEmpty, validate: wrap(itemsModel.validate) },
  words: {
    name: 'words',   // Sopa de Letras: ['GATO', …] · Crucigrama: [{ word, clue, row, col, dir }]
    newEmpty: () => ({ words: [] }),
    validate(content) {
      const errors = [];
      if (!Array.isArray(content?.words)) errors.push('words must be an array');
      return { ok: errors.length === 0, errors };
    }
  },
  ballsort: {
    name: 'ballsort',   // { level, mode, random, items: [{ id, board, mode }] }
    newEmpty: () => ({ level: 'classic', mode: 'moves', random: true, items: [] }),
    validate(content) {
      const errors = [];
      if (!Array.isArray(content?.items)) errors.push('items must be an array');
      return { ok: errors.length === 0, errors };
    }
  },
};

/** @param {string} name @returns {ContentModelContract|null} */
export function getModel(name) { return MODELS[name] || null; }

/** @returns {string[]} */
export function listModelNames() { return Object.keys(MODELS); }
