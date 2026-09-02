// Contract every template implements. Subclasses MUST override:
//   - static meta = { name, label, icon, contentModel, modes, defaultContent, defaultRules, ... }
//   - static renderPlayer(rootSel, activity, opts)   // SOLO + async-tracked
//   - static renderEditor(root, activity, onChange)
//   (La miniatura de la tarjeta NO se declara aquí: la pinta core/homePreview.js
//    con un dibujo ligero por tipo, y lo exige tests/homePreview.test.mjs. Hubo
//    un `static previewHtml(act)` en las 13 plantillas cuyo único consumidor
//    —core/activityThumb.js— llevaba tiempo sin importadores: dos contratos para
//    la misma tarjeta, uno fantasma. Retirado en v1.51.406.)
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
    // `modes.practice`, `needsImageUpload`, `needsAudioUpload` se quitaron del
    // contrato (barrido B1 2026-09-02): las 13 los declaraban y ningún módulo
    // los leía — nadie los leía.
    modes: { solo: false, live: false, async: false },
    defaultRules: () => ({}),
    defaultScoring: () => ({}),
    defaultLive: () => ({}),
    defaultContent: () => ({})
  };
  // OJO: estos dos son ABSTRACTOS y por eso son un `null` declarado, no un
  // stub que lanza. Con el stub, `typeof T.renderPlayer !== 'function'` en
  // `registry.js` era SIEMPRE falso —la subclase lo hereda— y la validación de
  // arranque de las DOS bocas obligatorias no podía fallar nunca. O sea: la
  // comprobación que existe para «fallar al arrancar en vez de a mitad de
  // partida» fallaba justo a mitad de partida, cuando un niño abría la
  // actividad y saltaba «renderPlayer not implemented». Comprobado registrando
  // una plantilla sin ninguna de las dos: entraba en el registro tan tranquila.
  static renderPlayer = null;
  static renderEditor = null;

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
