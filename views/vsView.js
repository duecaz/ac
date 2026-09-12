// VS view — head-to-head duel on ONE shared touchscreen. Two activities run in
// PARALLEL: alumno 1 plays the left panel, alumno 2 the right, each racing
// through the SAME item sequence at their own pace. A central tug-of-war bar,
// fed by the session engine's standings(), shows who's winning in real time.
//
// The flow/scoring live entirely in kernel/session/vsMachine.js (via the
// engine.js facade, format 'vs'); this view only paints panels and reflects
// standings — no game logic here.
//
// EMBEDDING: mountVs(host, activity, ctx, opts) renders setup + duel INTO `host`
// (the activity stage) and returns { dispose } so the page can stop the central
// animation when switching modes. (El wrapper de ruta suelta se eliminó: las
// rutas #/vs/:id montan vía renderPlayerView → runMode, no había otro caller.)
//
// LO QUE QUEDA AQUÍ es la ANTESALA del duelo (nombres, avatares, ambiente) y el
// ciclo de vida; el encuentro en sí —paneles, barra, animación central y
// podio— vive en `views/vs/arena.js` desde la Fase 6 del plan de simplificar.
import { acquire, release } from '../core/lifecycle.js';
import { html, escapeHtml, mount, $val } from '../core/html.js';
import { on } from '../core/events.js';
import { save } from '../core/storage.js';
import { lsGet, lsSet } from '../core/ls.js';
import { getTemplate } from '../core/registry.js';
import { vsFeedback, setVsFeedback, vsAnimacionOn, setVsAnimacion } from '../core/presentation.js';
import { esHojaDeTexto } from '../core/contentModels/textCorrection.js';
import { isVsCompatible } from '../kernel/session/engine.js';
import { sessionItems } from '../kernel/content/sessionItems.js';
import { renderAntesala } from './antesala.js';
import { montarArena } from './vs/arena.js';
import { uploadMedia } from '../core/upload.js';
import { mensajeDe } from '../core/frontera.js';
const AVATAR_MAX_BYTES = 150 * 1024; // tope del avatar (lo aplica uploadMedia, comprimiendo antes)
const AVATAR_LADO_MAX = 512;         // px del lado mayor: se ve en una pastilla, no a pantalla

/** @typedef {import('../kernel/contracts/activity.js').Activity} Activity */
/** @typedef {import('../core/registry.js').PlantillaRegistrada} PlantillaRegistrada */
/** @typedef {import('../core/playOptions.js').PlayChoices} PlayChoices */
/** UN LADO del duelo. La vista solo habla de estos dos.
 *  @typedef {'left'|'right'} Lado */
/** LA SESIÓN DEL DUELO. `createSession` despacha a las tres máquinas y devuelve
 *  la unión; el formato lo fija esta vista (`FORMATS.VS`), así que aquí se nombra
 *  la que es.
 *  @typedef {ReturnType<typeof import('../kernel/session/vsMachine.js').createVsSession>} SesionVs */
/** El marcador tal y como lo entrega el motor.
 *  @typedef {ReturnType<SesionVs['standings']>} MarcadorCrudo */
/** El marcador que sale de aquí (a `opts.onFinish`, p.ej. views/listView.js):
 *  el del motor tal cual, que ya declara `leader`/`finishedBy` como un lado o
 *  ninguno (`VsSideId` en kernel/session/vsMachine.js).
 *  @typedef {MarcadorCrudo} Marcador */
/** LA PLANTILLA DEL DUELO: la registrada, con las dos bocas que `isVsCompatible`
 *  —y el contrato antes que él— EXIGEN a quien declara `play.vs`, así que aquí ya
 *  no son opcionales.
 *  @typedef {PlantillaRegistrada
 *    & Required<Pick<PlantillaRegistrada, 'renderRound'|'scoreSubmission'>>} PlantillaDuelo */
/**
 * Lo que el padre puede pedirle al duelo. `leftName`/`rightName` + `onFinish`
 * son del orquestador de listas (views/listView.js): con los dos nombres ya
 * puestos, el duelo se salta la antesala y le devuelve el marcador al terminar.
 * @typedef {Object} OpcionesDuelo
 * @property {string} [backHref]
 * @property {string} [leftName]
 * @property {string} [rightName]
 * @property {(st: Marcador) => void} [onFinish]
 */

