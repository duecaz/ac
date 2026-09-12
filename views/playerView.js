// LA PÁGINA DE JUGAR (estilo Wordwall): monta el MODO elegido dentro del marco
// y reúne a su alrededor las tres piezas que la visten — cabecera, «otra
// plantilla» y apariencia. Cada una tiene su módulo en `views/player/`; aquí
// queda solo lo que es de la página: cargar la actividad, gatear que sea
// jugable, el marco y el ciclo de vida del modo activo.
//
// El marco es un "embed" acotado (proporción por plantilla, core/frameAspect.js);
// en móvil vertical se suelta y crece a lo alto.
import { html, escapeHtml, mount, $$ } from '../core/html.js';
import { on } from '../core/events.js';
import { getAnywhere } from '../core/storage.js';
import { revisarActividad, pantallaNoListaHtml } from '../core/activityCheck.js';
import { getTemplate } from '../core/registry.js';
import { availableModes, getMode, runMode, modeNeedsAuth, modeAuthHint } from '../core/modes.js';
import { canHost } from '../core/authGate.js';
import { getAuthUserId } from '../core/auth.js';
import { pedirCuentaParaModo } from './loginModal.js';
import { renderAntesala } from './antesala.js';
import { fullscreenButtonHtml, attachFullscreenButton } from '../core/fullscreen.js';
import { applyPlayOptions } from '../core/playOptions.js';
import { acquire } from '../core/lifecycle.js';
import { toast } from '../core/toast.js';
import { mountSoloAnimator } from '../core/soloAnimator.js';
import { aspectStyle, ASPECTO_POR_DEFECTO } from '../core/frameAspect.js';
import { destinoTrasJugar } from '../core/afterPlay.js';
import { resetScene } from '../core/presentation.js';
import { crearApariencia } from './player/apariencia.js';
import { otraPlantillaHtml, wireOtraPlantilla } from './player/otraPlantilla.js';
import { cabeceraPaginaHtml, wireCabeceraPagina } from './player/cabecera.js';
/** @typedef {import('../kernel/contracts/activity.js').Activity} Activity */

/**
 * @param {string|Element} rootSel
 * @param {string} id
 * @param {string} [initialMode]
 */
