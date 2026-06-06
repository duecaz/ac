// Comas: drop a comma in the right spot of the sentence. Sibling of Tildes,
// shares the textCorrection content model so they appear as 'switch
// templates' for each other on the activity page.
import { BaseTemplate } from '../base.js';
import { renderComasPlayer } from './player.js';
import { renderComasEditor } from './editor.js';
import { newPassage } from '../../core/contentModels/textCorrection.js';
import { parseTextWithCommas } from '../../core/textMarks.js';
import { escapeHtml } from '../../core/html.js';
import { scoreComasSubmission } from './scorer.js';

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
  static scoreSubmission = scoreComasSubmission;

  // One passage = one round. The answer key (marks) is stripped from the payload.
  static getRoundPayload(activity, ctx) {
    const p = (activity.content?.passages || [])[ctx.itemIndex];
    return p ? { id: p.id, text: p.text } : null;
  }

  // Render ONE passage with tappable gaps between characters for the session
  // formats (VS / Equipos-auto). The student toggles a comma in each gap, then
  // "Listo" commits the chosen positions via onSubmit(value:number[]).
  static renderRound(root, payload, { onSubmit } = {}) {
    const chars = [...(payload?.text || '')];
    const marked = new Set();
    root.innerHTML = `
      <div class="rc-line fs-3 text-center mb-3">${chars.map((ch, i) =>
        `${escapeHtml(ch)}${i < chars.length - 1 ? `<span class="rc-gap" data-pos="${i}" role="button"></span>` : ''}`
      ).join('')}</div>
      <div class="text-center"><button class="btn btn-success rt-done"><i class="bi bi-check2-circle"></i> Listo</button></div>
      <p class="text-muted small text-center mt-2">Toca el espacio donde falta una coma.</p>`;
    root.querySelectorAll('.rc-gap').forEach(el => el.addEventListener('click', () => {
      const pos = +el.dataset.pos;
      if (marked.has(pos)) { marked.delete(pos); el.classList.remove('rc-on'); el.textContent = ''; }
      else { marked.add(pos); el.classList.add('rc-on'); el.textContent = ','; }
    }));
    let done = false;
    root.querySelector('.rt-done').addEventListener('click', () => {
      if (done) return;
      done = true;
      root.querySelectorAll('.rc-gap').forEach(el => { el.style.pointerEvents = 'none'; });
      onSubmit?.([...marked].sort((a, b) => a - b));
    });
  }

  static migrateContent(content) { return content; }
}
