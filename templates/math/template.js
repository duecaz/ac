import { BaseTemplate } from '../base.js';
import { renderMathPlayer } from './player.js';
import { renderMathEditor } from './editor.js';
import { renderKeypadRound } from '../../core/roundRender.js';
import { scoreMathSubmission } from './scorer.js';

export class MathTemplate extends BaseTemplate {
  static meta = {
    name: 'math',
    label: 'Operaciones',
    icon: 'bi-calculator-fill',
    color: 'warning',
    contentModel: 'qa',
    templateVersion: 1,
    aspectRatio: '16/10',
    modes: { solo: true, live: false, async: true, practice: true },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules: () => ({ randomize: true }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => ({ items: [
      { id: 'm1', question: '2 × 6', answer: '12', points: 1 },
      { id: 'm2', question: '2 × 7', answer: '14', points: 1 },
      { id: 'm3', question: '3 × 4', answer: '12', points: 1 },
      { id: 'm4', question: '5 × 3', answer: '15', points: 1 },
    ] }),
  };
  static renderPlayer = renderMathPlayer;
  static renderEditor = renderMathEditor;
  static scoreSubmission = scoreMathSubmission;
  static getRoundPayload(activity, ctx) { const it = activity.content.items[ctx.itemIndex]; return it ? { question: it.question } : null; }
  static renderRound(root, payload, opts) { return renderKeypadRound(root, payload, opts); }
  static migrateContent(content) { return content; }
}
