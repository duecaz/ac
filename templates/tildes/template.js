// Tildes (drag-drop variant). Drop a tilde onto each vowel that needs it.
// Uses Pointer Events for cross-input compatibility (mouse / touch / pen)
// without loading any canvas/IR module — that comes later as an optional
// alternative template (e.g. tildes-ir).
import { BaseTemplate } from '../base.js';
import { renderTildesPlayer } from './player.js';
import { renderTildesEditor } from './editor.js';
import { newPassage } from '../../core/contentModels/textCorrection.js';
import { parseAccentedText, isVowel, applyTilde } from '../../core/textMarks.js';
import { escapeHtml } from '../../core/html.js';
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

  // Render ONE passage as tappable vowels for the session formats (VS /
  // Equipos-auto). The student toggles a tilde on each vowel, then "Listo"
  // commits the chosen positions via onSubmit(value:number[]).
  static renderRound(root, payload, { onSubmit } = {}) {
    const text = payload?.text || '';
    const marked = new Set();
    root.innerHTML = `
      <div class="rt-passage fs-3 text-center mb-3">${[...text].map((ch, i) =>
        isVowel(ch)
          ? `<span class="rt-vowel" data-pos="${i}" role="button">${escapeHtml(ch)}</span>`
          : escapeHtml(ch)).join('')}</div>
      <div class="text-center"><button class="btn btn-success rt-done"><i class="bi bi-check2-circle"></i> Listo</button></div>
      <p class="text-muted small text-center mt-2">Toca las vocales que llevan tilde.</p>`;
    root.querySelectorAll('.rt-vowel').forEach(el => el.addEventListener('click', () => {
      const pos = +el.dataset.pos;
      if (marked.has(pos)) { marked.delete(pos); el.classList.remove('rt-on'); el.textContent = text[pos]; }
      else { marked.add(pos); el.classList.add('rt-on'); el.textContent = applyTilde(text[pos]); }
    }));
    let done = false;
    root.querySelector('.rt-done').addEventListener('click', () => {
      if (done) return;
      done = true;
      root.querySelectorAll('.rt-vowel').forEach(el => { el.style.pointerEvents = 'none'; });
      onSubmit?.([...marked].sort((a, b) => a - b));
    });
  }

  static migrateContent(content) { return content; }
}
