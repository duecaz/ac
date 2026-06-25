// Random wheel: spin, land on one entry. Solo/practice + Live (teacher-scored).
import { BaseTemplate } from '../base.js';
import { renderWheelPlayer } from './player.js';
import { renderWheelEditor } from './editor.js';

export class WheelTemplate extends BaseTemplate {
  static meta = {
    name: 'wheel',
    label: 'Ruleta',
    icon: 'bi-bullseye',
    color: 'success',
    contentModel: 'items',
    templateVersion: 2,
    aspectRatio: '1/1',
    modes: { solo: true, live: true, async: false, practice: true },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules: () => ({ spinDurationMs: 4000, removeAfterSpin: false }),
    defaultScoring: () => ({}),
    defaultLive: () => ({}),
    defaultContent: () => ({
      items: [
        { q: 'Opción 1', image: null },
        { q: 'Opción 2', image: null },
        { q: 'Opción 3', image: null },
        { q: 'Opción 4', image: null },
      ]
    })
  };
  static renderPlayer = renderWheelPlayer;
  static renderEditor = renderWheelEditor;
  static migrateContent(content) {
    // Migrate old flat-entries format to items with q+image.
    if (Array.isArray(content?.entries) && !Array.isArray(content?.items)) {
      return { items: content.entries.map(e => ({ q: String(e), image: null })) };
    }
    return content;
  }
  // Required by the registry for live-capable templates.
  // Wheel Live uses manual teacher scoring, so these are not called in game,
  // but must exist to pass validation.
  static getRoundPayload(activity, { itemIndex }) {
    return activity.content?.items?.[itemIndex] ?? null;
  }
  static scoreSubmission() { return { correct: false, points: 0 }; }
}
