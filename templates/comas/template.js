// Comas: drop a comma in the right spot of the sentence. Sibling of Tildes,
// shares the textCorrection content model so they appear as 'switch
// templates' for each other on the activity page.
import { BaseTemplate } from '../base.js';
import { renderComasPlayer } from './player.js';
import { renderComasEditor } from './editor.js';
import { newPassage } from '../../core/contentModels/textCorrection.js';
import { parseTextWithCommas, markPartsFor, markValueParts } from '../../core/textMarks.js';
import { renderTextCorrectionRound, renderTextCorrectionHost, textCorrectionPreviewHtml } from '../../core/textCorrectionRound.js';
import { scoreComasSubmission } from './scorer.js';

export class ComasTemplate extends BaseTemplate {
  static meta = {
    name: 'comas',
    label: 'Comas',
    icon: 'bi-cursor-text',
    color: 'success',
    contentModel: 'textCorrection',
    templateVersion: 1,
    paginated: true,   // una frase por pantalla → nº de páginas = nº de frases
    instructions: 'Dibuja la coma (,) en el hueco donde falta. Cuando termines, pulsa “Listo” para corregir.',
    panelFit: 'fill',    // el texto llena el panel y se escala para caber
    aspectRatio: '16/10',
    modes: { solo: true, live: true, async: true, practice: true },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'points', teams: 'turns', live: 'rounds' },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules: () => ({ randomize: false, allowOverflow: true }),
    defaultScoring: () => ({ pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => {
      const examples = [
        'Hola, ¿cómo estás?',
        'Fui al parque, compré frutas y regresé a casa.',
        'Mi madre, mi padre y yo fuimos a la playa.',
      ];
      return { passages: examples.map(s => ({ ...newPassage(), ...parseTextWithCommas(s) })) };
    },
    defaultPresentation: () => ({ skin: 'default', background: 'notebook' })
  };
  static renderPlayer = renderComasPlayer;
  static renderEditor = renderComasEditor;
  static scoreSubmission = scoreComasSubmission;

  // Preview de tarjeta: reusa el markup real del player (passageHtml) vía el
  // helper compartido → la miniatura no puede desincronizarse del juego.
  static previewHtml(act) { return textCorrectionPreviewHtml(act, 'coma'); }

  // One passage = one round. The answer key (marks) is stripped from the payload.
  static getRoundPayload(activity, ctx) {
    const p = (activity.content?.passages || [])[ctx.itemIndex];
    return p ? { id: p.id, text: p.text } : null;
  }

  // One passage = one round (tap the gap where a comma is missing). Shared renderer.
  static renderRound(root, payload, { onSubmit } = {}) {
    return renderTextCorrectionRound(root, payload, { kind: 'coma', onSubmit });   // devuelve { flush }
  }

  // Projector view for LIVE (passage big; solution on reveal).
  static renderRoundHost(root, ctx) {
    renderTextCorrectionHost(root, { ...ctx, kind: 'coma' });
  }

  // Analítica por parte (M1): cada parte = una coma requerida (key=posición,
  // label=palabra) → heatmap por el % de la clase que acertó cada coma.
  static itemParts({ item }) { return markPartsFor(item, 'coma'); }
  static valueParts({ value }) { return markValueParts(value); }
  static itemLabel(item) { return (item?.text || '').slice(0, 40); }

  static migrateContent(content) { return content; }
}
