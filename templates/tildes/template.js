// Tildes. Tap the vowels that take an accent — the single touch-first mechanic
// shared by solo, VS, Equipos and LIVE (see core/textCorrectionRound.js).
import { BaseTemplate } from '../base.js';
import { renderTildesPlayer } from './player.js';
import { renderTildesEditor } from './editor.js';
import { newPassage } from '../../core/contentModels/textCorrection.js';
import { parseAccentedText } from '../../core/textMarks.js';
import { renderTextCorrectionRound } from '../../core/textCorrectionRound.js';
import { scoreTildesSubmission } from './scorer.js';

export class TildesTemplate extends BaseTemplate {
  static meta = {
    name: 'tildes',
    label: 'Tildes',
    icon: 'bi-pencil-fill',
    color: 'warning',
    contentModel: 'textCorrection',
    templateVersion: 1,
    aspectRatio: 'auto',
    modes: { solo: true, live: false, async: true, practice: true },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules: () => ({ randomize: false, allowOverflow: true, showHints: false }),
    defaultScoring: () => ({ pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => {
      // Start with one example so the editor isn't empty.
      const seed = parseAccentedText('canción popular');
      return { passages: [{ ...newPassage(), ...seed }] };
    },
    // Suggest a notebook background by default — author can override.
    defaultPresentation: () => ({ skin: 'default', background: 'notebook' })
  };
  static renderPlayer = renderTildesPlayer;
  static renderEditor = renderTildesEditor;
  static scoreSubmission = scoreTildesSubmission;

  // One passage = one round. The answer key (marks) is stripped from the payload.
  static getRoundPayload(activity, ctx) {
    const p = (activity.content?.passages || [])[ctx.itemIndex];
    return p ? { id: p.id, text: p.text } : null;
  }

  // One passage = one round (tap the accented vowels). Shared renderer.
  static renderRound(root, payload, { onSubmit } = {}) {
    renderTextCorrectionRound(root, payload, { kind: 'tilde', onSubmit });
  }

  static migrateContent(content) { return content; }
}
