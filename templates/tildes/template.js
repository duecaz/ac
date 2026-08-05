// Tildes. Tap the vowels that take an accent — the single touch-first mechanic
// shared by solo, VS, Equipos and LIVE (see core/textCorrectionRound.js).
import { BaseTemplate } from '../base.js';
import { renderTildesPlayer } from './player.js';
import { renderTildesEditor } from './editor.js';
import { newPassage } from '../../core/contentModels/textCorrection.js';
import { parseAccentedText, applyMarks } from '../../core/textMarks.js';
import { renderTextCorrectionRound, renderTextCorrectionHost, textCorrectionPreviewHtml } from '../../core/textCorrectionRound.js';
import { markPartsFor, markValueParts } from '../../core/textMarks.js';
import { scoreTildesSubmission } from './scorer.js';

export class TildesTemplate extends BaseTemplate {
  static meta = {
    name: 'tildes',
    label: 'Tildes',
    icon: 'bi-pencil-fill',
    color: 'warning',
    contentModel: 'textCorrection',
    templateVersion: 1,
    paginated: true,   // una frase por pantalla → nº de páginas = nº de frases
    instructions: 'Dibuja la tilde (´) sobre las vocales que la llevan. Cuando termines, pulsa “Listo” para corregir.',
    panelFit: 'fill',    // el texto llena el panel y se escala para caber
    aspectRatio: '16/10',
    modes: { solo: true, live: true, async: true, practice: true },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'points', teams: 'turns', live: ['rounds', 'race'], submit: 'boton' },
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

  // Preview de tarjeta: reusa el markup real del player (passageHtml) vía el
  // helper compartido → la miniatura no puede desincronizarse del juego.
  static previewHtml(act) { return textCorrectionPreviewHtml(act, 'tilde'); }

  // One passage = one round. The answer key (marks) is stripped from the payload.
  static getRoundPayload(activity, ctx) {
    const p = (activity.content?.passages || [])[ctx.itemIndex];
    return p ? { id: p.id, text: p.text } : null;
  }

  // One passage = one round (tap the accented vowels). Shared renderer.
  static renderRound(root, payload, { onSubmit } = {}) {
    return renderTextCorrectionRound(root, payload, { kind: 'tilde', onSubmit });   // devuelve { flush }
  }

  // Projector view for LIVE (passage big; solution on reveal).
  static renderRoundHost(root, ctx) {
    renderTextCorrectionHost(root, { ...ctx, kind: 'tilde' });
  }

  // Analítica por parte (M1): cada parte = una tilde requerida (key=posición,
  // label=palabra) → el informe pinta un heatmap sobre el texto con el % de la
  // clase que acertó cada tilde ("jugó en rojo").
  static itemParts({ item }) { return markPartsFor(item, 'tilde'); }
  static valueParts({ value }) { return markValueParts(value); }
  static itemLabel(item) { return (item?.text || '').slice(0, 40); }

  // Recupera pasajes guardados ANTES del fix de normalización: si se pegó texto
  // con tildes DESCOMPUESTAS (vocal + U+0301), el parse viejo no las reconocía →
  // el texto se guardó con acentos combinantes sueltos y `marks` incompleto (el
  // denominador de aciertos salía menor, "3/4" en vez de "3/8"). Reconstruimos el
  // texto acentuado (aplicando las marcas conocidas) y lo re-parseamos ahora con
  // NFC → recupera TODAS las tildes. Idempotente en pasajes ya limpios (las comas
  // literales del texto se conservan; parseAccentedText solo toca acentos). Ver
  // docs/handoff-emparejar-vertical.md (histórico) y core/textMarks.js.
  static migrateContent(content) {
    const passages = content?.passages;
    if (!Array.isArray(passages)) return content;
    for (const p of passages) {
      if (!p || typeof p.text !== 'string') continue;
      // Solo re-parsear si el texto muestra la FIRMA de la corrupción (acentos
      // combinantes U+0300-036F sueltos). migrate() corre en CADA carga/sync de
      // cada actividad — sin este guard, todos los pasajes limpios pagaban el
      // applyMarks+parse completo para siempre.
      if (!/[\u0300-\u036f]/.test(p.text)) continue;
      const re = parseAccentedText(applyMarks(p.text, p.marks || []));
      p.text = re.text;
      p.marks = re.marks;
    }
    return content;
  }
}
