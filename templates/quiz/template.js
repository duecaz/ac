// Quiz template: classic multiple-choice. Uses contentModels/qa.
import { BaseTemplate } from '../base.js';
import { renderQuizPlayer } from './player.js';
import { renderQuizEditor } from './editor.js';
import { scoreQuizSubmission } from './scorer.js';
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

  // Render ONE round (question + options) into `root` for the session formats
  // (VS / Equipos-auto). Calls onSubmit(value) once when an option is chosen and
  // then locks itself; the surrounding view shows ✓/✗ feedback. `payload` is the
  // answer-stripped getRoundPayload output.
  static renderRound(root, payload, { onSubmit } = {}) {
    const opts = payload?.options || [];
    root.innerHTML = `
      <div class="rq-q text-center fs-4 fw-semibold mb-3">${escapeHtml(payload?.question || '')}</div>
      ${payload?.image ? `<div class="text-center mb-2"><img src="${escapeHtml(payload.image)}" style="max-height:130px" class="img-fluid"></div>` : ''}
      <div class="ww-kahoot-grid">
        ${opts.map((o, i) => `
          <button class="btn vs-opt rq-opt" data-value="${escapeHtml(o)}">
            <i class="bi ${SHAPE_ICONS[i % 4]} me-2"></i>${escapeHtml(o)}
          </button>`).join('')}
      </div>`;
    let done = false;
    root.querySelectorAll('.rq-opt').forEach(btn => btn.addEventListener('click', () => {
      if (done) return;
      done = true;
      root.querySelectorAll('.rq-opt').forEach(b => { b.disabled = true; });
      btn.classList.add('rq-picked');
      onSubmit?.(btn.dataset.value);
    }));
  }

  // Migrate this template's content from older templateVersion if needed.
  static migrateContent(content /*, fromVersion */) { return content; }
}

function shuffle(a){ for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]; } return a; }
