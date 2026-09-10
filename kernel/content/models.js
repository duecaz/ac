// Central, normalised registry of content models. Wraps the existing leaf
// modules in core/contentModels/* (which have inconsistent surfaces — some only
// expose isCorrect, others newEmpty/validate) into one ContentModelContract
// shape: { name, newEmpty(), validate() -> {ok, errors} }.
//
// Leaf modules stay where they are (templates already import them); this layer
// adapts without moving. Pure — safe to import in Node.

/**
 * @typedef {import('../contracts/contentModel.js').ContentModelContract} ContentModelContract
 * @typedef {import('../contracts/contentModel.js').ValidationResult} ValidationResult
 */

import * as pairs from '../../core/contentModels/pairs.js';
import * as entries from '../../core/contentModels/entries.js';
import * as textCorrection from '../../core/contentModels/textCorrection.js';
import * as diagram from '../../core/contentModels/diagram.js';
import * as itemsModel from '../../core/contentModels/items.js';
import { rid } from '../../core/ids.js';

/**
 * Wrap a leaf validate (returns string[]) into a ValidationResult.
 * @param {(content: unknown) => (string[]|undefined)} leafValidate
 * @returns {(content: unknown) => ValidationResult}
 */
function wrap(leafValidate) {
  return (content) => {
    const errors = leafValidate(content) || [];
    return { ok: errors.length === 0, errors };
  };
}

/**
 * FRONTERA: a `validate` le puede llegar cualquier cosa (un JSON importado, una
 * fila del backend, contenido de otra plantilla), así que la lista se lee
 * estrechando, no accediendo a ciegas.
 * @param {unknown} content
 * @param {string} key
 * @returns {unknown[]|null} el array, o `null` si esa clave no lo es.
 */
function listaDe(content, key) {
  if (!content || typeof content !== 'object') return null;
  const v = /** @type {Record<string, unknown>} */ (content)[key];
  return Array.isArray(v) ? v : null;
}

/** Los errores de «la clave K tiene que ser una lista»: UNA redacción para los
 *  validadores de `core/contentModels/*` (eran cinco copias del mismo cuerpo).
 * @param {unknown} content
 * @param {string} key
 * @returns {string[]} */
export function erroresDeLista(content, key) {
  return listaDe(content, key) ? [] : [`${key} must be an array`];
}


/** @type {Record<string, ContentModelContract>} */
export const MODELS = {
  // qa's leaf module only exposes isCorrect; define the contract surface here.
  qa: {
    name: 'qa',
    // SIN `points`: sembrarlo con 1 hacía que el ítem ganara siempre a «Puntos
    // por acierto» del panel (core/contentModels/qa.js · stripSeededPoints).
    // Ausente = vale lo que diga la actividad; el editor de Quiz lo escribe
    // solo si el profe pone otra cosa.
    newEmpty: () => ({ items: [{ id: rid('q_'), question: '', answer: '', options: ['', '', '', ''], image: null, audio: null }] }),
    validate(content) {
      /** @type {string[]} */
      const errors = [];
      const items = listaDe(content, 'items');
      if (!items) errors.push('items must be an array');
      else if (items.length === 0) errors.push('needs at least one item');
      return { ok: errors.length === 0, errors };
    }
  },
  pairs:          { name: 'pairs',          newEmpty: pairs.newEmpty,          validate: wrap(pairs.validate) },
  entries:        { name: 'entries',        newEmpty: entries.newEmpty,        validate: wrap(entries.validate) },
  textCorrection: { name: 'textCorrection', newEmpty: textCorrection.newEmpty, validate: wrap(textCorrection.validate) },
  diagram:        { name: 'diagram',        newEmpty: diagram.newEmpty,        validate: wrap(diagram.validate) },
  // DE AQUÍ ABAJO, los modelos SIN módulo hoja en core/contentModels/: su forma
  // vive en la plantilla y aquí se define el contrato mínimo (`name`,
  // `newEmpty`, `validate`). Son los de contenido GENERADO —el tablero de
  // Pelotas, el dibujo/figura de los juegos de inicial—, donde no hay nada que
  // el docente escriba y por tanto nada que un módulo de edición compartido
  // pueda aportar. HUECO que destapó tests/templateContract.test.mjs: estas
  // plantillas declaraban un contentModel NO registrado, así que
  // switchOptions()/el contrato no podían validarlas.
  // (`items` SÍ tiene hoja propia y va justo abajo: no entra en esta nota — el
  //  comentario decía «los tres de abajo» y llevaba versiones señalando mal.)
  // Ruleta / Abre Cajas / futuras tarjetas: [{ id, question, image? }] — la hoja
  // (core/contentModels/items.js) también aporta migrateLegacyItems (entries y
  // el campo legado `q` → `question`).
  items: { name: 'items', newEmpty: itemsModel.newEmpty, validate: wrap(itemsModel.validate) },
  words: {
    name: 'words',   // Sopa de Letras: ['GATO', …] · Crucigrama: [{ word, clue, row, col, dir }]
    newEmpty: () => ({ words: [] }),
    validate(content) {
      /** @type {string[]} */
      const errors = [];
      if (!listaDe(content, 'words')) errors.push('words must be an array');
      return { ok: errors.length === 0, errors };
    }
  },
  ballsort: {
    name: 'ballsort',   // { level, mode, random, items: [{ id, board, mode }] }
    newEmpty: () => ({ level: 'classic', mode: /** @type {'moves'} */ ('moves'), random: true, items: [] }),
    validate(content) {
      /** @type {string[]} */
      const errors = [];
      if (!listaDe(content, 'items')) errors.push('items must be an array');
      return { ok: errors.length === 0, errors };
    }
  },
  // LOS TRES JUEGOS DE INICIAL (docs/handoff-juegos-inicial.md). Son JUEGOS
  // (norte §4c): el contenido lo trae la app, así que el «contenido» de la
  // actividad es solo QUÉ nivel se juega — un dibujo del banco compartido
  // (`assets/juegos/dibujos`) o una silueta del catálogo del tangram.
  colorear: {
    name: 'colorear',   // { items: [{ id, dibujo }] } — dibujo: nombre en el banco
    newEmpty: () => ({ items: [] }),
    validate(content) {
      /** @type {string[]} */
      const errors = [];
      if (!listaDe(content, 'items')) errors.push('items must be an array');
      return { ok: errors.length === 0, errors };
    }
  },
  tangram: {
    name: 'tangram',    // { items: [{ id, figura }] } — figura: nombre de la silueta
    newEmpty: () => ({ items: [] }),
    validate(content) {
      /** @type {string[]} */
      const errors = [];
      if (!listaDe(content, 'items')) errors.push('items must be an array');
      return { ok: errors.length === 0, errors };
    }
  },
  puzzle: {
    name: 'puzzle',     // { items: [{ id, dibujo, filas, columnas }] }
    newEmpty: () => ({ items: [] }),
    validate(content) {
      /** @type {string[]} */
      const errors = [];
      if (!listaDe(content, 'items')) errors.push('items must be an array');
      return { ok: errors.length === 0, errors };
    }
  },
};

/** @param {string} name @returns {ContentModelContract|null} */
export function getModel(name) { return MODELS[name] || null; }

/** @returns {string[]} */
export function listModelNames() { return Object.keys(MODELS); }
