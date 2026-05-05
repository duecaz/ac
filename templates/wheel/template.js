// Random wheel: spin, land on one entry. SOLO/async only (no live).
import { BaseTemplate } from '../base.js';
import { renderWheelPlayer } from './player.js';
import { renderWheelEditor } from './editor.js';

export class WheelTemplate extends BaseTemplate {
  static meta = {
    name: 'wheel',
    label: 'Ruleta',
    icon: 'bi-bullseye',
    color: 'success',
    contentModel: 'entries',
    templateVersion: 1,
    modes: { solo: true, live: false, async: true, practice: true },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules: () => ({ spinDurationMs: 4000, removeAfterSpin: false }),
    defaultScoring: () => ({}),
    defaultLive: () => ({}),
    defaultContent: () => ({ entries: ['Opción 1', 'Opción 2', 'Opción 3', 'Opción 4'] })
  };
  static renderPlayer = renderWheelPlayer;
  static renderEditor = renderWheelEditor;
  static migrateContent(content) { return content; }
}
