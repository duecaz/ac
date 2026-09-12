// Random wheel: spin, land on one entry. Solo/practice + Live (teacher-scored).
import { BaseTemplate } from '../base.js';
import { renderWheelPlayer } from './player.js';
import { renderWheelEditor } from './editor.js';
import { SPIN_DUR_DEFAULT } from '../../core/ruleta/spin.js';
import { migrateLegacyItems, itemRoundPayload } from '../../core/contentModels/items.js';
import { manualScoreSubmission } from '../../core/liveLoops.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').ItemsContent} ItemsContent
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/session.js').RoundContext} RoundContext
 */

/**
 * Los `rules` que declara ESTA plantilla (`defaultRules`), y de los que es
 * dueña: `ActivityRules` solo describe los cuatro comunes.
 * @typedef {Object} WheelRules
 * @property {number} [spinDurationMs]
 * @property {boolean} [removeAfterSpin]
 * @property {string} [selector]
 */

/** @param {Activity} activity @returns {WheelRules} */
export const wheelRules = (activity) => /** @type {WheelRules} */ (activity.rules || {});

export class WheelTemplate extends BaseTemplate {
  /** @type {import('../../kernel/contracts/template.js').TemplateMeta<ItemsContent>} */
  static meta = {
    name: 'wheel',
    label: 'Ruleta',
    icon: 'bi-bullseye',
    color: 'success',
    kind:            'ejercicio',   // familia (norte §4c): quién pone el contenido
    contentModel: 'items',
    templateVersion: 3,   // v3: campo `q` → `question` (vocabulario reservado)
    // El EDITOR se declara aquí (§0: la vista no conoce plantillas concretas):
    // `elemento` es lo que el profe AÑADE y `primerPaso` lo que se lee con la
    // actividad vacía — es lo que enseña, en vez de contenido de muestra que
    // hay que borrar antes de empezar (R-D).
    editor: { elemento: 'opción', primerPaso: 'Pulsa «Añadir opción» y escribe cada casilla de la ruleta.' },
    instructions: 'Gira la ruleta y responde la pregunta que toque.',
    aspectRatio: '1/1',
    modes: { solo: true, live: true, async: false },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'none', teams: 'none', live: ['claim'] , reloj: { unidad: null, crono: false } },
    // `selector: 'wheel'` es la DECLARACIÓN de que esta actividad usa la ruleta
    // para elegir turno (§0): antes la vista lo deducía del NOMBRE de la
    // plantilla. `normalize()` lo rellena también en las actividades ya
    // guardadas, así que las salas antiguas siguen girando la ruleta.
    defaultRules: () => ({ spinDurationMs: SPIN_DUR_DEFAULT, removeAfterSpin: false, selector: 'wheel' }),
    defaultScoring: () => ({}),
    defaultLive: () => ({}),
    defaultContent: () => ({
      items: [
        { question: 'Opción 1', image: null },
        { question: 'Opción 2', image: null },
        { question: 'Opción 3', image: null },
        { question: 'Opción 4', image: null },
      ]
    })
  };
  static renderPlayer = renderWheelPlayer;
  static renderEditor = renderWheelEditor;
  // v1 entries planas y v2 `q` → forma actual {id, question, image} (hoja compartida).
  /**
   * @param {import('../../kernel/contracts/activity.js').ActivityContent} content
   * @returns {ItemsContent}
   */
  static migrateContent(content) {
    return migrateLegacyItems(/** @type {import('../../core/contentModels/items.js').ItemsContentLegado} */ (content));
  }
  // Required by the registry for live-capable templates.
  // Wheel Live uses manual teacher scoring, so these are not called in game,
  // but must exist to pass validation.
  /**
   * @param {Activity} activity
   * @param {RoundContext} ctx
   */
  static getRoundPayload(activity, { itemIndex }) {
    return itemRoundPayload(/** @type {import('../../kernel/contracts/activity.js').Activity<ItemsContent>} */ (activity), itemIndex);
  }
  static scoreSubmission = manualScoreSubmission;

}
