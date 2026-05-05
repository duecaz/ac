// Match Up: two columns; tap left then right to pair. Solo + async.
import { BaseTemplate } from '../base.js';
import { renderMatchPlayer } from './player.js';
import { renderMatchEditor } from './editor.js';
import { newPair } from '../../core/contentModels/pairs.js';

export class MatchTemplate extends BaseTemplate {
  static meta = {
    name: 'match',
    label: 'Emparejar',
    icon: 'bi-link-45deg',
    color: 'info',
    contentModel: 'pairs',
    templateVersion: 1,
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
  static migrateContent(content) { return content; }
}
