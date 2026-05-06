// Comas: drop a comma in the right spot of the sentence. Sibling of Tildes,
// shares the textCorrection content model so they appear as 'switch
// templates' for each other on the activity page.
import { BaseTemplate } from '../base.js';
import { renderComasPlayer } from './player.js';
import { renderComasEditor } from './editor.js';
import { newPassage } from '../../core/contentModels/textCorrection.js';
import { parseTextWithCommas } from '../../core/textMarks.js';

export class ComasTemplate extends BaseTemplate {
  static meta = {
    name: 'comas',
    label: 'Comas',
    icon: 'bi-cursor-text',
    color: 'success',
    contentModel: 'textCorrection',
    templateVersion: 1,
    aspectRatio: 'auto',
    modes: { solo: true, live: false, async: true, practice: true },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules: () => ({ randomize: false, allowOverflow: true }),
    defaultScoring: () => ({ pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => {
      const seed = parseTextWithCommas('Hola, ¿cómo estás?');
      return { passages: [{ ...newPassage(), ...seed }] };
    },
    defaultPresentation: () => ({ skin: 'default', background: 'notebook' })
  };
  static renderPlayer = renderComasPlayer;
  static renderEditor = renderComasEditor;
  static migrateContent(content) { return content; }
}
