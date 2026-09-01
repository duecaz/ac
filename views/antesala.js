// LA ANTESALA — la ÚNICA pantalla de «antes de jugar» del sistema.
//
// Había CUATRO, y cada una decidía por su cuenta lo mismo (dueño 2026-09-01:
// «las actividades tienen looks distintos… debemos estandarizar»):
//   · Individual (`startScreen`) — UN botón que SIEMPRE entra en pantalla
//     completa, con instrucciones y ajustes de ambiente, en su propia tarjeta.
//   · VS · Equipos · Memoria · Lista (`modeSetup`) — DOS botones («¡Empezar!»
//     y «Pantalla completa»), sin instrucciones y con chrome de Bootstrap.
//   · Tarea — dos formularios seguidos: sin instrucciones, sin ambiente y sin
//     pantalla completa. Justo el modo en el que el alumno juega SOLO, sin
//     nadie al lado a quien preguntar cómo se juega.
//   · Lobby en vivo — «Empezar» con el botón de pantalla completa aparte.
// Cuatro contratos para el MISMO momento: lo que veías dependía de por dónde
// habías entrado.
//
// LAS REGLAS, decididas aquí y no en cada vista:
//   1. UN control de arranque, marcado `data-ww-start`. «Normal o pantalla
//      completa» no es una decisión del que va a jugar: en clase se proyecta
//      siempre, y salir es Esc o el botón de la esquina del marco. El segundo
//      botón ya se había tocado una vez (los dos decían «¡Empezar!»); se
//      arregló el texto y no la duplicación.
//   2. La pantalla completa se pide sobre el MARCO. Si el marco todavía no
//      existe —la tarea lo monta al comenzar—, se monta primero y se pide
//      después: sigue siendo el mismo gesto del usuario, que es lo que el
//      navegador exige.
//   3. Se cuenta CÓMO SE JUEGA. `meta.instructions` es obligatorio por
//      contrato y hasta hoy lo leía un modo de cuatro.
//   4. El AMBIENTE (sonido, efectos y lo que añada el modo) es una fila de
//      pastillas IGUALES en todas: el mismo ajuste con la misma cara. En el
//      duelo eran interruptores de Bootstrap dentro de un desplegable.
// Lo que la antesala NO conoce: el cuerpo propio de cada modo (los avatares
// del duelo, el número de equipos, los intentos de la tarea). Eso lo pone el
// modo en `body` — la antesala no sabe qué modos existen.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { getTemplate } from '../core/registry.js';
import { toggleFullscreen, isFullscreen } from '../core/fullscreen.js';
import { marcoActual } from '../core/gameFrame.js';
import { isMuted, setMuted } from '../core/sounds.js';
import { isEffectsMuted, setEffectsMuted } from '../core/effects.js';
import { openPenCalibration } from '../core/penCalibration.js';
import { playOptionsHtml, wirePlayOptions } from '../core/playOptions.js';

/** Cómo se juega: lo que diga la actividad, si no su plantilla, si no lo genérico. */
export function instruccionesDe(activity) {
  const T = getTemplate(activity?.template);
  return activity?.instructions || T?.meta?.instructions ||
    'Lee con atención y resuelve cada parte. Pulsa “Iniciar” cuando estés listo.';
}

const pastilla = ({ id, icon, label, on: encendido, hint = '' }) => `
  <button type="button" class="ww-set-toggle ${encendido ? 'is-on' : ''}" data-toggle="${escapeHtml(id)}"
          aria-pressed="${encendido}"${hint ? ` title="${escapeHtml(hint)}"` : ''}>
    <i class="bi ${escapeHtml(icon)}"></i> <span>${escapeHtml(label)}</span>
    <span class="ww-set-state">${encendido ? 'Sí' : 'No'}</span>
  </button>`;

function pintarPastilla(t, encendido) {
  t.setAttribute('aria-pressed', encendido ? 'true' : 'false');
  t.classList.toggle('is-on', encendido);
  const st = t.querySelector('.ww-set-state');
  if (st) st.textContent = encendido ? 'Sí' : 'No';
}

/**
 * @param {Element|string} host  dónde se pinta (escenario del juego o página).
 * @param {object} o
 *   activity      la actividad (de ahí salen instrucciones, icono y título por defecto).
 *   icon·color·title·subtitle   identidad del modo («Duelo VS», bi-fire, danger).
 *   instructions  texto explícito; '' lo oculta (una LISTA no tiene uno).
 *   playOpts      { T, activity, choices, onChange } — opciones de partida de la plantilla.
 *   ambienteExtra pastillas propias del modo: [{ id, icon, label, on, hint }].
 *   onAmbiente    (id, encendido) => void, para esas pastillas propias.
 *   bodyHtml      cuerpo específico del modo. La antesala no lo interpreta.
 *   badgesHtml    distintivos cortos bajo el título (intentos, fecha límite).
 *   startLabel·note·backHref
 *   onMount(el)   cablear el cuerpo tras pintar.
 *   onStart()     arrancar el juego. Puede DEVOLVER el elemento al que pedir la
 *                 pantalla completa (la tarea monta su marco justo ahí); si no
 *                 devuelve nada, se usa el marco de la página y, en último
 *                 término, el propio escenario.
 *
 * TODO lo que se pasa se escapa, MENOS lo que termina en `Html` — así se sabe
 * de un vistazo en qué mitad está cada campo. Cuando se llamaban `body` y
 * `badges` a secas, la lista escapaba su título y la antesala lo escapaba otra
 * vez: «Repaso & Ampliación» salía como «Repaso &amp; Ampliación».
 */
