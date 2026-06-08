// Quiz template: classic multiple-choice. Uses contentModels/qa.
import { BaseTemplate } from '../base.js';
import { renderQuizPlayer } from './player.js';
import { renderQuizEditor } from './editor.js';
import { scoreQuizSubmission } from './scorer.js';
import { renderChoiceRound, shuffle } from '../../core/roundRender.js';
import { escapeHtml } from '../../core/html.js';

const SHAPE_ICONS = ['bi-triangle-fill', 'bi-diamond-fill', 'bi-circle-fill', 'bi-square-fill'];

export class QuizTemplate extends BaseTemplate {
  static meta = {
    name: 'quiz',
    label: 'Quiz',
    icon: 'bi-question-circle-fill',
    color: 'primary',
    contentModel: 'qa',
    templateVersion: 1,
    aspectRatio: '16/10',
    modes: { solo: true, live: true, async: true, practice: false },
    needsImageUpload: true,
    needsAudioUpload: true,
    defaultRules: () => ({ timer: 0, randomize: false, shuffleOptions: true }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0, penaltyRatio: 0, maxScore: 0 }),
    defaultLive: () => ({ enabled: true, advanceMode: 'manual', questionTimer: 20, lockAnswersOn: 'allAnswered',
                          showAnswerAfterEach: true, showLeaderboardBetween: true, pointsModel: 'kahoot',
                          speedBonusMax: 1000, allowLateJoin: true, maxPlayers: 60, nicknameFilter: true }),
    defaultContent: () => ({ items: [{ id: 'q_'+Math.random().toString(36).slice(2,8),
                                       question: '', answer: '', options: ['','','',''], points: 1, image: null, audio: null }] })
  };

  static renderPlayer = renderQuizPlayer;
  static renderEditor = renderQuizEditor;
  static scoreSubmission = scoreQuizSubmission;

  // Per-round payload sent to LIVE clients. Strips the answer.
  static getRoundPayload(activity, ctx) {
    const item = activity.content.items[ctx.itemIndex];
    if (!item) return null;
    const opts = (item.options || []).slice();
    if (activity.rules?.shuffleOptions) shuffle(opts);
    return { id: item.id, question: item.question, image: item.image || null, audio: item.audio || null, options: opts, points: item.points || 1 };
  }

  // One multiple-choice round for the session formats (VS / Equipos-auto).
  static renderRound(root, payload, opts) { renderChoiceRound(root, payload, opts); }

  // Projector view for LIVE: the Kahoot-style colour grid (question phase) and
  // the per-option answer distribution + correct option (reveal phase).
  static renderRoundHost(root, { phase, item, answers = [] } = {}) {
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
            return `<div class="mb-2">
              <div class="d-flex justify-content-between"><span>${'ABCD'[i] || ''}. ${escapeHtml(o)} ${isOk ? '<i class="bi bi-check-circle-fill text-success"></i>' : ''}</span><b>${counts[i]}</b></div>
              <div class="progress" style="height:24px"><div class="progress-bar ${isOk ? 'bg-success' : 'bg-secondary'}" style="width:${w}%"></div></div>
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
    // Ensure each item carries answerIdx (the correct option INDICES) so the
    // editor never re-derives correctness from option TEXT — which mismarks
    // options that share text. Idempotent: only fills it when missing.
    if (content && Array.isArray(content.items)) {
      for (const it of content.items) {
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
