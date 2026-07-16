// Random wheel: spin, land on one entry. Solo/practice + Live (teacher-scored).
import { BaseTemplate } from '../base.js';
import { renderWheelPlayer } from './player.js';
import { renderWheelEditor } from './editor.js';
import { wheelSvg } from './render.js';
import { escapeHtml } from '../../core/html.js';

export class WheelTemplate extends BaseTemplate {
  static meta = {
    name: 'wheel',
    label: 'Ruleta',
    icon: 'bi-bullseye',
    color: 'success',
    contentModel: 'items',
    templateVersion: 2,
    instructions: 'Gira la ruleta y responde la pregunta que toque.',
    aspectRatio: '1/1',
    modes: { solo: true, live: true, async: false, practice: true },
    needsImageUpload: true,   // wheel/editor.js: imagen opcional por entrada (data-URL, 200 KB)
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

  // Preview de tarjeta: la ruleta con sus entradas (reusa el mismo wheelSvg del
  // player). Sin entradas → porciones numeradas para que siempre parezca ruleta.
  static previewHtml(act) {
    const items = act.content?.entries || act.content?.items || act.content?.words || [];
    let labels = items.map(i => typeof i === 'string' ? i : (i.q || i.text || i.label || i.question || ''))
      .filter(Boolean).slice(0, 8);
    if (!labels.length) {
      const n = Math.min(8, Math.max(4, items.length || 4));
      labels = Array.from({ length: n }, (_, i) => String(i + 1));
    }
    return `<div class="ww-player" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem">
      ${wheelSvg(labels, { size: 520 })}
      <div class="fs-4 fw-semibold text-center">${escapeHtml(act.title || 'Ruleta')}</div>
    </div>`;
  }
}
