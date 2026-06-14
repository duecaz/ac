// Contract every template implements. Subclasses MUST override:
//   - static meta = { name, label, icon, contentModel, modes, defaultContent, defaultRules, ... }
//   - static renderPlayer(rootSel, activity, opts)   // SOLO + async-tracked
//   - static renderEditor(root, activity, onChange)
// Optional but recommended:
//   - static getRoundPayload(activity, ctx)          // strip server-only data for LIVE
//   - static renderRound(root, payload, { onSubmit }) // interactive device round (LIVE/VS/Equipos)
//   - static renderRoundHost(root, ctx)              // read-only projector view (LIVE host)
//   - static scoreSubmission({ value, item, msTaken, activity })
//   - static migrateContent(content, fromVersion)
//   - static adoptContent(content, fromTemplate)  // adapta el contenido al CONVERTIR
//       hacia esta plantilla desde otra del MISMO contentModel pero distinta forma de
//       ítem (p. ej. Matemáticas→Quiz genera options[]). Lo invoca kernel/content/switch.js
//       (applySwitch). Reglas concretas en kernel/content/qaAdapt.js.
import { escapeHtml } from '../core/html.js';

export class BaseTemplate {
  static meta = {
    name: 'base',
    label: 'Base',
    icon: 'bi-puzzle',
    color: 'secondary',
    contentModel: null,
    templateVersion: 1,
    // Player frame aspect ratio. Default 16/10 (matches a 1280x800
    // interactive whiteboard exactly). Use '4/3', '16/9', '1/1' or 'auto'
    // (no forced ratio, height grows with content) when 16/10 doesn't fit.
    aspectRatio: '16/10',
    modes: { solo: false, live: false, async: false, practice: false },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules: () => ({}),
    defaultScoring: () => ({}),
    defaultLive: () => ({}),
    defaultContent: () => ({})
  };
  static renderPlayer() { throw new Error('renderPlayer not implemented'); }
  static renderEditor() { throw new Error('renderEditor not implemented'); }

  // Projector (host) view for LIVE. The host owns the chrome (timer, answered
  // count, controls); this only paints the round CONTENT into `root`.
  //   ctx = { phase:'question'|'reveal', item, payload, answers }
  // `item` is the FULL item (the host holds the key); `payload` is sanitized.
  // Default: prompt big + the answer on reveal. Live templates override for a
  // richer, branded projector display (quiz: colour grid + bars; text: passage).
  static renderRoundHost(root, { phase, item, payload } = {}) {
    const prompt = payload?.question ?? payload?.text ?? item?.question ?? item?.text ?? '';
    const answer = (phase === 'reveal' && item?.answer != null)
      ? `<p class="text-center text-success fw-bold fs-4"><i class="bi bi-check-circle-fill"></i> ${escapeHtml(String(item.answer))}</p>`
      : '';
    root.innerHTML = `<h2 class="text-center my-4">${escapeHtml(String(prompt))}</h2>${answer}`;
  }
}
