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
//   playOpts   optional { T, activity, choices, onChange(id, value) }. OPCIONES
//              DE PARTIDA que declara la plantilla (core/playOptions.js): "cómo
//              se gana" en Ordena las Pelotas, por ejemplo. Se pintan arriba del
//              `body` porque cambian el JUEGO, no la configuración del modo; y
//              se deciden aquí, al lanzar, en vez de obligar a entrar al editor
//              con la clase esperando.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { toggleFullscreen } from '../core/fullscreen.js';
import { playOptionsHtml, wirePlayOptions } from '../core/playOptions.js';

export function renderModeSetup(host, opts) {
  const {
    icon, color = 'secondary', title, subtitle = '', body = '',
    startLabel = '¡Empezar!', note = '', backHref, onMount, onStart, playOpts
  } = opts;

  mount(host, html`
    <div class="ww-mode-setup text-center py-5">
      ${backHref ? `<a href="${backHref}" class="btn btn-sm btn-link"><i class="bi bi-arrow-left"></i> Volver</a>` : ''}
      <h3 class="mt-2 mb-1"><i class="bi ${icon} text-${color}"></i> ${escapeHtml(title)}</h3>
      ${subtitle ? `<p class="text-muted">${escapeHtml(subtitle)}</p>` : ''}
      ${playOpts ? playOptionsHtml(playOpts.T, playOpts.activity, playOpts.choices) : ''}
      <div class="ww-mode-setup-body">${body}</div>
      <div class="d-flex justify-content-center gap-3 mt-4 flex-wrap">
        <!-- DOS botones, DOS textos: los dos ponían «¡Empezar!» y solo cambiaba
             el icono, así que parecía el mismo botón duplicado (lo vio el dueño
             en una captura). Empiezan igual; lo que los separa es que el
             segundo abre a pantalla completa, y eso es lo que dice. -->
        <button class="btn btn-outline-${color} btn-lg px-4 ww-mode-start"><i class="bi bi-play-fill"></i> ${escapeHtml(startLabel)}</button>
        <button class="btn btn-${color} btn-lg px-4 ww-mode-start-fs"><i class="bi bi-arrows-fullscreen"></i> Pantalla completa</button>
      </div>
      ${note ? `<p class="text-muted small mt-3">${escapeHtml(note)}</p>` : ''}
    </div>`);

  if (typeof onMount === 'function') onMount(host);
  if (playOpts) wirePlayOptions(host, (id, value) => playOpts.onChange?.(id, value));
  on(host, 'click', '.ww-mode-start', () => { if (typeof onStart === 'function') onStart(); });
  on(host, 'click', '.ww-mode-start-fs', () => {
    if (typeof onStart === 'function') onStart();
    // host may be a CSS selector string or a DOM element — resolve to element first.
    const el = typeof host === 'string' ? document.querySelector(host) : host;
    const frame = el?.closest('#ww-frame') || document.getElementById('ww-frame') || el;
    toggleFullscreen(frame);
  });
}
