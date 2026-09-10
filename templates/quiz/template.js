// Quiz template: classic multiple-choice. Uses contentModels/qa.
import { stripSeededPoints, defaultQaItems, QA_PRIMER_PASO } from '../../core/contentModels/qa.js';
import { BaseTemplate } from '../base.js';
import { SHAPE_ICONS } from '../../core/roundRender.js';
import { renderQuizPlayer } from './player.js';
import { renderQuizEditor } from './editor.js';
import { scoreQuizSubmission } from './scorer.js';
import { renderChoiceRound } from '../../core/roundRender.js';
import { shuffle } from '../../core/azar.js';
import { escapeHtml } from '../../core/html.js';
import { adoptForQuiz } from '../../kernel/content/qaAdapt.js';

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

  // Projector view for LIVE: the rejilla de opciones de colores (question phase) and
  // the per-option answer distribution + correct option (reveal phase).
  // playerMap: optional { [optionValue]: ['Ana', 'Beto', …] } built by the host.
  /**
   * @param {Element} root
   * @param {import('../../kernel/contracts/template.js').HostRoundContext} [ctx]
   * @returns {void}
   */
  static renderRoundHost(root, { phase, item, answers = [], playerMap = {} } = {}) {
    const it = comoQaItem(item);
    const opts = it?.options || [];
    if (phase === 'reveal') {
      const counts = opts.map(o => answers.filter(a => String(valorRespondido(a)) === String(o)).length);
      const max = Math.max(1, ...counts);
      root.innerHTML = `
        <h3 class="text-center mb-3">${escapeHtml(it?.question || '')}</h3>
        <p class="text-center text-success fw-bold fs-4"><i class="bi bi-check-circle-fill"></i> ${escapeHtml(String(it?.answer ?? ''))}</p>
        <div class="mb-4">
          ${opts.map((o, i) => {
            const isOk = String(o) === String(it?.answer);
            const w = Math.round(100 * counts[i] / max);
            const names = playerMap[String(o)] || [];
            return `<div class="mb-2">
              <div class="d-flex justify-content-between"><span>${'ABCD'[i] || ''}. ${escapeHtml(o)} ${isOk ? '<i class="bi bi-check-circle-fill text-success"></i>' : ''}</span><b>${counts[i]}</b></div>
              <div class="progress" style="height:24px"><div class="progress-bar ${isOk ? 'bg-success' : 'bg-secondary'}" style="width:${w}%"></div></div>
              ${names.length ? `<div class="text-muted small mt-1 ps-1">${names.map(n => `<span class="badge bg-light text-dark border me-1">${escapeHtml(n)}</span>`).join('')}</div>` : ''}
            </div>`;
          }).join('')}
        </div>`;
      return;
    }
    root.innerHTML = `
      <h2 class="text-center my-4">${escapeHtml(it?.question || '')}</h2>
      ${it?.image ? `<div class="text-center mb-3"><img src="${escapeHtml(it.image)}" class="img-fluid" style="max-height:240px"></div>` : ''}
      <div class="ww-opt-grid mb-4">
        ${opts.map((o, i) => `<button class="btn btn-lg ww-shape-${(i % 4) + 1}" disabled><i class="bi ${SHAPE_ICONS[i % 4]} me-2"></i>${escapeHtml(o)}</button>`).join('')}
      </div>`;
  }

  // Migrate this template's content from older templateVersion if needed.
  // La firma es la IDENTIDAD sobre la forma (la de `templates/base.js`): el
  // contenido entra tal cual lo tenga la actividad y se estrecha por FORMA.
  /**
   * @template C
   * @param {C} content
   * @returns {C}
   */
  static migrateContent(content /*, fromVersion */) {
    if (!content || typeof content !== 'object' || !('items' in content)) return content;
    // v1→v2: fuera el `points: 1` sembrado. Aquí el campo SÍ es visible
    // («Avanzado → puntos»), pero seguía naciendo escrito, así que cambiar
    // «Puntos por acierto» tampoco hacía nada hasta tocar pregunta por pregunta.
    stripSeededPoints(content);
    // Ensure each item carries answerIdx (the correct option INDICES) so the
    // editor never re-derives correctness from option TEXT — which mismarks
    // options that share text. Idempotent: only fills it when missing.
    if (Array.isArray(content.items)) {
      rellenarAnswerIdx(content.items);
    }
    return content;
  }
}

/** Lo que el contrato entrega como `unknown`, leído como el ítem `qa` que esta
 *  plantilla sí conoce. Sin ítem no hay nada que pintar ni que contar.
 * @param {unknown} item
 * @returns {QaItem|null}
 */
function comoQaItem(item) {
  if (!item || typeof item !== 'object') return null;
  return /** @type {QaItem} */ (item);
}

/** v1→v2 · cada ítem lleva `answerIdx` (las POSICIONES correctas) para que el
 *  editor no vuelva a derivar la corrección del TEXTO de la opción.
 * @param {QaItem[]} items
 * @returns {void}
 */
function rellenarAnswerIdx(items) {
  for (const it of items) {
    if (!it) continue;
    const opciones = it.options || [];
    // RESCATE de las preguntas que perdieron su `answer` al editar el texto
    // de la opción correcta (el bug de "todas malas": el editor mutaba el
    // texto antes de fijar el índice). Si la MARCA por índice sobrevivió, la
    // respuesta se re-deriva de ella; si no sobrevivió, no hay nada que
    // adivinar y el editor lo señala en rojo. Idempotente.
    if (Array.isArray(it.answerIdx) && it.answerIdx.length) {
      const texts = it.answerIdx
        .filter(k => k >= 0 && k < opciones.length)
        .map(k => String(opciones[k] ?? ''))
        .filter(t => t.trim() !== '');
      const lost = Array.isArray(it.answer)
        ? it.answer.filter(s => String(s ?? '').trim() !== '').length === 0
        : String(it.answer ?? '').trim() === '';
      if (lost && texts.length) it.answer = texts.length === 1 ? texts[0] : texts;
    }
    if (!Array.isArray(it.answerIdx)) {
      const ans = it.answer;
      it.answerIdx = opciones.reduce((acc, o, k) => {
        const hit = Array.isArray(ans) ? ans.includes(o) : (ans != null && ans !== '' && ans === o);
        if (hit) acc.push(k);
        return acc;
      }, /** @type {number[]} */ ([]));
    }
  }
}

/** El valor que afirmó una respuesta de la sala. `answers` viaja como
 *  `unknown[]` en el contrato: cada plantilla sabe qué guarda dentro.
 * @param {unknown} a
 * @returns {unknown}
 */
function valorRespondido(a) {
  return (a && typeof a === 'object' && 'value' in a) ? a.value : undefined;
}
