// Activity page (Wordwall-style). The activity itself runs inside a
// constrained "embed" frame (max-width 960, fixed aspect-ratio per
// template). Around it: header, skin tiles, background tiles, "switch
// template" row, share/edit actions. Responsive: collapses to a tall
// auto-height frame on mobile portrait.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { get, save, getRemote, remove as removeActivity } from '../core/storage.js';
import { activityItemCount, newActivityId } from '../core/migrate.js';
import { getTemplate, compatibleTemplates } from '../core/registry.js';
import { isVsCompatible } from '../kernel/session/engine.js';
import { availableModes, getMode, runMode, modeNeedsAuth, modeAuthHint } from '../core/modes.js';
import { canHost } from '../core/authGate.js';
import { openLoginModal } from './loginModal.js';
import { clearSoloProgress } from '../core/soloPlayer.js';
import { renderStartScreen } from './startScreen.js';
import { listSkins, applySkin, skinPreviewHtml } from '../core/skins.js';

import { listBackgrounds, applyBackground, backgroundPreviewHtml, readBackgroundImage } from '../core/backgrounds.js';
import { resetScene } from '../core/presentation.js';
import { toggleFullscreen, fullscreenButtonHtml, attachFullscreenButton } from '../core/fullscreen.js';
import { applyPlayOptions } from '../core/playOptions.js';
import { acquire } from '../core/lifecycle.js';
import { toast, confirmModal } from '../core/toast.js';
import { openEmbedModal } from './embedModal.js';
import { mountSoloAnimator } from '../core/soloAnimator.js';

