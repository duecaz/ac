import { stripSeededPoints } from '../../core/contentModels/qa.js';
import { BaseTemplate } from '../base.js';
import { renderMathPlayer } from './player.js';
import { renderMathEditor } from './editor.js';
import { renderKeypadRound } from '../../core/roundRender.js';
import { scoreMathSubmission } from './scorer.js';
import { adoptForMath } from '../../kernel/content/qaAdapt.js';
import { escapeHtml } from '../../core/html.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').QaContent} QaContent
 */

export class MathTemplate extends BaseTemplate {
  /** @type {import('../../kernel/contracts/template.js').TemplateMeta<QaContent>} */
  static meta = {
    name: 'math',
    label: 'Operaciones',
    icon: 'bi-calculator-fill',
    color: 'warning',
    kind:            'ejercicio',   // familia (norte §4c): quién pone el contenido
    contentModel: 'qa',
    templateVersion: 2,
    paginated: true,   // una operación por pantalla → nº de páginas = nº de ítems
    // El EDITOR se declara aquí (§0: la vista no conoce plantillas concretas):
    // `elemento` es lo que el profe AÑADE y `primerPaso` lo que se lee con la
    // actividad vacía — es lo que enseña, en vez de contenido de muestra que
    // hay que borrar antes de empezar (R-D).
    editor: { elemento: 'operación', primerPaso: 'Pulsa «Generar» para crear operaciones de golpe, o «Añadir operación» para escribirlas tú.' },
    instructions: 'Resuelve cada operación y escribe el resultado con el teclado.',
    panelFit: 'block',   // el teclado es UN bloque: no se estira en el panel VS
    aspectRatio: '16/10',
    modes: { solo: true, live: true, async: true },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'race', teams: 'turns', live: ['rounds', 'race'], retry: true, submit: 'boton' , reloj: { unidad: 'operación' } },
    defaultRules: () => ({ timer: 30, randomize: true }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => ({ items: [
      { id: 'm1', question: '2 × 6', answer: '12' },
      { id: 'm2', question: '2 × 7', answer: '14' },
      { id: 'm3', question: '3 × 4', answer: '12' },
      { id: 'm4', question: '5 × 3', answer: '15' },
    ] }),
  };
  static renderPlayer = renderMathPlayer;
  static renderEditor = renderMathEditor;
  static scoreSubmission = scoreMathSubmission;

  /**
   * @param {import('../../kernel/contracts/activity.js').Activity} activity
   * @param {import('../../kernel/contracts/session.js').RoundContext} ctx
   * @returns {import('../../kernel/contracts/session.js').RoundPayload|null}
   */
  static getRoundPayload(activity, ctx) {
    const content = /** @type {QaContent} */ (activity.content);
    const it = content.items[ctx.itemIndex];
    return it ? { question: it.question } : null;
  }

  /**
   * @param {Element} root
   * @param {import('../../kernel/contracts/session.js').RoundPayload} payload
   * @param {import('../../kernel/contracts/template.js').RoundCallbacks} [opts]
   * @returns {void}
   */
  static renderRound(root, payload, opts) { return renderKeypadRound(root, payload, opts); }
  // v1→v2: fuera el `points: 1` sembrado, que anulaba «Puntos por acierto»
  // del panel (el profe ponía 10 y el duelo seguía dando 1).
  // La firma es la IDENTIDAD sobre la forma, como la de `templates/base.js`: el
  // contenido entra tal y como lo tenga la actividad, y quien sabe qué mirar
  // dentro es su dueño, `stripSeededPoints`.
  /**
   * @template C
   * @param {C} content
   * @returns {C}
   */
  static migrateContent(content) { return stripSeededPoints(/** @type {C & {items?: unknown}} */ (content)); }
  // Adapta el contenido al cambiar de formato HACIA Matemáticas (quita opciones).
  /**
   * @param {import('../../kernel/contracts/activity.js').ActivityContent} content
   * @returns {QaContent}
   */
  static adoptContent(content) { return adoptForMath(content); }
}
