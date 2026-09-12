// LO QUE TILDES Y COMAS COMPARTEN COMO PLANTILLA: sus cinco estáticos y el
// payload de una ronda — la fachada de la mecánica «marca sobre el texto».
//
// La mecánica vive partida en cuatro, una responsabilidad por módulo:
//   · core/textCorrectionPasaje.js   — la frase pintada (marcable · corregida · mapa de calor)
//   · core/textCorrectionRonda.js    — la pantalla donde se marca, y el proyector
//   · core/textCorrectionRevision.js — el veredicto palabra por palabra y las anulaciones
//   · core/textCorrectionSolo.js     — el runner de Individual/Tarea
// Aquí solo queda lo que las dos CLASES de plantilla piden por su nombre.
//
//   kind 'tilde' → tap the VOWELS that take an accent.
//   kind 'coma'  → tap the GAP between two words where a comma is missing.
//
// value is number[]: for tildes, the char positions marked; for comas, the
// index of the char AFTER which the comma goes (matches the answer-key `pos`).
import { esObjeto } from './frontera.js';
import { frasesDe } from './contentModels/textCorrection.js';
import { markPartsFor, markValueParts, passageLabel } from './textMarks.js';
import { renderTextCorrectionRound, renderTextCorrectionHost } from './textCorrectionRonda.js';

/** @typedef {import('../kernel/contracts/activity.js').Activity} Activity */
/** @typedef {import('../kernel/contracts/activity.js').Passage} Passage */
/** La marca que se corrige en esta hoja. @typedef {import('./textCorrectionPasaje.js').Marca} Marca */

// El mapa de calor del informe (analítica M5) se pide por esta fachada: quien
// lo pinta (views/itemStatsView.js) habla de «corrección de texto», no de cómo
// esté partida por dentro.
export { textHeatmapHtml } from './textCorrectionPasaje.js';

// Un pasaje = una ronda (comas/tildes, §21b: era el mismo cuerpo tecleado dos
// veces, `getRoundPayload` de comas/template.js y tildes/template.js). La
// clave de respuesta (marks) se QUITA del payload — es lo que viaja al
// alumno.
/**
 * @param {Activity} activity
 * @param {number} itemIndex
 * @returns {{id: string, text: string}|null}
 */
export function passageRoundPayload(activity, itemIndex) {
  const p = frasesDe(activity)[itemIndex];
  return p ? { id: p.id, text: p.text } : null;
}

// ─── LOS MÉTODOS DE UNA PLANTILLA DE CORRECCIÓN ──────────────────────────────
// Tildes y Comas son la MISMA plantilla con otra marca: sus cinco estáticos
// (`renderRound`, `renderRoundHost`, `itemParts`, `valueParts`, `itemLabel`)
// estaban tecleados letra por letra en las dos clases —con los mismos
// comentarios y el mismo estrechamiento de `item`—, y lo único que cambiaba era
// el `kind`. La lógica vive aquí, que es su dueño; en cada clase queda una línea
// que dice QUÉ marca corrige. Dos de las cinco ni eso necesitan: no dependen de
// la marca, así que las dos clases comparten la MISMA función.
//
// Se quedan como métodos de la clase (no como un objeto que se asigna entero)
// a propósito: el contrato y `templateCapability` preguntan por propiedades
// PROPIAS, y el barrido de costuras B2 reconoce el delegado a un identificador
// importado — un objeto fabricado en cada plantilla vuelve a leerse como copia.

// Una frase = una ronda (marcar sobre el texto). `chips` viaja tal cual a la
// ronda (contrato de barra única): quedarse solo con onSubmit era lo que dejaba
// a la vista pintando su fila ENCIMA de la barra de la hoja.
/**
 * @param {Marca} kind
 * @param {Element} root
 * @param {import('../kernel/contracts/session.js').RoundPayload} payload
 * @param {import('../kernel/contracts/template.js').RoundCallbacks} [cbs]
 */
export function rondaDeCorreccion(kind, root, payload, { onSubmit, chips } = {}) {
  return renderTextCorrectionRound(root, payload, { kind, onSubmit, chips });   // devuelve { flush }
}

// Vista de PROYECTOR para el modo en vivo (la frase grande; la solución al
// revelar). Solo la fase y el pasaje: lo demás del contexto del host (payload,
// respuestas) no lo mira una vista de texto. `item` llega como `unknown` (el
// contrato no sabe de qué plantilla es): se estrecha por FORMA.
/**
 * @param {Marca} kind
 * @param {Element} root
 * @param {import('../kernel/contracts/template.js').HostRoundContext} [ctx]
 */
export function proyectorDeCorreccion(kind, root, ctx = {}) {
  renderTextCorrectionHost(root, {
    phase: ctx.phase,
    item: esObjeto(ctx.item) ? /** @type {Passage} */ (ctx.item) : null,
    kind,
  });
}

// Analítica por parte (M1): cada parte = una marca requerida (key=posición,
// label=palabra) → el informe pinta un heatmap sobre el texto con el % de la
// clase que acertó cada una.
/** @param {Marca} kind @param {{item: unknown}} input */
export function partesDeCorreccion(kind, { item }) {
  return markPartsFor(esObjeto(item) ? /** @type {Passage} */ (item) : null, kind);
}

/** Lo que el alumno marcó, en partes. No depende de la marca: las dos
 *  plantillas comparten esta misma función.
 * @param {{value: unknown}} input */
export function valorDeCorreccion({ value }) { return markValueParts(value); }

/** El texto de la frase, para el informe. Tampoco depende de la marca.
 * @param {unknown} item */
export function etiquetaDeCorreccion(item) {
  return passageLabel(esObjeto(item) ? /** @type {Passage} */ (item) : null);
}