export async function renderPlayerView(rootSel, id, initialMode = 'solo') {
  let a = get(id);
  // Banco compartido: si no está en local, tráela de la nube (acceso por URL
  // desde cualquier dispositivo/profe). NO se guarda en el almacén del usuario:
  // jugar una actividad pública NO debe ensuciar "Mis actividades" (modelo
  // biblioteca, S2). Se juega en memoria; para tenerla propia se usa "Duplicar".
  if (!a) {
    a = await getRemote(id).catch(() => null);
  }
  if (!a) {
    mount(rootSel, html`<div class="alert alert-warning">Actividad no encontrada. <a href="#/home">Volver</a></div>`);
    return;
  }
  // LA ACTIVIDAD VACÍA NO ES UN CALLEJÓN (F4 · nacer en blanco). Desde que las
  // actividades nacen sin contenido de muestra, darle a Jugar antes de escribir
  // nada es un camino NORMAL, no un error — y cada plantilla lo contaba a su
  // manera («Esta actividad no tiene imagen o pines») en una pantalla sin
  // salida, que es lo que se ve al hacerlo. Aquí se resuelve UNA vez para las
  // 13, con el MISMO primer paso que enseña el editor y el botón para ir a
  // escribirlo. Las de contenido GENERADO (Pelotas) no pasan por aquí: nacen
  // jugables por definición.
  {
    const T = getTemplate(a.template);
    if (!T?.meta?.editor?.generado && activityItemCount(a) === 0) {
      const paso = T?.meta?.editor?.primerPaso || 'Ábrela en Editar y añade su contenido.';
      mount(rootSel, html`
        <div class="alert alert-info d-flex align-items-start gap-2">
          <i class="bi bi-lightbulb mt-1"></i>
          <div>
            <b>«${a.title || 'Sin título'}» todavía está vacía.</b><br>
            ${paso}
          </div>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <a class="btn btn-primary" href="#/edit/${a.id}"><i class="bi bi-pencil"></i> Editar la actividad</a>
          <a class="btn btn-outline-secondary" href="#/home"><i class="bi bi-arrow-left"></i> Volver</a>
        </div>`);
      return;
    }
  }
  const ctx = acquire('playerPage');
  let liveTemplate = a.template;
  let currentSkin = a.presentation?.skin || 'default';
  let currentBg = a.presentation?.background || 'none';
  let currentBgImage = a.presentation?.backgroundImage || '';
  // Lo elegido para ESTA partida (core/playOptions.js). Vive aquí, no en la
  // actividad: mañana con otro grupo el profe elige otra cosa y lo guardado no
  // se toca. Al vivir en playActivity() sirve a TODOS los modos embebidos.
  let playChoices = {};

  const vsCapable = isVsCompatible(a);
  // The currently selected embedded mode and its teardown handle. The activity
  // stage hosts ONE mode at a time (Individual by default); switching modes
  // disposes the previous one (stops VS animations, etc.). See core/modes.js.
  let currentMode = initialMode;
  let currentDisposer = null;
  let currentAnim = null;   // animación de progreso del modo solo (carril)
  // Ficha de generación: cada selectMode() la incrementa. runMode()/mountSoloStart
  // son ASÍNCRONOS (dynamic import + montaje); si el usuario cambia de modo otra
  // vez antes de que resuelvan, el resultado tardío NO debe pisar currentDisposer
  // (huérfano sin dispose(), y su DOM se pintaría sobre el modo nuevo). Cualquier
  // callback async compara su ficha capturada contra `modeToken` antes de asignar.
  let modeToken = 0;
  ctx.add(() => { if (currentDisposer) { try { currentDisposer.dispose(); } catch {} currentDisposer = null; } });
  ctx.add(() => { if (currentAnim) { try { currentAnim.dispose(); } catch {} currentAnim = null; } });
  // This page themes only the embed frame (scoped, after paint()). Keep the
  // page chrome neutral on enter AND restore it on teardown, clearing any
  // global theme a prior view (host/student live) may have left on <body>.
  resetScene();
  ctx.add(() => resetScene());

  // Auth check for "Edit" visibility.
  // Banco compartido sin dueño: cualquiera puede editar.
  const canEdit = true;

  paint();

  // The activity as it will be PLAYED: the chosen "switch template" wins over
  // the stored one, so mode gating + the running game both follow the preview.
  // Carry the LIVE theme picks into the activity each mode receives, so views
  // that read presentation (e.g. vsView's vs-skin-<vsLayout> arena class) reflect
  // the theme chosen in the picker — not just the originally saved one.
  function playActivity() {
    const base = { ...a, template: liveTemplate,
      presentation: { ...a.presentation, skin: currentSkin, background: currentBg, backgroundImage: currentBgImage } };
    return applyPlayOptions(getTemplate(liveTemplate), base, playChoices);
  }

  // The "Modos de juego" bar, built entirely from the mode registry so gating
  // lives in ONE place (core/modes.js). Embedded modes are buttons that mount
  // into the stage; embed:false modes (En vivo, Tarea) are links to their page.
  function modeBarHtml(act) {
    // Solo se ofrecen los modos que la PLANTILLA soporta (capacidad) — sin esto,
    // "Equipos" aparecía en Ruleta/Pregunta Live (que no tienen renderRound) y
    // "Individual" en plantillas solo-en-vivo. La gating de disponibilidad
    // (isAvailable) decide habilitado/gris dentro de los que sí soporta.
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
        return ok
          ? `<a href="${m.href(a)}" class="btn btn-outline-${m.color}"><i class="bi ${m.icon}"></i> ${escapeHtml(m.label)}</a>`
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
  async function selectMode(id) {
    const m = getMode(id);
    if (!m || !m.embed) return; // embed:false modes navigate via their link
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
    currentMode = id;
    document.querySelectorAll('.ww-mode').forEach(btn => {
      const on = btn.dataset.mode === id;
      btn.classList.toggle('is-active', on);
      const color = getMode(btn.dataset.mode)?.color || 'secondary';
      btn.classList.toggle('btn-' + color, on);
      btn.classList.toggle('btn-outline-' + color, !on);
    });
    document.getElementById('ww-frame')?.classList.toggle('is-expanded', id !== 'solo');
    // ESTÁNDAR: toda actividad pasa por una pantalla de inicio (título +
    // instrucciones + ajustes) antes de mostrar el ejercicio. El modo Individual
    // la pinta aquí; VS/Equipos ya tienen su propia pantalla previa (modeSetup).
    if (id === 'solo') {
      currentDisposer = mountSoloStart(myToken);
    } else {
      const disposer = await runMode(id, '#ww-player-widget', playActivity(), ctx);
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
  function mountSoloStart(myToken) {
    const widget = document.getElementById('ww-player-widget');
    return renderStartScreen(widget, playActivity(), {
      frame: document.getElementById('ww-frame'),
      choices: playChoices,
      onOption: (id, value) => { playChoices = { ...playChoices, [id]: value }; },
      onStart: async () => {
        if (currentAnim) { try { currentAnim.dispose(); } catch {} currentAnim = null; }
        const anim = mountSoloAnimator(document.getElementById('ww-solo-anim'), playActivity());
        const disposer = await runMode('solo', '#ww-player-widget', playActivity(), ctx);
        // Mismo guardia: si el alumno cambió de modo mientras "Iniciar" montaba
        // el player real, no pisar el modo YA activo con el solo tardío.
        if (myToken !== modeToken) { try { anim.dispose(); } catch {} try { disposer.dispose(); } catch {} return; }
        currentAnim = anim;
        currentDisposer = disposer;
      }
    });
  }

  function paint() {
    const T = getTemplate(liveTemplate) || getTemplate(a.template);
    const aspect = T?.meta?.aspectRatio || '4/3';
    const compat = compatibleTemplates(liveTemplate);

    mount(rootSel, html`
      <div class="ww-play-page">

        <!-- Orden tipo Wordwall: primero la ACTIVIDAD, luego título + autor, luego
             los modos. La navegación "Inicio" ya vive en la barra superior (un solo
             nav), así que aquí no se repite la miga de pan. -->
        <!-- El botón de pantalla completa va DENTRO del marco, discreto y en la
             esquina (como Wordwall): durante la actividad el profe no baja a
             buscar un control en una barra, y el mismo botón sirve para SALIR
             (cambia de icono). Al vivir en el marco compartido sale en los tres
             modos embebidos —Individual, VS y Equipos— sin repetirlo en cada uno. -->
        <div class="ww-player-frame mb-3" style="${aspectStyle(aspect)}" id="ww-frame">
          <div id="ww-solo-anim" class="ww-solo-anim" hidden></div>
          <div id="ww-player-widget"></div>
          ${fullscreenButtonHtml({ corner: true })}
        </div>

        <div class="mb-3">
          <h3 class="mb-1">${escapeHtml(a.title)}</h3>
          ${a.author?.name ? `<div class="text-muted small mb-1">por ${escapeHtml(a.author.name)}</div>` : ''}
          <div class="text-muted small">
            <span class="badge bg-${T?.meta?.color || 'info'}"><i class="bi ${T?.meta?.icon || 'bi-puzzle'}"></i> ${escapeHtml(T?.meta?.label || liveTemplate)}</span>
            · ${activityItemCount(a)} elementos
            ${a.subtitle ? `· ${escapeHtml(a.subtitle)}` : ''}
          </div>
          ${(a.tags||[]).length ? `<div class="mt-1">${(a.tags||[]).map(t => `<span class="badge bg-light text-dark border me-1">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        </div>

        <h6 class="text-muted text-uppercase small mb-2">Modos de juego</h6>
        <div class="d-flex flex-wrap gap-2 mb-4 ww-modes">
          ${modeBarHtml(playActivity())}
        </div>

        <div class="d-flex flex-wrap gap-2 mb-4">
          <button class="btn btn-sm btn-outline-secondary" id="btn-restart"><i class="bi bi-arrow-clockwise"></i> Reiniciar</button>
          <button class="btn btn-sm btn-outline-secondary" id="btn-fs"><i class="bi bi-arrows-fullscreen"></i> Pantalla completa</button>
          ${canEdit ? `<a href="#/edit/${a.id}" class="btn btn-sm btn-outline-primary"><i class="bi bi-pencil"></i> Editar</a>` : ''}
          <button class="btn btn-sm btn-outline-secondary" id="btn-link"><i class="bi bi-link-45deg"></i> Copiar link</button>
          <!-- «beta» a propósito: embeber está FUERA DE LA ESCENA por ahora
               (norte §7c) — pinta, pero nadie lo ha validado dentro de un blog
               o un LMS. La puerta entornada se DICE ANTES, no se descubre. -->
          <button class="btn btn-sm btn-outline-secondary" id="btn-embed"><i class="bi bi-code-square"></i> Embed <span class="badge bg-secondary">beta</span></button>
          <button class="btn btn-sm btn-outline-secondary" id="btn-fork"><i class="bi bi-files"></i> Duplicar</button>
        </div>

        <h6 class="text-muted text-uppercase small mb-2">Tema</h6>
        <div class="d-flex flex-wrap gap-2 mb-4">
          ${listSkins().map(s => `
            <div class="ww-pick-tile skin-pick ${currentSkin===s.name?'is-active':''}" data-name="${s.name}" role="button" title="${escapeHtml(s.description||'')}">
              ${skinPreviewHtml(s.name)}
            </div>
          `).join('')}
        </div>

        <h6 class="text-muted text-uppercase small mb-2">Fondo</h6>
        <div class="d-flex flex-wrap gap-2 mb-4">
          ${listBackgrounds().map(b => b.name === 'custom'
            ? `<div class="ww-pick-tile bg-pick ${currentBg==='custom'?'is-active':''}" data-name="custom" role="button" title="${escapeHtml(b.description||'')}" style="width:88px">
                 ${backgroundPreviewHtml('custom', a.presentation?.backgroundImage || '')}
                 <label class="btn btn-sm btn-outline-secondary w-100 mt-1" style="cursor:pointer" title="Máx 800 KB">
                   <i class="bi bi-upload"></i> ${a.presentation?.backgroundImage ? 'Cambiar' : 'Subir'}
                   <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" id="bg-custom-file" hidden>
                 </label>
               </div>`
            : `<div class="ww-pick-tile bg-pick ${currentBg===b.name?'is-active':''}" data-name="${b.name}" role="button" title="${escapeHtml(b.description||'')}" style="width:88px">
                 ${backgroundPreviewHtml(b.name)}
               </div>`).join('')}
        </div>


        ${compat.length ? `
          <h6 class="text-muted text-uppercase small mb-2">Cambiar plantilla (mismo contenido)</h6>
          <div class="d-flex flex-wrap gap-2 mb-4">
            ${compat.map(t => `
              <button class="btn btn-outline-${t.meta.color || 'secondary'} btn-sm tpl-switch" data-name="${t.meta.name}">
                <i class="bi ${t.meta.icon}"></i> ${escapeHtml(t.meta.label)}
              </button>
            `).join('')}
          </div>` : ''}

      </div>
    `);

    // Scope skin + bg to the freshly-rendered frame so the page chrome
    // around the embed doesn't change when the user picks a theme.
    const frame = document.getElementById('ww-frame');
    applySkin(currentSkin, frame);
    applyBackground(currentBg, frame, currentBgImage);
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
    on(rootSel, 'click', '.skin-pick', (_, b) => {
      currentSkin = b.dataset.name;
      applySkin(currentSkin, document.getElementById('ww-frame'));
      document.querySelectorAll('.skin-pick').forEach(p => p.classList.toggle('is-active', p.dataset.name === currentSkin));
      // VS/Equipos SÍ necesitan re-montar: su layout depende de la clase
      // vs-skin-<layout> del skin. Pero en Individual re-montar reinicia el juego
      // a la pantalla de inicio (el alumno tocaba un tema por curiosidad y perdía
      // el crucigrama/emparejar a medias). En solo basta el applySkin de arriba.
      if (currentMode !== 'solo') selectMode(currentMode);
    });
    on(rootSel, 'click', '.bg-pick', (_, b) => {
      // Custom selects only when an image exists; otherwise its upload button
      // (the label inside) opens the file dialog and selects on success.
      if (b.dataset.name === 'custom' && !currentBgImage) return;
      currentBg = b.dataset.name;
      applyBackground(currentBg, document.getElementById('ww-frame'), currentBgImage);
      document.querySelectorAll('.bg-pick').forEach(p => p.classList.toggle('is-active', p.dataset.name === currentBg));
    });
    on(rootSel, 'change', '#bg-custom-file', async (e) => {
      try {
        currentBgImage = await readBackgroundImage(e.target.files[0]);
        currentBg = 'custom';
        applyBackground(currentBg, document.getElementById('ww-frame'), currentBgImage);
        const tile = document.querySelector('.bg-pick[data-name="custom"]');
        const pv = tile?.querySelector('.ww-bg-preview');
        if (pv) { pv.style.background = `center/cover no-repeat url("${currentBgImage}")`; pv.innerHTML = ''; }
        document.querySelectorAll('.bg-pick').forEach(p => p.classList.toggle('is-active', p.dataset.name === 'custom'));
      } catch (err) {
        toast(err.message, 'warning', 5000);
        e.target.value = '';
      }
    });
    on(rootSel, 'click', '.tpl-switch', (_, b) => {
      liveTemplate = b.dataset.name;
      paint();
    });
    // Mode bar: embedded modes mount into the stage (embed:false modes are
    // plain links and navigate on their own).
    on(rootSel, 'click', '.ww-mode-locked', (_, b) => {
      const hint = modeAuthHint(b.dataset.lock);
      toast(hint + '. Tus alumnos entran con el PIN, sin cuenta.', 'info', 5000);
      openLoginModal({ reason: hint });
    });
    on(rootSel, 'click', '.ww-mode', (_, b) => {
      selectMode(b.dataset.mode);
      document.getElementById('ww-frame')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    // Restart re-mounts whatever mode is active (new game / fresh setup).
    // Borra el progreso guardado para que REINICIE de verdad (no reanude).
    on(rootSel, 'click', '#btn-restart', () => { clearSoloProgress(id); selectMode(currentMode); });
    // Frame-level fullscreen: only the embed expands, not the page (YouTube-like).
    on(rootSel, 'click', '#btn-fs', () => toggleFullscreen(document.getElementById('ww-frame')));
    // El de la esquina expande el MISMO marco, y su disposer se cuelga del ctx
    // de la vista (§23): sin él, el listener de `fullscreenchange` sobreviviría
    // al cambio de ruta y repintaría botones de una pantalla que ya no existe.
    ctx.add(attachFullscreenButton('#ww-frame', { target: document.getElementById('ww-frame') }));
    on(rootSel, 'click', '#btn-link', async () => {
      try { await navigator.clipboard.writeText(location.href); toast('Link copiado.', 'success'); }
      catch { toast('No se pudo copiar — copia manualmente: ' + location.href, 'warning', 6000); }
    });
    on(rootSel, 'click', '#btn-embed', () => openEmbedModal(a));
    on(rootSel, 'click', '#btn-fork', async () => {
      const fork = {
        ...a,
        id: newActivityId(),
        title: a.title + ' (copia)',
        forkOf: a.id,
        visibility: 'unlisted',
        author: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      save(fork);
      location.hash = `#/edit/${fork.id}`;
    });
  }
}

function aspectStyle(aspect) {
  if (aspect === 'auto') return 'aspect-ratio: auto; min-height: 50vh;';
  return `aspect-ratio: ${aspect};`;
}
