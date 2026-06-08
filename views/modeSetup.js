// Shared SETUP scaffold for every embedded game mode (VS, Equipos, Memoria).
//
// Why this exists: each mode used to hand-roll its own setup screen — header,
// subtitle, "Volver", Start button — and they drifted (different markup, a
// stray copy-paste bug, inconsistent spacing). This scaffold paints the SAME
// chrome for all of them, so a NEW mode (or a new activity playing an existing
// mode) gets the consistent look by construction. Each mode supplies only its
// own option controls (`body`) and reads them back in `onStart`.
//
// Contract (see docs/modos-de-juego.md):
//   host       DOM element (the activity stage) to render into.
//   icon       bootstrap-icon class, e.g. 'bi-fire'.
//   color      bootstrap color for the icon + Start button, e.g. 'danger'.
//   title      mode name, e.g. 'Duelo VS'.
//   subtitle   context line, e.g. 'Mi actividad · 8 preguntas'.
//   body       HTML string with the mode's option controls (name inputs,
//              team counter, scoring toggle, fx switches…). May be ''.
//   startLabel Start button text (default '¡Empezar!').
//   note       optional small print under the button.
//   backHref   optional. When set (standalone full-page route) a "Volver" link
//              is shown. In EMBEDDED use leave it undefined — the mode bar above
//              the stage is the way back, so no in-card back button.
//   onMount    optional (host) => void. Wire the option controls after paint.
//   onStart    () => void. Called when the user taps Start.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';

export function renderModeSetup(host, opts) {
  const {
    icon, color = 'secondary', title, subtitle = '', body = '',
    startLabel = '¡Empezar!', note = '', backHref, onMount, onStart
  } = opts;

  mount(host, html`
    <div class="ww-mode-setup text-center py-5">
      ${backHref ? `<a href="${backHref}" class="btn btn-sm btn-link"><i class="bi bi-arrow-left"></i> Volver</a>` : ''}
      <h3 class="mt-2 mb-1"><i class="bi ${icon} text-${color}"></i> ${escapeHtml(title)}</h3>
      ${subtitle ? `<p class="text-muted">${escapeHtml(subtitle)}</p>` : ''}
      <div class="ww-mode-setup-body">${body}</div>
      <button class="btn btn-${color} btn-lg px-5 ww-mode-start"><i class="bi bi-play-fill"></i> ${escapeHtml(startLabel)}</button>
      ${note ? `<p class="text-muted small mt-3">${escapeHtml(note)}</p>` : ''}
    </div>`);

  if (typeof onMount === 'function') onMount(host);
  on(host, 'click', '.ww-mode-start', () => { if (typeof onStart === 'function') onStart(); });
}
