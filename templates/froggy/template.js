import { BaseTemplate } from '../base.js';
import { renderFroggyPlayer, renderFroggyRound, SCENARIOS } from './player.js';
import { renderFroggyEditor } from './editor.js';
import { scoreFroggy } from './scorer.js';
import { shuffle } from '../../core/roundRender.js';
import { escapeHtml } from '../../core/html.js';

const SHAPE_ICONS = ['bi-triangle-fill', 'bi-diamond-fill', 'bi-circle-fill', 'bi-square-fill'];

export class FroggyTemplate extends BaseTemplate {
  static meta = {
    name:            'froggy',
    label:           'Froggy Jumps',
    icon:            'bi-emoji-laughing-fill',
    color:           'success',
    contentModel:    'qa',
    templateVersion: 1,
    modes:           { solo: true, live: true, async: true, practice: false },
    needsImageUpload: true,
    needsAudioUpload: false,
    defaultRules:   () => ({ timer: 0, randomize: false, shuffleOptions: true, froggyScenario: 'swamp' }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0 }),
    defaultLive:    () => ({
      enabled: true, advanceMode: 'manual', questionTimer: 20, lockAnswersOn: 'allAnswered',
      showAnswerAfterEach: true, showLeaderboardBetween: true, pointsModel: 'kahoot',
      speedBonusMax: 1000, allowLateJoin: true, maxPlayers: 60, nicknameFilter: true,
      streakBonus: false, streakBonusPerStep: 50,
    }),
    defaultContent: () => {
      const id = () => 'fq_' + Math.random().toString(36).slice(2, 8);
      return { items: [
        { id: id(), question: '¿Cuántas patas tiene una rana?', answer: '4',
          options: ['2', '4', '6', '8'], points: 1, image: null },
        { id: id(), question: '¿Dónde viven las ranas?', answer: 'En el agua y la tierra',
          options: ['Solo en el agua', 'Solo en tierra', 'En el agua y la tierra', 'En el aire'], points: 1, image: null },
      ]};
    },
  };

  static renderPlayer = renderFroggyPlayer;
  static renderEditor = renderFroggyEditor;
  static scoreSubmission = scoreFroggy;

  static getRoundPayload(activity, ctx) {
    const item = activity.content?.items?.[ctx.itemIndex];
    if (!item) return null;
    const opts = (item.options || []).slice();
    if (activity.rules?.shuffleOptions !== false) shuffle(opts);
    return {
      id: item.id,
      question: item.question,
      image: item.image || null,
      options: opts,
      points: item.points || 1,
      scene: activity.presentation?.froggyScenario || 'swamp',
      // VS position hints (approximate; vsView doesn't expose scores to payload)
      p1Score: 0, p2Score: 0,
      total: activity.content.items.length,
      itemIndex: ctx.itemIndex,
    };
  }

  static renderRound(root, payload, opts) {
    renderFroggyRound(root, payload, opts);
  }

  // Host projector for LIVE — show question + Kahoot colour grid
  static renderRoundHost(root, { phase, item, answers = [] } = {}) {
    const opts = item?.options || [];
    if (phase === 'reveal') {
      const counts = opts.map(o => answers.filter(a => String(a.value) === String(o)).length);
      const max = Math.max(1, ...counts);
      root.innerHTML = `
        <div class="text-center mb-3 froggy-live-title">${escapeHtml(item?.question || '')}</div>
        <div class="text-center mb-3 froggy-live-answer">
          <span class="badge bg-success fs-5">✓ ${escapeHtml(String(item?.answer ?? ''))}</span>
        </div>
        ${opts.map((o, i) => {
          const isOk = String(o) === String(item?.answer);
          const w = Math.round(100 * counts[i] / max);
          return `<div class="mb-2">
            <div class="d-flex justify-content-between">
              <span>${SHAPE_ICONS[i] ? `<i class="bi ${SHAPE_ICONS[i % 4]} me-1"></i>` : ''}${escapeHtml(o)} ${isOk ? '✅' : ''}</span>
              <b>${counts[i]}</b>
            </div>
            <div class="progress" style="height:26px">
              <div class="progress-bar ${isOk ? 'bg-success' : 'bg-secondary'}" style="width:${w}%"></div>
            </div></div>`;
        }).join('')}
        <div class="text-center mt-3 froggy-live-frogjump">🐸💨</div>`;
      return;
    }
    root.innerHTML = `
      <div class="text-center froggy-live-title mb-4">${escapeHtml(item?.question || '')}</div>
      ${item?.image ? `<div class="text-center mb-3"><img src="${escapeHtml(item.image)}" class="img-fluid" style="max-height:220px"></div>` : ''}
      <div class="ww-kahoot-grid">
        ${opts.map((o, i) => `<button class="btn btn-lg ww-shape-${(i % 4) + 1}" disabled>
          <i class="bi ${SHAPE_ICONS[i % 4]} me-2"></i>${escapeHtml(o)}</button>`).join('')}
      </div>
      <div class="text-center mt-4" style="font-size:3rem">🐸🐸🐸</div>`;
  }
}
