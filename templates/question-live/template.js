import { BaseTemplate } from '../base.js';
import { renderQuestionLiveEditor } from './editor.js';
import { renderQuestionLivePlayer } from './player.js';
import { newItem, migrateLegacyItems, itemRoundPayload } from '../../core/contentModels/items.js';
import { manualScoreSubmission } from '../../core/liveLoops.js';


/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').ActivityContent} ActivityContent
 * @typedef {import('../../kernel/contracts/activity.js').ItemsContent} ItemsContent
 * @typedef {import('../../kernel/contracts/session.js').RoundContext} RoundContext
 * @typedef {import('../../kernel/contracts/session.js').RoundPayload} RoundPayload
 */

export class QuestionLiveTemplate extends BaseTemplate {
  /** @type {import('../../kernel/contracts/template.js').TemplateMeta<ItemsContent>} */
  static meta = {
    name: 'question-live',
    label: 'Abre Cajas',
    icon: 'bi-grid-3x3-gap-fill',
    color: 'warning',
    kind:            'ejercicio',   // familia (norte §4c): quién pone el contenido
    contentModel: 'items',
    templateVersion: 2,   // v2: campo `q` → `question` (vocabulario reservado)
    // El EDITOR se declara aquí (§0: la vista no conoce plantillas concretas):
    // `elemento` es lo que el profe AÑADE y `primerPaso` lo que se lee con la
    // actividad vacía — es lo que enseña, en vez de contenido de muestra que
    // hay que borrar antes de empezar (R-D).
    editor: { elemento: 'pregunta', primerPaso: 'Pulsa «Añadir pregunta» y escribe lo que preguntarás en clase; los puntos los pones tú al responder.' },
    instructions: 'Espera tu turno: cuando salga tu pregunta, respóndela como indique el docente.',
    aspectRatio: '4/3',
    modes: { solo: true, live: true, async: false },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'none', teams: 'none', live: ['claim'] , reloj: { unidad: null, crono: false } },
    defaultRules: () => ({ selector: 'boxes' }),
    defaultScoring: () => ({}),
    defaultLive: () => ({}),
    defaultContent: () => ({
      items: [
        newItem('¿Cuál es la capital de Francia?'),
        newItem('¿Cuánto es 8 × 7?'),
        newItem('¿Quién escribió el Quijote?'),
        newItem('¿Cuál es el río más largo del mundo?'),
        newItem('¿En qué año llegó Colón a América?'),
        newItem('¿Cuál es el planeta más grande del sistema solar?'),
      ]
    })
  };
  static renderPlayer = renderQuestionLivePlayer;
  static renderEditor = renderQuestionLiveEditor;
  // v1 usaba `q`; la hoja compartida lo migra a `question` (idempotente).
  /**
   * @param {ActivityContent} content
   * @returns {ActivityContent}
   */
  static migrateContent(content) {
    return migrateLegacyItems(/** @type {ItemsContent} */ (content));
  }

  // Required by the registry for live-capable templates.
  // Question Live uses manual teacher scoring, so these are not called in game,
  // but must exist to pass validation.
  /**
   * @param {Activity} activity
   * @param {RoundContext} ctx
   * @returns {RoundPayload|null}
   */
  static getRoundPayload(activity, { itemIndex }) {
    return itemRoundPayload(/** @type {import('../../kernel/contracts/activity.js').Activity<ItemsContent>} */ (activity), itemIndex);
  }
  static scoreSubmission = manualScoreSubmission;

}
