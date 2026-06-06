// Match Up: two columns; tap left then right to pair. Solo + async.
import { BaseTemplate } from '../base.js';
import { renderMatchPlayer } from './player.js';
import { renderMatchEditor } from './editor.js';
import { newPair } from '../../core/contentModels/pairs.js';
import { renderChoiceRound, shuffle } from '../../core/roundRender.js';
import { scoreMatchSubmission } from './scorer.js';

export class MatchTemplate extends BaseTemplate {
  static meta = {
    name: 'match',
    label: 'Emparejar',
    icon: 'bi-link-45deg',
    color: 'info',
    contentModel: 'pairs',
    templateVersion: 1,
    aspectRatio: '16/10',
    modes: { solo: true, live: false, async: true, practice: true },
    needsImageUpload: true,
    needsAudioUpload: false,
    defaultRules: () => ({ timer: 0, randomize: true, livesPerMistake: 0 }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => ({ pairs: [newPair(), newPair(), newPair(), newPair()] })
  };
  static renderPlayer = renderMatchPlayer;
  static renderEditor = renderMatchEditor;
  static scoreSubmission = scoreMatchSubmission;

  // One pair = one matching round: prompt is the left side, options are the
  // right sides (the correct one + up to 3 distractors), shuffled. Answer-safe:
  // the payload never says which option is right.
  static getRoundPayload(activity, ctx) {
    const pairs = activity.content?.pairs || [];
    const item = pairs[ctx.itemIndex];
    if (!item || !item.right) return null;
    const answer = String(item.right);
    const others = pairs.map(p => String(p.right)).filter(r => r && r !== answer);
    const distractors = shuffle([...new Set(others)]).slice(0, 3);
    return { id: item.id, question: String(item.left), image: item.image || null,
             options: shuffle([answer, ...distractors]) };
  }

  // The matching round is a multiple-choice pick of the right side.
  static renderRound(root, payload, opts) { renderChoiceRound(root, payload, opts); }

  static migrateContent(content) { return content; }
}
