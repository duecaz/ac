// Tildes. Tap the vowels that take an accent — the single touch-first mechanic
// shared by solo, VS, Equipos and LIVE (see core/textCorrectionRound.js).
import { BaseTemplate } from '../base.js';
import { renderTildesPlayer } from './player.js';
import { renderTildesEditor } from './editor.js';
import { newPassage } from '../../core/contentModels/textCorrection.js';
import { parseAccentedText } from '../../core/textMarks.js';
import { renderTextCorrectionRound, renderTextCorrectionHost } from '../../core/textCorrectionRound.js';
import { scoreTildesSubmission } from './scorer.js';

export class TildesTemplate extends BaseTemplate {
  static meta = {
    name: 'tildes',
    label: 'Tildes',
    icon: 'bi-pencil-fill',
    color: 'warning',
    contentModel: 'textCorrection',
    templateVersion: 1,
    instructions: 'Dibuja la tilde (´) sobre las vocales que la llevan. Cuando termines, pulsa “Listo” para corregir.',
    panelFit: 'fill',    // el texto llena el panel y se escala para caber
    aspectRatio: '16/10',
    modes: { solo: true, live: true, async: true, practice: true },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules: () => ({ randomize: false, allowOverflow: true, showHints: false }),
    defaultScoring: () => ({ pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => {
      const examples = [
        'Jamás tanto cariño doloroso, jamás tanta cerca arremetió lo lejos, jamás el fuego nunca jugó mejor su rol de frío muerto! Jamás, señor ministro de salud, fue la salud más mortal',
        'y la migraña extrajo tanta frente de la frente! Y el mueble tuvo en su cajón, dolor, el corazón, en su cajón, dolor, la lagartija, en su cajón, dolor.',
      ];
      return { passages: examples.map(s => ({ ...newPassage(), ...parseAccentedText(s) })) };
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

  // Projector view for LIVE (passage big; solution on reveal).
  static renderRoundHost(root, ctx) {
    renderTextCorrectionHost(root, { ...ctx, kind: 'tilde' });
  }

  static migrateContent(content) { return content; }
}
