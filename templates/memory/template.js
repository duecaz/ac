// Memory: face-down grid; flip 2 cards; if same pair.id, stay; else flip back.
// Reuses the 'pairs' content model. The two cards of a pair show left and right.
import { BaseTemplate } from '../base.js';
import { renderMemoryPlayer } from './player.js';
import { renderMemoryEditor } from './editor.js';
import { newPair } from '../../core/contentModels/pairs.js';

export class MemoryTemplate extends BaseTemplate {
  static meta = {
    name: 'memory',
    label: 'Memoria',
    icon: 'bi-shuffle',
    color: 'primary',
    contentModel: 'pairs',
    templateVersion: 1,
    aspectRatio: '1/1',
    modes: { solo: true, live: false, async: true, practice: true },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules: () => ({ revealMs: 900, columns: 4 }),
    defaultScoring: () => ({ pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => ({ pairs: [newPair(), newPair(), newPair(), newPair(), newPair(), newPair()] })
  };
  static renderPlayer = renderMemoryPlayer;
  static renderEditor = renderMemoryEditor;
  static migrateContent(content) { return content; }
}
