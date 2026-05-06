// Tildes (drag-drop variant). Drop a tilde onto each vowel that needs it.
// Uses Pointer Events for cross-input compatibility (mouse / touch / pen)
// without loading any canvas/IR module — that comes later as an optional
// alternative template (e.g. tildes-ir).
import { BaseTemplate } from '../base.js';
import { renderTildesPlayer } from './player.js';
import { renderTildesEditor } from './editor.js';
import { newPassage } from '../../core/contentModels/textCorrection.js';

export class TildesTemplate extends BaseTemplate {
  static meta = {
    name: 'tildes',
    label: 'Tildes',
    icon: 'bi-pencil-fill',
    color: 'warning',
    contentModel: 'textCorrection',
    templateVersion: 1,
    modes: { solo: true, live: false, async: true, practice: true },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules: () => ({ randomize: false, allowOverflow: true, showHints: false }),
    defaultScoring: () => ({ pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => ({ passages: [
      { ...newPassage(), text: 'cancion popular' }
    ]}),
    // Suggest a notebook background by default — author can override.
    defaultPresentation: () => ({ skin: 'default', background: 'notebook' })
  };
  static renderPlayer = renderTildesPlayer;
  static renderEditor = renderTildesEditor;
  static migrateContent(content) { return content; }
}
