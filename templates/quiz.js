import { BaseTemplate } from './base.js';
import { isCorrect } from '../core/contentModels/qa.js';

export class QuizTemplate extends BaseTemplate {
  static name = 'quiz';
  static label = 'Quiz';

  static getItemPayload(item, rules) {
    const opts = (item.options || []).slice();
    if (rules?.shuffleOptions) shuffle(opts);
    // Strip the answer when sending to clients.
    return {
      id: item.id,
      question: item.question,
      image: item.image || null,
      audio: item.audio || null,
      options: opts,
      points: item.points || 1
    };
  }

  static scoreAnswer(value, item, msTaken, liveRules) {
    const ok = isCorrect(item, value);
    if (ok === null) return { correct: null, points: 0 };
    if (!ok) {
      // Optional penalty on wrong.
      const penalty = liveRules?.scoring?.pointsPerWrong ?? 0;
      return { correct: false, points: penalty < 0 ? penalty : 0 };
    }
    const base = item.points || 1;
    if (liveRules?.pointsModel === 'kahoot') {
      const max = liveRules?.questionTimer ? liveRules.questionTimer * 1000 : 20000;
      const speedBonusMax = liveRules?.speedBonusMax ?? 1000;
      const remain = Math.max(0, 1 - (msTaken || 0) / max);
      // Kahoot-ish: half from base, half from speed.
      const points = Math.round(base * 500 + speedBonusMax * remain);
      return { correct: true, points };
    }
    return { correct: true, points: base };
  }
}

function shuffle(a){ for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]; } return a; }
