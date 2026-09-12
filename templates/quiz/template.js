// Quiz template: classic multiple-choice. Uses contentModels/qa.
import { defaultQaItems, QA_PRIMER_PASO } from '../../core/contentModels/qa.js';
import { BaseTemplate } from '../base.js';
import { renderQuizPlayer } from './player.js';
import { renderQuizEditor } from './editor.js';
import { scoreQuizSubmission } from './scorer.js';
import { renderChoiceRound } from '../../core/roundRender.js';
import { shuffle } from '../../core/azar.js';
import { adoptForQuiz } from '../../kernel/content/qaAdapt.js';
import { renderQuizRoundHost } from './hostView.js';
import { migrateQuizContent } from './migrate.js';
import { comoQaItem } from './item.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').QaContent} QaContent
 * @typedef {import('../../kernel/contracts/activity.js').QaItem} QaItem
 */

export class QuizTemplate extends BaseTemplate {
  /** @type {import('../../kernel/contracts/template.js').TemplateMeta<QaContent>} */
  static meta = {
    name: 'quiz',
    label: 'Quiz',
    icon: 'bi-question-circle-fill',
    color: 'primary',
    kind:            'ejercicio',   // familia (norte §4c): quién pone el contenido
    contentModel: 'qa',
    templateVersion: 2,
    paginated: true,   // una pregunta por pantalla → nº de páginas = nº de ítems
    // El EDITOR se declara aquí (§0: la vista no conoce plantillas concretas):
    // `elemento` es lo que el profe AÑADE y `primerPaso` lo que se lee con la
    // actividad vacía — es lo que enseña, en vez de contenido de muestra que
    // hay que borrar antes de empezar (R-D).
    editor: { elemento: 'pregunta', primerPaso: QA_PRIMER_PASO },
    instructions: 'Lee cada pregunta y toca la respuesta correcta.',
    panelFit: 'fill',    // las opciones llenan el panel
    aspectRatio: '16/10',
    modes: { solo: true, live: true, async: true },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'points', teams: 'turns', live: ['rounds', 'race'], submit: 'gesto' , reloj: { unidad: 'pregunta' } },
    // 30 s por pregunta desde el nacimiento (dueño 2026-09-01, como Wordwall);
    // solo actividades NUEVAS — el contenido guardado no se toca (§24).
    defaultRules: () => ({ timer: 30, randomize: false, shuffleOptions: true }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    // B6 (2026-09-02): los 9 valores que declaraba aquí eran IDÉNTICOS a los que
    // ya siembra DEFAULT_LIVE (core/constants.js) para todas las plantillas — el
    // ajuste de la SALA (capa modo/plataforma) no lo declara una plantilla
    // (§0/§21b).
    defaultLive: () => ({}),
    defaultContent: () => ({ items: defaultQaItems() }),
  };

  static renderPlayer = renderQuizPlayer;
  static renderEditor = renderQuizEditor;
  static scoreSubmission = scoreQuizSubmission;


  // Adapta el contenido al cambiar de formato HACIA Quiz (genera opciones).
  /**
   * @param {import('../../kernel/contracts/activity.js').ActivityContent} content
   * @returns {QaContent}
   */
  static adoptContent(content) { return adoptForQuiz(content); }

  // Per-round payload sent to LIVE clients. Strips the answer.
  /**
   * @param {import('../../kernel/contracts/activity.js').Activity} activity
   * @param {import('../../kernel/contracts/session.js').RoundContext} ctx
   * @returns {import('../../kernel/contracts/session.js').RoundPayload|null}
   */
  static getRoundPayload(activity, ctx) {
    const item = (/** @type {QaContent} */ (activity.content)).items[ctx.itemIndex];
    if (!item) return null;
    const opts = (item.options || []).slice();
    if (activity.rules?.shuffleOptions) shuffle(opts);
    return { id: item.id, question: item.question, image: item.image || null, audio: item.audio || null, options: opts, points: item.points || 1 };
  }

  // Analítica por parte (M1): las PARTES de una pregunta son sus opciones (la
  // correcta + los distractores); `valueParts` = la opción que eligió el alumno.
  // → el informe muestra "% que eligió cada opción" (distractores más marcados).
  /**
   * @param {{item: unknown, activity?: import('../../kernel/contracts/activity.js').Activity}} input
   * @returns {Array<{key: string|number, label?: string, ok?: boolean}>}
   */
  static itemParts({ item }) {
    const it = comoQaItem(item);
    return (it?.options || []).map(o => ({ key: String(o), label: String(o), ok: String(o) === String(it?.answer) }));
  }
  /**
   * @param {{value: unknown, item?: unknown, activity?: import('../../kernel/contracts/activity.js').Activity}} input
   * @returns {Array<string|number>}
   */
  static valueParts({ value }) { return value == null ? [] : [String(value)]; }
  /** @param {unknown} item @returns {string} */
  static itemLabel(item) { return comoQaItem(item)?.question || ''; }

  // One multiple-choice round for the session formats (VS / Equipos-auto).
  /**
   * @param {Element} root
   * @param {import('../../kernel/contracts/session.js').RoundPayload} payload
   * @param {import('../../kernel/contracts/template.js').RoundCallbacks} [opts]
   * @returns {void}
   */
  static renderRound(root, payload, opts) { renderChoiceRound(root, payload, opts); }

  // La pantalla del PROYECTOR en vivo vive en su vista (hostView.js).
  static renderRoundHost = renderQuizRoundHost;

  // El contenido guardado sube de versión en su módulo (migrate.js, §24).
  static migrateContent = migrateQuizContent;
}