// El feedback por respuesta y la animación central son AMBIENTE del duelo, y su
// dueño es `core/presentation.js` (§21b): esta vista los LEE y los ESCRIBE por
// sus métodos, nunca con constantes propias. Tenía una copia de los defectos
// —y el editor otra—, así que retirar el interruptor de sonido pidió tocar los
// dos ficheros y el defecto de la animación no coincidía entre ambos.

// Avatar helpers — stored in localStorage keyed by activity id so they never
// bloat the activity JSON and survive across sessions on the same device.
/** @param {string} actId @param {Lado} side */
function avatarKey(actId, side) { return `ww.vsavatar.${actId}.${side}`; }
/** @param {string} actId @param {Lado} side @returns {string} */
function loadAvatar(actId, side) { return lsGet(avatarKey(actId, side), '') || ''; }
/** @param {string} actId @param {Lado} side @param {string} dataUrl */
function saveAvatar(actId, side, dataUrl) { lsSet(avatarKey(actId, side), dataUrl); }

/** @param {string} dataUrl @param {Lado} side */
function avatarPreviewHtml(dataUrl, side) {
  if (dataUrl) return `<img src="${escapeHtml(dataUrl)}" class="vs-av-thumb" alt="">`;
  return `<span class="vs-av-empty"><i class="bi bi-${side === 'left' ? 'person' : 'person'}-circle fs-1 text-muted"></i></span>`;
}

// Embedded entry point. `host` is the stage: el elemento o su SELECTOR (así lo
// declara core/modes.js y así lo pasa views/playerView.js). Returns { dispose }.
/**
 * @param {string|Element} host
 * @param {Activity} a
 * @param {ReturnType<import('../core/lifecycle.js').acquire>|null} [ctx]
 * @param {OpcionesDuelo} [opts]
 * @returns {{dispose: () => void}}
 */
