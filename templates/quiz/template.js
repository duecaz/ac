// Quiz template: classic multiple-choice. Uses contentModels/qa.
import { stripSeededPoints } from '../../core/contentModels/qa.js';
import { BaseTemplate } from '../base.js';
import { SHAPE_ICONS } from '../../core/roundRender.js';
import { rid } from '../../core/ids.js';
import { renderQuizPlayer } from './player.js';
import { renderQuizEditor } from './editor.js';
import { scoreQuizSubmission } from './scorer.js';
import { renderChoiceRound, shuffle } from '../../core/roundRender.js';
import { escapeHtml } from '../../core/html.js';
import { adoptForQuiz } from '../../kernel/content/qaAdapt.js';

export class QuizTemplate extends BaseTemplate {
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
    editor: { elemento: 'pregunta', primerPaso: 'Pulsa «Añadir pregunta» y escribe la pregunta con sus respuestas: una correcta y las demás no.' },
    instructions: 'Lee cada pregunta y toca la respuesta correcta.',
    panelFit: 'fill',    // las opciones llenan el panel
    aspectRatio: '16/10',
    modes: { solo: true, live: true, async: true, practice: false },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'points', teams: 'turns', live: ['rounds', 'race'], submit: 'gesto' },
    needsImageUpload: true,
    needsAudioUpload: true,
    defaultRules: () => ({ timer: 0, randomize: false, shuffleOptions: true }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0, penaltyRatio: 0, maxScore: 0 }),
    defaultLive: () => ({ enabled: true, advanceMode: 'manual', questionTimer: 20, lockAnswersOn: 'allAnswered',
                          showAnswerAfterEach: true, showLeaderboardBetween: true, pointsModel: 'kahoot',
                          speedBonusMax: 1000, allowLateJoin: true, maxPlayers: 60, nicknameFilter: true }),
    defaultContent: () => {
      const id = () => rid('q_');
      return { items: [
        { id: id(), question: '¿Cuál es la capital de España?', answer: 'Madrid',
          options: ['Madrid', 'Barcelona', 'Lisboa', 'París'], image: null, audio: null },
        { id: id(), question: '¿Cuántos días tiene una semana?', answer: '7',
          options: ['5', '6', '7', '8'], image: null, audio: null },
      ]};
    }
  };

  static renderPlayer = renderQuizPlayer;
  static renderEditor = renderQuizEditor;
  static scoreSubmission = scoreQuizSubmission;


  // Adapta el contenido al cambiar de formato HACIA Quiz (genera opciones).
  static adoptContent(content) { return adoptForQuiz(content); }

  // Per-round payload sent to LIVE clients. Strips the answer.
  static getRoundPayload(activity, ctx) {
    const item = activity.content.items[ctx.itemIndex];
    if (!item) return null;
    const opts = (item.options || []).slice();
    if (activity.rules?.shuffleOptions) shuffle(opts);
    return { id: item.id, question: item.question, image: item.image || null, audio: item.audio || null, options: opts, points: item.points || 1 };
  }

  // Analítica por parte (M1): las PARTES de una pregunta son sus opciones (la
  // correcta + los distractores); `valueParts` = la opción que eligió el alumno.
  // → el informe muestra "% que eligió cada opción" (distractores más marcados).
  static itemParts({ item }) {
    return (item?.options || []).map(o => ({ key: String(o), label: String(o), ok: String(o) === String(item?.answer) }));
  }
  static valueParts({ value }) { return value == null ? [] : [String(value)]; }
  static itemLabel(item) { return item?.question || ''; }

  // One multiple-choice round for the session formats (VS / Equipos-auto).
  static renderRound(root, payload, opts) { renderChoiceRound(root, payload, opts); }

  // Projector view for LIVE: the Kahoot-style colour grid (question phase) and
  // the per-option answer distribution + correct option (reveal phase).
  // playerMap: optional { [optionValue]: ['Ana', 'Beto', …] } built by the host.
  static renderRoundHost(root, { phase, item, answers = [], playerMap = {} } = {}) {
    const opts = item?.options || [];
    if (phase === 'reveal') {
      const counts = opts.map(o => answers.filter(a => String(a.value) === String(o)).length);
      const max = Math.max(1, ...counts);
      root.innerHTML = `
        <h3 class="text-center mb-3">${escapeHtml(item?.question || '')}</h3>
        <p class="text-center text-success fw-bold fs-4"><i class="bi bi-check-circle-fill"></i> ${escapeHtml(String(item?.answer ?? ''))}</p>
        <div class="mb-4">
          ${opts.map((o, i) => {
            const isOk = String(o) === String(item?.answer);
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
      <h2 class="text-center my-4">${escapeHtml(item?.question || '')}</h2>
      ${item?.image ? `<div class="text-center mb-3"><img src="${escapeHtml(item.image)}" class="img-fluid" style="max-height:240px"></div>` : ''}
      <div class="ww-kahoot-grid mb-4">
        ${opts.map((o, i) => `<button class="btn btn-lg ww-shape-${(i % 4) + 1}" disabled><i class="bi ${SHAPE_ICONS[i % 4]} me-2"></i>${escapeHtml(o)}</button>`).join('')}
      </div>`;
  }

  // Migrate this template's content from older templateVersion if needed.
  static migrateContent(content /*, fromVersion */) {
    // v1→v2: fuera el `points: 1` sembrado. Aquí el campo SÍ es visible
    // («Avanzado → puntos»), pero seguía naciendo escrito, así que cambiar
    // «Puntos por acierto» tampoco hacía nada hasta tocar pregunta por pregunta.
    stripSeededPoints(content);
    // Ensure each item carries answerIdx (the correct option INDICES) so the
    // editor never re-derives correctness from option TEXT — which mismarks
    // options that share text. Idempotent: only fills it when missing.
    if (content && Array.isArray(content.items)) {
      for (const it of content.items) {
        // RESCATE de las preguntas que perdieron su `answer` al editar el texto
        // de la opción correcta (el bug de "todas malas": el editor mutaba el
        // texto antes de fijar el índice). Si la MARCA por índice sobrevivió, la
        // respuesta se re-deriva de ella; si no sobrevivió, no hay nada que
        // adivinar y el editor lo señala en rojo. Idempotente.
        if (it && Array.isArray(it.answerIdx) && it.answerIdx.length) {
          const texts = it.answerIdx
            .filter(k => k >= 0 && k < (it.options || []).length)
            .map(k => String(it.options[k] ?? ''))
            .filter(t => t.trim() !== '');
          const lost = Array.isArray(it.answer)
            ? it.answer.filter(s => String(s ?? '').trim() !== '').length === 0
            : String(it.answer ?? '').trim() === '';
          if (lost && texts.length) it.answer = texts.length === 1 ? texts[0] : texts;
        }
        if (it && !Array.isArray(it.answerIdx)) {
          const ans = it.answer;
          it.answerIdx = (it.options || []).reduce((acc, o, k) => {
            const hit = Array.isArray(ans) ? ans.includes(o) : (ans != null && ans !== '' && ans === o);
            if (hit) acc.push(k);
            return acc;
          }, []);
        }
      }
    }
    return content;
  }
}