export async function renderPlayerView(rootSel, id, initialMode = 'solo') {
  // Banco compartido: si no está en local, se trae de la nube (acceso por URL
  // desde cualquier dispositivo/profe). SIN cachear: jugar una actividad pública
  // NO debe ensuciar "Mis actividades" (modelo biblioteca, S2). Se juega en
  // memoria; para tenerla propia se usa "Duplicar".
  const cargada = await getAnywhere(id);
  if (!cargada) {
    mount(rootSel, html`<div class="alert alert-warning">Actividad no encontrada. <a href="${destinoTrasJugar('solo').href}">Volver</a></div>`);
    return;
  }
  // De aquí abajo la actividad EXISTE (arriba se vuelve si no): se nombra una vez
  // para que las funciones de la página no tengan que volver a preguntarlo.
  const a = cargada;
  // NI VACÍA NI A MEDIAS. Dos caminos que la app trataba como si nada:
  //   · vacía — desde F4 las actividades nacen en blanco, así que darle a Jugar
  //     antes de escribir nada es NORMAL; cada plantilla lo contaba a su manera
  //     («Esta actividad no tiene imagen o pines») en una pantalla sin salida.
  //   · a medias — el dueño subió el dibujo de «Etiqueta el diagrama», dejó las
  //     etiquetas sin escribir y la app le dejó JUGAR: en el juego no había nada
  //     que arrastrar. Lo que falta va EN ROJO y señalando el elemento, como en
  //     cualquier aplicación a la que le faltan datos.
  // La lista la pone core/activityCheck.js: una sola para todas.
  {
    const rev = revisarActividad(a);
    // El TÍTULO no entra en esta puerta (`jugable`, no `listo`): `migrate` pone
    // «Sin título» por defecto y atarlo aquí dejaría injugable una actividad
    // completa traída del banco compartido. Se reclama en el editor.
    if (!rev.jugable) { mount(rootSel, pantallaNoListaHtml(a, rev)); return; }
  }
  const ctx = acquire('playerPage');
  // El TEMA Y EL FONDO de esta vez (views/player/apariencia.js): viven aquí, no
  // en la actividad guardada. Al cambiar el TEMA, VS/Equipos necesitan
  // re-montarse (su layout depende de la clase vs-skin-<layout>); Individual no,
  // o el alumno perdería la partida a medias por tocar una baldosa.
  const apariencia = crearApariencia({
    presentation: a.presentation,
    marco: () => document.getElementById('ww-frame'),
    onSkinChange: () => { if (currentMode !== 'solo') selectMode(currentMode); },
  });
  // Lo elegido para ESTA vez (core/playOptions.js). Vive aquí, no en la
  // actividad: mañana con otro grupo el profe elige otra cosa y lo guardado no
  // se toca. Al vivir en playActivity() sirve a TODOS los modos embebidos.
  /** @type {import('../core/playOptions.js').PlayChoices} */
  let playChoices = {};

  // The currently selected embedded mode and its teardown handle. The activity
  // stage hosts ONE mode at a time (Individual by default); switching modes
  // disposes the previous one (stops VS animations, etc.). See core/modes.js.
  let currentMode = initialMode;
  /** @type {{dispose: () => void}|null} */
  let currentDisposer = null;
  /** @type {{dispose: () => void}|null} */
  let currentAnim = null;   // animación de progreso del modo solo (carril)
  /** @type {(() => void)|null} */
  let fsDisposer = null;    // enganche del botón de pantalla completa (uno vivo)
  // Ficha de generación: cada selectMode() la incrementa. runMode()/mountSoloStart
  // son ASÍNCRONOS (dynamic import + montaje); si el usuario cambia de modo otra
  // vez antes de que resuelvan, el resultado tardío NO debe pisar currentDisposer
  // (huérfano sin dispose(), y su DOM se pintaría sobre el modo nuevo). Cualquier
  // callback async compara su ficha capturada contra `modeToken` antes de asignar.
  let modeToken = 0;
  ctx.add(() => { if (currentDisposer) { try { currentDisposer.dispose(); } catch {} currentDisposer = null; } });
  ctx.add(() => { if (currentAnim) { try { currentAnim.dispose(); } catch {} currentAnim = null; } });
  ctx.add(() => { if (fsDisposer) { try { fsDisposer(); } catch {} fsDisposer = null; } });
  // This page themes only the embed frame (scoped, after paint()). Keep the
  // page chrome neutral on enter AND restore it on teardown, clearing any
  // global theme a prior view (host/student live) may have left on <body>.
  resetScene();
  ctx.add(() => resetScene());

  // Auth check for "Edit" visibility (dueño 2026-08-18: era `true` fijo — el
  // botón "Editar" salía en actividades ajenas). Banco compartido SIN dueño
  // sigue siendo editable por cualquiera (`a.author?.id` vacío, p. ej. las
  // sembradas antes de que existiera autoría); con dueño, solo el dueño.
  const canEdit = !a.author?.id || a.author.id === getAuthUserId();

  paint();

  // The activity as it will be PLAYED. (Ya no lleva plantilla "en vivo": el
  // cambio de plantilla dejó de ser una vista previa y pasó a crear una COPIA,
  // así que la que se juega es siempre la guardada.)
  // Carry the LIVE theme picks into the activity each mode receives, so views
  // that read presentation (e.g. vsView's vs-skin-<vsLayout> arena class) reflect
  // the theme chosen in the picker — not just the originally saved one.
  function playActivity() {
    const base = { ...a,
      presentation: { ...a.presentation, skin: apariencia.skin, background: apariencia.background, backgroundImage: apariencia.backgroundImage } };
    return applyPlayOptions(getTemplate(a.template), base, playChoices);
  }

  // The "Modos de juego" bar, built entirely from the mode registry so gating
  // lives in ONE place (core/modes.js). Embedded modes are buttons that mount
  // into the stage; embed:false modes (En vivo, Tarea) are links to their page.
  /** @param {Activity} act */
  function modeBarHtml(act) {
    // Solo se ofrecen los modos que la PLANTILLA soporta (capacidad) — sin esto,
    // "Equipos" aparecía en Ruleta/Pregunta Live (que no tienen renderRound) y
    // "Individual" en plantillas solo-en-vivo. La gating de disponibilidad
    // (isAvailable) decide habilitado/gris dentro de los que sí soporta.
    //
    // Y SÍ, estos van con Bootstrap a propósito, aunque la cabecera de esta
    // misma pantalla vista con la familia del panel (.btn-ghost): un botón de
    // modo lleva el COLOR DE SU MODO (`m.color`) y es affordance de JUEGO —
    // elegir cómo se juega—, no una acción de panel. Escrito aquí porque si no
    // se lee como una migración a medias. Por eso esta vista no entra en
    // CHROME_VIEWS (core/normsCheck.js): tiene las dos gramáticas, con motivo.
    const T = getTemplate(act.template);
    return availableModes(act).filter(m => m.supportsTemplate(T)).map(m => {
      const ok = m.isAvailable(act);
      if (!m.embed) {
        // Modo host-only (En vivo / Tarea) sin sesión: NO es un enlace roto ni un
        // botón gris sin explicación — lleva candado y su frase, y al pulsarlo
        // abre el login diciendo para qué (ley §22: dirigir es acto de profe; el
        // alumno entra con PIN y sin cuenta).
        if (ok && modeNeedsAuth(m) && !canHost()) {
          return `<button class="btn btn-outline-${m.color} ww-mode-locked" data-lock="${m.id}" title="${escapeHtml(modeAuthHint(m))}">`
            + `<i class="bi bi-lock-fill"></i> ${escapeHtml(m.label)}</button>`;
        }
        // La RUTA la declara el modo (`href` en MODE_DEFS). Un modo de página
        // propia sin ruta no se puede enlazar: cae en el mismo botón gris que
        // el no disponible, nunca en un enlace vacío.
        const enlace = m.href?.(a);
        return ok && enlace
          ? `<a href="${enlace}" class="btn btn-outline-${m.color}"><i class="bi ${m.icon}"></i> ${escapeHtml(m.label)}</a>`
          : `<button class="btn btn-outline-secondary" disabled title="${escapeHtml(m.disabledHint || '')}"><i class="bi ${m.icon}"></i> ${escapeHtml(m.label)}</button>`;
      }
      if (!ok) {
        return `<button class="btn btn-outline-secondary" disabled title="${escapeHtml(m.disabledHint || '')}"><i class="bi ${m.icon}"></i> ${escapeHtml(m.label)}</button>`;
      }
      const active = m.id === currentMode;
      return `<button class="btn btn-${active ? '' : 'outline-'}${m.color} ww-mode${active ? ' is-active' : ''}" data-mode="${m.id}" title="${escapeHtml(m.title || '')}"><i class="bi ${m.icon}"></i> ${escapeHtml(m.label)}</button>`;
    }).join('');
  }

  // Swap the stage to a different embedded mode: tear down the previous one,
  // expand the frame for shared-screen modes (VS/Equipos need room), highlight
  // the active button, and mount. Solo keeps the template's fixed aspect ratio.
  /** @param {string|undefined} id */
  async function selectMode(id) {
    const m = getMode(id);
    if (!m || !m.embed) return; // embed:false modes navigate via their link
    // Pasado el guard el modo EXISTE, así que su id es el que llegó: se nombra
    // desde el registro para no arrastrar el `undefined` del parámetro.
    const modeId = m.id;
    const myToken = ++modeToken;   // invalida cualquier callback async en vuelo de una selección previa
    if (currentDisposer) { try { currentDisposer.dispose(); } catch {} currentDisposer = null; }
    // Animación de progreso: SOLO en modo Individual. Se monta ANTES del player
    // para suscribirse al bus antes de su primer QUESTION_SHOWN; se descarta al
    // cambiar de modo.
    if (currentAnim) { try { currentAnim.dispose(); } catch {} currentAnim = null; }
    // La animación de progreso (solo) y el juego arrancan al pulsar "Iniciar" en
    // la pantalla de inicio; hasta entonces el carril queda oculto.
    const lane = document.getElementById('ww-solo-anim');
    if (lane) { lane.innerHTML = ''; lane.hidden = true; }
    currentMode = modeId;
    $$('.ww-mode').forEach(btn => {
      const on = btn.dataset.mode === modeId;
      btn.classList.toggle('is-active', on);
      const color = getMode(btn.dataset.mode)?.color || 'secondary';
      btn.classList.toggle('btn-' + color, on);
      btn.classList.toggle('btn-outline-' + color, !on);
    });
    document.getElementById('ww-frame')?.classList.toggle('is-expanded', modeId !== 'solo');
    // ESTÁNDAR: toda actividad pasa por una pantalla de inicio (título +
    // instrucciones + ajustes) antes de mostrar el ejercicio. El modo Individual
    // la pinta aquí; VS/Equipos ya tienen su propia pantalla previa (modeSetup).
    if (modeId === 'solo') {
      currentDisposer = mountSoloStart(myToken);
    } else {
      const disposer = await runMode(modeId, '#ww-player-widget', playActivity(), ctx);
      // Si otra selección de modo ganó la carrera mientras este runMode montaba,
      // este resultado llega TARDE: no pisar currentDisposer (huérfano) — se
      // descarta el montaje recién hecho en vez de dejarlo sin dispose().
      if (myToken !== modeToken) { try { disposer.dispose(); } catch {} return; }
      currentDisposer = disposer;
    }
  }

  // Pantalla de inicio del modo Individual: muestra título/instrucciones/ajustes
  // y, al pulsar "Iniciar", entra en pantalla completa, monta la animación de
  // progreso (si está activa) y arranca el player real en el mismo escenario.
  /** @param {number} myToken */
  function mountSoloStart(myToken) {
    const widget = document.getElementById('ww-player-widget');
    if (!widget) return null;
    const act = playActivity();
    const T = getTemplate(act?.template);
    // LA ANTESALA ES UNA (`views/antesala.js`): aquí solo se aporta la variante
    // del modo Individual. Las reglas —un botón, siempre pantalla completa,
    // instrucciones a la vista— viven allí y no se deciden aquí. Esto vivió en
    // una vista propia de diez líneas (`startScreen`) con este único caller.
    //
    // Las opciones de PARTIDA de la plantilla se deciden AQUÍ, al lanzar, no en
    // el editor (`core/playOptions.js`), y por UN solo canal.
    return renderAntesala(widget, {
      activity: act,
      playOpts: T ? { T, activity: act, choices: playChoices,
        onChange: (id, value) => { if (id) playChoices = { ...playChoices, [id]: value }; } } : null,
      onStart: async () => {
        if (currentAnim) { try { currentAnim.dispose(); } catch {} currentAnim = null; }
        const lane = document.getElementById('ww-solo-anim');
        const anim = lane ? mountSoloAnimator(lane, playActivity()) : null;
        const disposer = await runMode('solo', '#ww-player-widget', playActivity(), ctx);
        // Mismo guardia: si el alumno cambió de modo mientras "Iniciar" montaba
        // el player real, no pisar el modo YA activo con el solo tardío.
        if (myToken !== modeToken) { try { anim?.dispose(); } catch {} try { disposer.dispose(); } catch {} return; }
        currentAnim = anim;
        currentDisposer = disposer;
      }
    });
  }

  function paint() {
    const T = getTemplate(a.template);
    const aspect = T?.meta?.aspectRatio || ASPECTO_POR_DEFECTO;

    mount(rootSel, html`
      <div class="ww-play-page">
        <!-- LA DIAGRAMACIÓN (dueño, 2026-08-18, con dos capturas de referencia):
             .pp-layout es un grid con CUATRO áreas — cabecera · marco · modo de
             juego · apariencia — cada una en su TARJETA blanca (como en las
             fotos). En PC la cabecera va arriba a todo el ancho, marco+modos a
             la izquierda y Apariencia a la derecha; en tablet-o-menos se APILA
             con el marco PRIMERO (jugar antes de leer botones) y la cabecera
             debajo. El orden lo decide el CSS (grid-template-areas por media
             query), no el DOM: así no hay marcado duplicado por breakpoint.
             Ver styles/player.css. -->
        <div class="pp-layout">

          ${cabeceraPaginaHtml(a, { T, canEdit })}

          <div class="pp-stage">
            <!-- El botón de pantalla completa va DENTRO del marco, discreto y en
                 la esquina (como Wordwall). -->
            <div class="ww-player-frame" style="${aspectStyle(aspect)}" id="ww-frame">
              <div id="ww-solo-anim" class="ww-solo-anim" hidden></div>
              <div id="ww-player-widget"></div>
              ${fullscreenButtonHtml({ corner: true })}
            </div>
          </div>

          <!-- Área propia (no dentro del escenario): en tablet la foto la pone
               DESPUÉS de la cabecera, y solo un área independiente puede
               reordenarse por grid-template-areas. -->
          <div class="pp-modes pp-card">
            <h6 class="text-muted text-uppercase small mb-2">Modo de juego</h6>
            <div class="d-flex flex-wrap gap-2 ww-modes">
              ${modeBarHtml(playActivity())}
            </div>
          </div>

          <!-- ORDEN pedido por el dueño (2026-08-18): «otra plantilla» ANTES de
               Apariencia. Cambiar de plantilla cambia el JUEGO; el tema y el
               fondo solo lo visten — la decisión gorda va primero. -->
          <div class="pp-appearance">
            ${otraPlantillaHtml(a)}
            ${apariencia.html()}
          </div>

        </div>
      </div>
    `);

    apariencia.aplicar();
    // Re-mount the active mode (default Individual). If a template switch made
    // the active mode incompatible (e.g. VS off after switching), fall back.
    const act = playActivity();
    if (!getMode(currentMode)?.isAvailable(act)) {
      if (currentMode !== 'solo') toast(`Modo "${currentMode}" no disponible para esta actividad.`, 'warning');
      currentMode = 'solo';
    }
    selectMode(currentMode);
    wireHandlers();
  }

  function wireHandlers() {
    // Cada pieza cablea LO SUYO (§23): el vestido, la fila de «otra plantilla» y
    // la cabecera. Aquí se queda lo que es de la página — la barra de modos y el
    // botón de pantalla completa del marco.
    apariencia.wire(rootSel);
    wireOtraPlantilla(rootSel, a);
    wireCabeceraPagina(rootSel, a, { id, onRestart: () => selectMode(currentMode) });
    // Mode bar: embedded modes mount into the stage (embed:false modes are
    // plain links and navigate on their own).
    // La misma pared que en la tarjeta, con las mismas palabras: la redacción
    // vive en `pedirCuentaParaModo` (views/loginModal.js), no aquí.
    on(rootSel, 'click', '.ww-mode-locked', (_, b) => pedirCuentaParaModo(b.dataset.lock || ''));
    on(rootSel, 'click', '.ww-mode', (_, b) => {
      selectMode(b.dataset.mode);
      document.getElementById('ww-frame')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    // El de la esquina expande el MISMO marco, y su disposer se cuelga del ctx
    // de la vista (§23): sin él, el listener de `fullscreenchange` sobreviviría
    // al cambio de ruta y repintaría botones de una pantalla que ya no existe.
    // Se SUELTA el anterior antes de enganchar el nuevo: `paint()` no se llama
    // una vez, se repite en cada cambio de plantilla, y cada enganche registra
    // dos oyentes de `fullscreenchange` en `document`. Colgarlos solo del ctx de
    // la vista los acumulaba hasta salir de la ruta (2 por cada cambio).
    if (fsDisposer) { try { fsDisposer(); } catch { /* ya suelto */ } }
    fsDisposer = attachFullscreenButton('#ww-frame', { target: document.getElementById('ww-frame') || undefined, contenido: '#ww-player-widget' });
  }
}