export function mountVs(host, a, ctx, opts = {}) {
  const backHref = opts.backHref;
  if (!isVsCompatible(a)) {
    mount(host, html`
      <div class="alert alert-info m-3">
        <h5><i class="bi bi-people"></i> Modo VS no disponible para esta actividad</h5>
        <p class="mb-2">El duelo 1‑contra‑1 necesita una plantilla que se pueda puntuar
        automáticamente y <b>2 o más preguntas</b> para que sea una carrera justa.</p>
        ${backHref ? `<a href="${backHref}" class="btn btn-sm btn-outline-secondary">Volver a la actividad</a>` : ''}
      </div>`);
    return { dispose() {} };
  }

  const fxCfg = () => vsFeedback(a);
  // ¿SE VE LA ANIMACIÓN CENTRAL? UN solo sitio lo decide, porque lo preguntan
  // TRES: el interruptor de la antesala, el montaje del duelo y el panel del
  // editor. Si cada uno lo calculara por su cuenta, el interruptor podría salir
  // encendido y la animación no aparecer (o al revés) — mentirle al profe sobre
  // lo que va a ver es peor que no ofrecer el interruptor. Y pasaba: el editor
  // usaba `!vsAnimationOff` a secas y decía «sí» en Tildes/Comas, donde el duelo
  // la apaga sola porque su texto necesita el ancho.
  // Quién es «una hoja de texto» lo sabe la PLANTILLA; el dueño del ajuste
  // (core/presentation.js) solo recibe ese dato.
  const animOn = () => vsAnimacionOn(a, { textTight: esHojaDeTexto(a) });
  // EL ENCUENTRO EN CURSO (views/vs/arena.js), si lo hay: la antesala y el
  // desmontaje lo sueltan, que es lo único que esta vista necesita saber de él.
  /** @type {{destroy: () => void}|null} */
  let arena = null;
  // Ley de vista §23: los setTimeout de RITMO (destello, celebración, confeti)
  // se registran en el lifecycle — un cambio de modo o de ruta a mitad de
  // destello ya no repinta (renderSide/finish) sobre la vista siguiente. Era la
  // última vista de views/ fuera de la norma. (`life`, no `ctx`: el parámetro
  // `ctx` de mountVs es el contexto que ya pasa el padre.)
  const life = acquire('vsView');
  // La plantilla EXISTE y trae sus dos bocas: lo acaba de comprobar
  // `isVsCompatible` (si no, arriba se vuelve con el aviso).
  const T = /** @type {PlantillaDuelo} */ (getTemplate(a.template));
  // Opciones de partida elegidas en el setup (core/playOptions.js). Se aplican
  // a una COPIA al arrancar el duelo: la actividad guardada no se toca.
  /** @type {PlayChoices} */
  let playChoices = {};

  // List-orchestrator mode: skip setup screen and jump straight to the match.
  if (opts.leftName && opts.rightName) {
    startMatch(opts.leftName, opts.rightName);
  } else {
    renderSetup();
  }

  // Names + start. Defaults let the teacher launch in one tap. The header,
  // subtitle and Start button come from the shared scaffold; this only supplies
  // the VS-specific options (names + feedback toggles).
  function renderSetup() {
    if (arena) { arena.destroy(); arena = null; }
    const fx = fxCfg();
    // EL AMBIENTE DEL DUELO son PASTILLAS, como en las demás antesalas (dueño
    // 2026-09-01: «VS tiene bastante más opciones»). Eran interruptores de
    // Bootstrap con su explicación debajo, dentro de un desplegable propio: el
    // mismo ajuste que en Individual es una pastilla, aquí pedía abrir un panel
    // y leer cuatro filas. La explicación viaja en el `title`; lo que cambia el
    // JUEGO (no el ambiente) sigue arriba, en las opciones de partida.
    // El interruptor de la animación va INVERTIDO respecto al dato guardado
    // (`vsAnimationOff`): al profe se le pregunta si la QUIERE, no si la apaga.
    // Su defecto no es fijo — lo decide la plantilla si su texto es apretado
    // (`textTight`), y por eso se lee igual que en el duelo, no con un `?? false`.
    const ambienteExtra = [
      { id: 'flash', icon: 'bi-lightning-charge-fill', label: 'Destello', on: !!fx.flash,
        hint: 'Fondo verde al acertar, rojo al fallar.' },
      { id: 'confetti', icon: 'bi-balloon-heart-fill', label: 'Confeti', on: !!fx.confetti,
        hint: 'Lluvia de confeti en cada acierto (desactivado por defecto).' },
      { id: 'anim', icon: 'bi-easel-fill', label: 'Animación', on: animOn(),
        hint: 'El dibujo entre los dos paneles. Apagada, cada jugador gana la mitad del ancho.' },
    ];

    const avLeft  = loadAvatar(a.id, 'left');
    const avRight = loadAvatar(a.id, 'right');

    /** @param {Lado} side @param {string} label @param {string} defaultName @param {string} avData */
    const avatarCol = (side, label, defaultName, avData) => `
      <div class="col-6">
        <label class="form-label small text-muted fw-semibold">${label}</label>
        <div class="vs-av-upload-wrap">
          <div class="vs-av-preview" id="vs-av-${side}">${avatarPreviewHtml(avData, side)}</div>
          <label class="btn btn-sm btn-outline-secondary vs-av-btn" title="Máx 150 KB · JPG/PNG/WebP">
            <i class="bi bi-image"></i> Foto
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" id="vs-file-${side}" hidden>
          </label>
          ${avData ? `<button class="btn btn-sm btn-outline-danger vs-av-clear" data-side="${side}" title="Quitar imagen"><i class="bi bi-x-lg"></i></button>` : ''}
        </div>
        <input id="vs-name-${side}" class="form-control text-center mt-2"
               value="${escapeHtml(defaultName)}" maxlength="20" placeholder="${escapeHtml(defaultName)}">
        <div class="vs-av-err text-danger small mt-1" id="vs-av-err-${side}" hidden></div>
      </div>`;

    const body = `
      <div class="row justify-content-center g-3 mb-3" style="max-width:520px;margin:auto">
        ${avatarCol('left',  'Equipo izquierda', 'Alumno 1', avLeft)}
        ${avatarCol('right', 'Equipo derecha',   'Alumno 2', avRight)}
      </div>`;

    renderAntesala(host, {
      activity: a,
      icon: 'bi-fire', color: 'danger', title: 'Duelo VS',
      subtitle: `${a.title} · ${sessionItems(a).length} preguntas`,
      bodyHtml: body, backHref,
      // LA ANIMACIÓN, DECISIÓN DEL DOCENTE Y EN LA ANTESALA (dueño, 2026-08-22).
      // El dibujo central se lleva la mitad del ancho, así que los dos paneles
      // se quedan con un cuarto cada uno: en una ventana de 908px eso son 209px
      // por alumno. Apagarla es la diferencia entre una calculadora cómoda y una
      // estrecha, y esa decisión la toma quien monta la clase.
      ambienteExtra,
      onAmbiente: (id, encendido) => {
        // Las pastillas que llegan aquí son LAS TRES de `ambienteExtra` (sonido y
        // efectos los guarda la antesala): la animación tiene su propio dueño y
        // las otras dos son interruptores del feedback.
        if (id === 'anim') save(setVsAnimacion(a, encendido));
        else if (id === 'flash' || id === 'confetti') save(setVsFeedback(a, id, encendido));
      },
      // Opciones de partida de la plantilla (p.ej. Pelotas: tiempo o
      // movimientos). Se aplican a la copia de juego al arrancar, no a la
      // actividad guardada.
      playOpts: { T, activity: a, choices: playChoices, onChange: (id, v) => { if (id) playChoices = { ...playChoices, [id]: v }; } },
      note: 'Cada jugador responde en su lado. Gana quien sume más puntos.',
      onMount: () => {
        // Los interruptores de ambiente los cablea la antesala (onAmbiente):
        // aquí solo queda lo que es del duelo y de nadie más — los avatares.
        // Avatar upload — validate size, read as data-URL, cache in localStorage.
        // DELEGADO con on() (idempotente por raíz+evento+selector): renderSetup se
        // re-ejecuta en "Otra vez" y el addEventListener directo apilaba un listener
        // por pasada (leak + disparos duplicados).
        // La foto de móvil pasa por el MISMO camino que toda imagen de la app
        // (core/upload.js: reescala + WebP hasta entrar en el tope) — antes
        // había un FileReader propio que rebotaba a 150 KB sin comprimir.
        on(host, 'change', 'input[id^="vs-file-"]', async (e, input) => {
          const campo = /** @type {HTMLInputElement} */ (input);
          const side = /** @type {Lado} */ (campo.id.endsWith('left') ? 'left' : 'right');
          const file = campo.files?.[0];
          if (!file) return;
          const errEl = document.getElementById(`vs-av-err-${side}`);
          try {
            const data = await uploadMedia(file, { maxBytes: AVATAR_MAX_BYTES, ladoMax: AVATAR_LADO_MAX });
            if (errEl) errEl.hidden = true;
            saveAvatar(a.id, side, data);
            const preview = document.getElementById(`vs-av-${side}`);
            if (preview) preview.innerHTML = `<img src="${escapeHtml(data)}" class="vs-av-thumb" alt="">`;
          } catch (err) {
            if (errEl) {
              errEl.textContent = mensajeDe(err);
              errEl.hidden = false;
            }
            campo.value = '';
          }
        });

        // Clear avatar button (only rendered when an avatar exists).
        on(host, 'click', '.vs-av-clear', (_, btn) => {
          const side = /** @type {Lado} */ (btn.dataset.side === 'right' ? 'right' : 'left');
          saveAvatar(a.id, side, '');
          const preview = document.getElementById(`vs-av-${side}`);
          if (preview) preview.innerHTML = avatarPreviewHtml('', side);
          btn.remove();
        });
      },
      onStart: () => {
        const left  = $val('#vs-name-left').trim() || 'Alumno 1';
        const right = $val('#vs-name-right').trim() || 'Alumno 2';
        startMatch(left, right);
      }
    });
  }

  // EL ENCUENTRO lo juega `views/vs/arena.js`: esta vista le entrega lo que ha
  // reunido (la plantilla, el ambiente ya resuelto, los avatares, los nombres) y
  // se queda con el mando para soltarlo.
  /** @param {string} leftName @param {string} rightName */
  function startMatch(leftName, rightName) {
    if (arena) { arena.destroy(); arena = null; }
    arena = montarArena(host, {
      a, T, life, playChoices,
      fx: fxCfg(), animOn: animOn(),
      avatars: { left: loadAvatar(a.id, 'left'), right: loadAvatar(a.id, 'right') },
      leftName, rightName, backHref,
      onFinish: opts.onFinish,
      onAgain: () => renderSetup(),
    });
  }

  return { dispose() {
    release('vsView');   // drena los timeouts de ritmo (el padre nos desmonta sin hashchange)
    if (arena) { arena.destroy(); arena = null; }
  } };
}