export function renderAntesala(host, o = {}) {
  const {
    activity, icon, color = 'success', title, subtitle = '', badgesHtml = '',
    instructions, playOpts, ambienteExtra = [], onAmbiente,
    bodyHtml = '', startLabel = 'Iniciar', note = '', backHref,
    onMount, onStart,
  } = o;

  const T = getTemplate(activity?.template);
  const texto = instructions === undefined ? instruccionesDe(activity) : instructions;
  // Sonido y efectos son AJUSTES GLOBALES del aparato (core/sounds · core/effects);
  // los extra son del modo y los guarda el modo (el duelo, en la actividad).
  const pastillas = [
    { id: 'sound', icon: 'bi-volume-up-fill', label: 'Sonido',
      on: activity?.presentation?.sound !== false && !isMuted() },
    { id: 'fx', icon: 'bi-stars', label: 'Efectos', on: !isEffectsMuted() },
    ...ambienteExtra,
  ];
  // CALIBRAR NO ES AMBIENTE: es la herramienta de la pizarra en las hojas que se
  // marcan con lápiz. Va aparte para que nadie la arrastre al mover la fila.
  const calibrar = T?.meta?.seMarcaConLapiz === true;

  // `mount` resuelve el host y DEVUELVE el elemento: buscarlo otra vez con
  // querySelector era una consulta de más en la pantalla por la que pasan los
  // seis caminos.
  const el = mount(host, html`
    <div class="ww-start ww-antesala">
      <div class="ww-start-card">
        ${backHref ? `<a href="${backHref}" class="btn btn-sm btn-link"><i class="bi bi-arrow-left"></i> Volver</a>` : ''}
        <div class="ww-start-icon text-${escapeHtml(color)}"><i class="bi ${escapeHtml(icon || T?.meta?.icon || 'bi-puzzle')}"></i></div>
        <h2 class="ww-start-title">${escapeHtml(title || activity?.title || 'Actividad')}</h2>
        ${subtitle ? `<p class="ww-antesala-sub">${escapeHtml(subtitle)}</p>` : ''}
        ${badgesHtml ? `<div class="ww-antesala-badges">${badgesHtml}</div>` : ''}
        ${texto ? `<p class="ww-start-instructions">${escapeHtml(texto)}</p>` : ''}
        ${playOpts ? playOptionsHtml(playOpts.T, playOpts.activity, playOpts.choices) : ''}
        ${bodyHtml ? `<div class="ww-antesala-body">${bodyHtml}</div>` : ''}
        ${pastillas.length || calibrar ? `<div class="ww-start-settings">
          ${pastillas.map(pastilla).join('')}
          ${calibrar ? `<button type="button" class="ww-set-toggle" data-calib><i class="bi bi-sliders"></i> <span>Calibrar pizarra</span></button>` : ''}
        </div>` : ''}
        <button type="button" class="btn btn-${escapeHtml(color)} btn-lg ww-start-go" data-ww-start>
          <i class="bi bi-play-fill"></i> ${escapeHtml(startLabel)}
        </button>
        ${note ? `<p class="ww-antesala-note">${escapeHtml(note)}</p>` : ''}
      </div>
    </div>`);

  if (typeof onMount === 'function') onMount(el);

  // LOS OYENTES SE SUELTAN AL ARRANCAR (§23). Van delegados en el host —que en
  // la tarea es `#app` y en los modos embebidos el escenario—, dos elementos que
  // SOBREVIVEN a la antesala: sin soltarlos, cada toque de la partida entera
  // seguía pagando el `closest()` de cuatro selectores muertos, y sus closures
  // retenían el cuerpo de la antesala (en el duelo, dos avatares en base64).
  const sueltos = [
    on(el, 'click', '.ww-set-toggle[data-toggle]', (_, t) => {
      const id = t.dataset.toggle;
      const next = !(t.getAttribute('aria-pressed') === 'true');
      if (id === 'sound') setMuted(!next);
      else if (id === 'fx') setEffectsMuted(!next);
      else onAmbiente?.(id, next);
      pintarPastilla(t, next);
    }),
    on(el, 'click', '[data-calib]', () => openPenCalibration()),
    wirePlayOptions(el, (id, value) => playOpts?.onChange?.(id, value)),
  ];
  const soltar = () => { for (const off of sueltos) off?.(); };

  // ARRANCAR. Guard de una sola entrada: en pizarra táctil un doble-tap rápido
  // (antes de que resuelva el import() del player) disparaba onStart DOS veces →
  // doble animación + doble runMode + doble requestFullscreen.
  //
  // LA GEOMETRÍA SE DECIDE ANTES DE PINTAR EL JUEGO. La pantalla completa cambia
  // el tamaño de TODO, así que si se pide después de montar, la actividad nace
  // con una medida y se recalcula a la vista — un salto que el dueño cazó al
  // instante. Por eso se pide PRIMERO, sobre el marco que ya está en la página;
  // solo si no hay ninguno (la tarea monta el suyo al comenzar, la lista no
  // monta) se arranca y se pide después, con lo que `onStart` devuelva.
  let started = false;
  const arrancar = (btn) => {
    if (started) return;
    started = true;
    if (btn) btn.disabled = true;
    const marco = marcoActual();
    if (marco && !isFullscreen()) toggleFullscreen(marco);   // no-op si el navegador la deniega
    const suyo = typeof onStart === 'function' ? onStart() : null;
    if (!marco && !isFullscreen()) toggleFullscreen(suyo || marcoActual() || el);
    soltar();
  };
  sueltos.push(on(el, 'click', '[data-ww-start]', (_, btn) => arrancar(btn)));

  // `dispose` de verdad: la vista que monta la antesala y se va antes de que
  // nadie pulse (cambiar de modo, salir de la ruta) suelta sus oyentes con esto.
  return { dispose: soltar };
}
