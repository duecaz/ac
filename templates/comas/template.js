// Comas: drop a comma in the right spot of the sentence. Sibling of Tildes,
// shares the textCorrection content model so they appear as 'switch
// templates' for each other on the activity page.
import { BaseTemplate } from '../base.js';
import { renderComasPlayer } from './player.js';
import { renderComasEditor } from './editor.js';
import { newPassage } from '../../core/contentModels/textCorrection.js';
import { parseTextWithCommas, markPartsFor, markValueParts, passageLabel } from '../../core/textMarks.js';
import { renderTextCorrectionRound, renderTextCorrectionHost, textCorrectionPreviewHtml, passageRoundPayload } from '../../core/textCorrectionRound.js';
import { scoreComasSubmission } from './scorer.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').TextCorrectionContent} TextCorrectionContent
 * @typedef {import('../../kernel/contracts/activity.js').Passage} Passage
 * @typedef {import('../../kernel/contracts/session.js').RoundContext} RoundContext
 * @typedef {import('../../kernel/contracts/session.js').RoundPayload} RoundPayload
 * @typedef {import('../../kernel/contracts/template.js').RoundCallbacks} RoundCallbacks
 * @typedef {import('../../kernel/contracts/template.js').HostRoundContext} HostRoundContext
 */

/** @param {unknown} v @returns {v is object} */
const esObjeto = (v) => !!v && typeof v === 'object';

export class ComasTemplate extends BaseTemplate {
  /** @type {import('../../kernel/contracts/template.js').TemplateMeta<TextCorrectionContent>} */
  static meta = {
    name: 'comas',
    label: 'Comas',
    icon: 'bi-cursor-text',
    color: 'success',
    kind:            'ejercicio',   // familia (norte §4c): quién pone el contenido
    contentModel: 'textCorrection',
    markNoun:        'coma',   // lo que el alumno marca (informes) — §26: la plantilla lo DECLARA
    templateVersion: 1,
    paginated: true,   // una frase por pantalla → nº de páginas = nº de frases
    // El EDITOR se declara aquí (§0: la vista no conoce plantillas concretas):
    // `elemento` es lo que el profe AÑADE y `primerPaso` lo que se lee con la
    // actividad vacía — es lo que enseña, en vez de contenido de muestra que
    // hay que borrar antes de empezar (R-D).
    editor: { elemento: 'frase', primerPaso: 'Pulsa «Añadir frase» y escribe una oración; luego marca dónde va cada coma.' },
    instructions: 'Dibuja la coma (,) en el hueco donde falta. Cuando termines, pulsa “Listo” para corregir.',
    panelFit: 'fill',    // el texto llena el panel y se escala para caber
    aspectRatio: '16/10',
    modes: { solo: true, live: true, async: true },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    // Se juega MARCANDO sobre un texto, así que en una pizarra interactiva
    // conviene calibrar el lápiz antes de empezar. Lo DECLARA la plantilla: la
    // pantalla de inicio preguntaba «¿te llamas tildes o comas?», que es la ley
    // §0 al revés (un modo no conoce plantillas concretas).
    seMarcaConLapiz: true,
    play:            { vs: 'points', teams: 'turns', live: ['rounds', 'race'], submit: 'boton' , reloj: { unidad: 'frase' } },
    // `allowOverflow` se quitó (barrido B1, 2026-09-02): prometido sin
    // mecánica — el tope de marcas nunca se implementó, decisión del dueño.
    defaultRules: () => ({ timer: 30, randomize: false }),
    // DIEZ POR MARCA, no uno (dueño 2026-08-27, comparando con la app anterior:
    // «cada tilde es 10 puntos por defecto»). En una pizarra a tres metros, 20 y
    // 120 se leen y 2 y 12 no. Solo cambia el DEFECTO de las actividades nuevas:
    // las que ya existen llevan su `pointsPerCorrect` guardado y el editor tiene
    // el campo «Puntos por acierto», así que un 1 almacenado puede ser una
    // decisión del profe — migrarlo sería pisarle el contenido (§24).
    defaultScoring: () => ({ pointsPerCorrect: 10, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => {
      const examples = [
        'Hola, ¿cómo estás?',
        'Fui al parque, compré frutas y regresé a casa.',
        'Mi madre, mi padre y yo fuimos a la playa.',
      ];
      return { passages: examples.map(s => ({ ...newPassage(), ...parseTextWithCommas(s) })) };
    },
    defaultPresentation: () => ({ skin: 'default', background: 'notebook' })
  };
  static renderPlayer = renderComasPlayer;
  static renderEditor = renderComasEditor;
  static scoreSubmission = scoreComasSubmission;


  // One passage = one round. The answer key (marks) is stripped from the payload.
  /**
   * @param {import('../../kernel/contracts/activity.js').Activity} activity
   * @param {RoundContext} ctx
   * @returns {RoundPayload|null}
   */
  static getRoundPayload(activity, ctx) { return passageRoundPayload(activity, ctx.itemIndex); }

  // One passage = one round (tap the gap where a comma is missing). Shared renderer.
  // `chips` viaja tal cual a la ronda (contrato de barra única): quedarse solo
  // con onSubmit era lo que dejaba a la vista pintando su fila ENCIMA de la
  // barra de la hoja — las dos barras de la captura del dueño.
  /**
   * @param {Element} root
   * @param {RoundPayload} payload
   * @param {RoundCallbacks} [cbs]
   */
  static renderRound(root, payload, { onSubmit, chips } = {}) {
    return renderTextCorrectionRound(root, payload, { kind: 'coma', onSubmit, chips });   // devuelve { flush }
  }

  // Projector view for LIVE (passage big; solution on reveal).
  /**
   * @param {Element} root
   * @param {HostRoundContext} [ctx]
   */
  static renderRoundHost(root, ctx = {}) {
    // Solo la fase y el pasaje: lo demás del contexto del host (payload,
    // respuestas) no lo mira la vista de proyector de texto.
    renderTextCorrectionHost(root, {
      phase: ctx.phase,
      item: esObjeto(ctx.item) ? /** @type {Passage} */ (ctx.item) : null,
      kind: 'coma',
    });
  }

  // Analítica por parte (M1): cada parte = una coma requerida (key=posición,
  // label=palabra) → heatmap por el % de la clase que acertó cada coma.
  // `item` llega como `unknown` (el contrato no sabe de qué plantilla es): se
  // estrecha por FORMA antes de dárselo al primitivo de marcas.
  /** @param {{item: unknown}} input */
  static itemParts({ item }) {
    return markPartsFor(esObjeto(item) ? /** @type {Passage} */ (item) : null, 'coma');
  }
  /** @param {{value: unknown}} input */
  static valueParts({ value }) { return markValueParts(value); }
  /** @param {unknown} item */
  static itemLabel(item) {
    return passageLabel(esObjeto(item) ? /** @type {Passage} */ (item) : null);
  }
}
