import { erroresDeLista } from '../../kernel/content/models.js';
// Content model: a flat list of entries. HUÉRFANO: ninguna plantilla lo declara
// como su `contentModel` hoy (Wheel migró a 'items' en templateVersion 2; "Random
// Cards"/"Flashcards" nunca se construyeron). Sigue registrado en
// kernel/content/models.js por si una plantilla futura lo necesita.
/** @returns {import('../../kernel/contracts/activity.js').EntriesContent} */
export function newEmpty() { return { entries: ['', '', '', ''] }; }

/**
 * FRONTERA: le llega cualquier contenido.
 * @param {unknown} content
 * @returns {string[]}
 */
export function validate(content) { return erroresDeLista(content, 'entries'); }
