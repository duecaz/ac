// Pantalla de INICIO estándar de toda actividad (modo Individual).
//
// Por qué existe: hasta ahora solo algunos modos (VS/Equipos, vía
// views/modeSetup.js) mostraban una pantalla previa; el modo Individual saltaba
// directo al primer ítem, así que el alumno VEÍA el ejercicio antes de empezar y
// no había un lugar común para el título, las instrucciones y los ajustes. Esta
// pantalla lo estandariza: una sola tarjeta con Título + Instrucciones + Ajustes
// (sonido, efectos y, en Tildes/Comas, "Calibrar pizarra") + un botón grande
// "Iniciar" que SIEMPRE entra en pantalla completa.
//
// Contrato:
//   host      elemento/selector del escenario donde se pinta (#ww-player-widget).
//   activity  la actividad a jugar (ya con su tema/preview aplicado).
//   opts:
//     onStart      () => void|Promise. Arranca el juego de verdad. Requerido.
//     frame        elemento del marco a poner en pantalla completa (#ww-frame).
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { getTemplate } from '../core/registry.js';
import { toggleFullscreen } from '../core/fullscreen.js';
import { isMuted, setMuted } from '../core/sounds.js';
import { isEffectsMuted, setEffectsMuted } from '../core/effects.js';
import { openPenCalibration } from '../core/penCalibration.js';
import { playOptionsHtml, wirePlayOptions } from '../core/playOptions.js';

// Instrucciones: la actividad puede traerlas (futuro editor); si no, la plantilla
// puede declarar `meta.instructions`; y si tampoco, un texto genérico.
function activityInstructions(activity) {
  const T = getTemplate(activity?.template);
  return activity?.instructions || T?.meta?.instructions ||
    'Lee con atención y resuelve cada parte. Pulsa “Iniciar” cuando estés listo.';
}

const TOGGLE = (id, icon, label, on) => `
  <button type="button" class="ww-set-toggle ${on ? 'is-on' : ''}" data-toggle="${id}" aria-pressed="${on}">
    <i class="bi ${icon}"></i> <span>${escapeHtml(label)}</span>
    <span class="ww-set-state">${on ? 'Sí' : 'No'}</span>
  </button>`;

export function renderStartScreen(host, activity, opts = {}) {
  const { onStart, frame, onOption, choices } = opts;
  const T = getTemplate(activity?.template);
  const color = 'success';
  const soundOn = activity?.presentation?.sound !== false && !isMuted();
  const fxOn = !isEffectsMuted();
  const isText = T?.meta?.seMarcaConLapiz === true;

  mount(host, html`
    <div class="ww-start">
      <div class="ww-start-card">
        <div class="ww-start-icon"><i class="bi ${T?.meta?.icon || 'bi-puzzle'}"></i></div>
        <h2 class="ww-start-title">${escapeHtml(activity?.title || 'Actividad')}</h2>
        <p class="ww-start-instructions">${escapeHtml(activityInstructions(activity))}</p>

        <!-- OPCIONES DE PARTIDA que declara la plantilla (core/playOptions.js):
             se deciden AQUÍ, al lanzar, no en el editor. Van antes de los
             ajustes de sonido porque cambian el juego, no el ambiente. -->
        ${playOptionsHtml(T, activity, choices)}

        <div class="ww-start-settings">
          ${TOGGLE('sound', 'bi-volume-up-fill', 'Sonido', soundOn)}
          ${TOGGLE('fx', 'bi-stars', 'Efectos', fxOn)}
          ${isText ? `<button type="button" class="ww-set-toggle" data-calib><i class="bi bi-sliders"></i> <span>Calibrar pizarra</span></button>` : ''}
        </div>

        <button type="button" class="btn btn-${color} btn-lg ww-start-go">
          <i class="bi bi-play-fill"></i> Iniciar
        </button>
      </div>
    </div>`);

  const el = typeof host === 'string' ? document.querySelector(host) : host;

  // Ajustes
  on(el, 'click', '[data-toggle="sound"]', (e, t) => {
    const next = !(t.getAttribute('aria-pressed') === 'true');
    setMuted(!next); paintToggle(t, next);
  });
  on(el, 'click', '[data-toggle="fx"]', (e, t) => {
    const next = !(t.getAttribute('aria-pressed') === 'true');
    setEffectsMuted(!next); paintToggle(t, next);
  });
  on(el, 'click', '[data-calib]', () => openPenCalibration());
  wirePlayOptions(el, (id, value) => onOption?.(id, value));

  // Iniciar → SIEMPRE pantalla completa, luego arranca el juego.
  // Guard de una sola entrada: en pizarra táctil un doble-tap rápido (antes de que
  // resuelva el import() del player) disparaba onStart DOS veces → doble
  // mountSoloAnimator + doble runMode + doble requestFullscreen. `started` corta
  // el segundo toque y deshabilitamos el botón para feedback visual.
  let started = false;
  on(el, 'click', '.ww-start-go', (_, btn) => {
    if (started) return;
    started = true;
    if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }
    const target = frame || el.closest('#ww-frame') || document.getElementById('ww-frame');
    if (target && !document.fullscreenElement && !document.webkitFullscreenElement) {
      toggleFullscreen(target); // ya es no-op seguro si el navegador lo deniega
    }
    if (typeof onStart === 'function') onStart();
  });

  return { dispose() {} };
}

function paintToggle(t, on) {
  t.setAttribute('aria-pressed', on ? 'true' : 'false');
  t.classList.toggle('is-on', on);
  const st = t.querySelector('.ww-set-state');
  if (st) st.textContent = on ? 'Sí' : 'No';
}
