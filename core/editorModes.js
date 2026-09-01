// Shared editor section for the per-MODE play settings, so any template editor
// gets the same "Modos de juego" tab with ONE include — instead of each editor
// re-inventing it (the drift trap). It configures what each shared-screen mode
// needs and writes to the SAME fields the play views already read:
//
//   VS      → presentation.vsAnimation / vsAnimationSrc (animation) and
//             presentation.vsFeedback {flash,confetti} (per-answer fx; el sonido
//             es del silencio global, core/sounds.js — no tiene casilla aquí).
//   Equipos → presentation.teamsCount (2-4) + presentation.teamsScoring (auto|judge)
//             used as the SETUP defaults in teamsView / memoryView.
//   Tarea   → presentation.taskMaxAttempts (default intentos al crear la tarea).
//
// Which blocks appear is gated by the SAME rules as the mode bar (core/modes.js):
// VS only when isVsCompatible; Tarea only when the template declares modes.async.
import { escapeHtml } from './html.js';
import { on } from './events.js';
import { isVsCompatible } from '../kernel/session/engine.js';
import { sessionItems } from '../kernel/content/sessionItems.js';
import { listVsAnimations, startPreviewAnims, DEFAULT_VS_ANIMATION } from './vsAnimations.js';

let _editorPreviewAnims = [];
let _editorPreviewGen = 0;
import { getTemplate } from './registry.js';
import { canAutoScoreRound } from './templateCapability.js';
// El ambiente del duelo tiene UN dueño (§21b): aquí se lee y se escribe por sus
// métodos. Este módulo llevaba su propia copia de los defectos y su propio
// `!vsAnimationOff`, que decía «Animación: sí» en Tildes/Comas mientras el duelo
// la apagaba sola — el panel prometía lo contrario de lo que veía la clase.
import { vsFeedback, setVsFeedback, vsAnimacionOn, setVsAnimacion } from './presentation.js';
import { esHojaDeTexto } from './contentModels/textCorrection.js';

const fxRow = (key, label, hint, on) => `
  <label class="vs-fx-row" title="${escapeHtml(hint)}">
    <span class="form-check form-switch m-0">
      <input class="form-check-input vs-fx" type="checkbox" role="switch" data-fx="${key}" ${on ? 'checked' : ''}>
    </span>
    <span class="vs-fx-label">${escapeHtml(label)}<small class="d-block text-muted">${escapeHtml(hint)}</small></span>
  </label>`;

function vsBlock(a) {
  const cur = a.presentation?.vsAnimation || DEFAULT_VS_ANIMATION;
  const animOn = vsAnimacionOn(a, { textTight: esHojaDeTexto(a) });   // lo mismo que verá el duelo
  const compact = !!a.presentation?.vsAnimCompact;
  const curSrc = a.presentation?.vsAnimationSrc || '';
  const fx = vsFeedback(a);
  const anims = listVsAnimations();
  const needsSrcNow = anims.find(v => v.id === cur)?.needsSrc;
  return `
    <section class="ww-mode-cfg" data-mode="vs">
      <h6 class="mb-1"><i class="bi bi-fire text-danger"></i> VS (duelo)</h6>
      <p class="text-muted small mb-2">Cómo se ve y suena el duelo 1‑contra‑1 en pantalla compartida.</p>
      <label class="vs-fx-row mb-2" title="Muestra u oculta la animación del centro del duelo.">
        <span class="form-check form-switch m-0">
          <input class="form-check-input vsanim-toggle" type="checkbox" role="switch" ${animOn ? 'checked' : ''}>
        </span>
        <span class="vs-fx-label">Animación central<small class="d-block text-muted">Cuerda (tira y afloja) por defecto. Apágala para dar todo el ancho a los dos lados.</small></span>
      </label>
      <label class="vs-fx-row mb-2 ${animOn ? '' : 'd-none'}" id="vsanim-compact-row" title="La animación se queda arriba y suelta la mitad de abajo del centro.">
        <span class="form-check form-switch m-0">
          <input class="form-check-input vsanim-compact-toggle" type="checkbox" role="switch" ${compact ? 'checked' : ''}>
        </span>
        <span class="vs-fx-label">Animación compacta (arriba)<small class="d-block text-muted">Encoge la animación a la franja de arriba; el resto del centro queda libre.</small></span>
      </label>
      <label class="form-label small text-muted">Animación central del duelo</label>
      <div class="d-flex flex-wrap gap-2 mb-2 vsanim-list ${animOn ? '' : 'vsanim-list-off'}">
        ${anims.map(v => {
          const hasSrc = v.kind === 'lottie' && v.src && !v.needsSrc;
          return `
          <div class="ww-pick-tile vsanim-pick ${cur === v.id ? 'is-active' : ''}" data-id="${v.id}" data-needssrc="${v.needsSrc ? '1' : ''}" role="button" title="${escapeHtml(v.description || '')}" style="width:150px">
            <div class="vsanim-tile-body">
              ${hasSrc ? `<div class="vsanim-preview" data-src="${escapeHtml(v.src)}"></div>` : `<i class="bi ${v.kind === 'lottie' ? 'bi-filetype-json' : 'bi-people-fill'}"></i>`}
              <div class="small fw-semibold mt-1">${escapeHtml(v.label)}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div id="vsanim-src-row" class="mb-3 ${needsSrcNow ? '' : 'd-none'}" style="max-width:520px">
        <label class="form-label small text-muted">URL del archivo Lottie (.json)</label>
        <input id="vsanim-src" class="form-control form-control-sm" placeholder="https://…/animacion.json" value="${escapeHtml(curSrc)}">
        <div class="form-text">Fotograma 0 = gana izquierda · último = gana derecha · centro = empate.</div>
      </div>
      <label class="form-label small text-muted">Feedback en cada respuesta</label>
      <div class="vs-fx-grid">
        <!-- El SONIDO no está: su dueño es el silencio global (core/sounds.js),
             que se enciende en la antesala de cualquier modo. Aquí había una
             SEGUNDA casilla para lo mismo (§21b) y ganaba la que el profe no
             había tocado. Retirada 2026-09-01. -->
        ${fxRow('flash', 'Destello de color', 'Fondo verde al acertar, rojo al fallar.', fx.flash)}
        ${fxRow('confetti', 'Confeti por pregunta', 'Lluvia de confeti en cada acierto (desactivado por defecto).', fx.confetti)}
      </div>
    </section>`;
}

function teamsBlock(a) {
  const count = a.presentation?.teamsCount || 2;
  const scoring = a.presentation?.teamsScoring || 'auto';
  const T = getTemplate(a.template);
  const canAuto = canAutoScoreRound(T);   // MISMO criterio que modes/engine/teamsView (core/templateCapability.js)
  return `
    <section class="ww-mode-cfg" data-mode="teams">
      <h6 class="mb-1"><i class="bi bi-people-fill text-primary"></i> Equipos</h6>
      <p class="text-muted small mb-2">Valores por defecto al iniciar el modo por turnos (se pueden cambiar al empezar).</p>
      <div class="row g-3" style="max-width:560px">
        <div class="col-sm-6">
          <label class="form-label small text-muted d-block">¿Cuántos equipos?</label>
          <div class="btn-group" id="tm-count" role="group">
            ${[2, 3, 4].map(n => `<button type="button" class="btn btn-outline-primary ${n === count ? 'active' : ''}" data-n="${n}">${n}</button>`).join('')}
          </div>
        </div>
        <div class="col-sm-6">
          <label class="form-label small text-muted d-block">Puntuación por defecto</label>
          <div class="btn-group" id="tm-scoring" role="group">
            <button type="button" class="btn btn-outline-secondary ${scoring === 'auto' ? 'active' : ''} ${canAuto ? '' : 'd-none'}" data-mode="auto"><i class="bi bi-cpu"></i> Automática</button>
            <button type="button" class="btn btn-outline-secondary ${scoring !== 'auto' || !canAuto ? 'active' : ''}" data-mode="judge"><i class="bi bi-person-check"></i> Juez docente</button>
          </div>
          ${canAuto ? '' : '<div class="form-text">Esta plantilla no se autocorrige: solo juez docente.</div>'}
        </div>
      </div>
    </section>`;
}

function taskBlock(a) {
  const max = a.presentation?.taskMaxAttempts ?? 1;
  return `
    <section class="ww-mode-cfg" data-mode="task">
      <h6 class="mb-1"><i class="bi bi-journal-check text-warning"></i> Tarea</h6>
      <p class="text-muted small mb-2">Las tareas (código, fecha límite, alumnos) se crean al lanzar el modo
        <b>Tarea</b> desde la actividad. Aquí solo el valor por defecto:</p>
      <div style="max-width:260px">
        <label class="form-label small text-muted">Intentos por alumno (por defecto)</label>
        <input id="tk-attempts" type="number" min="1" max="20" class="form-control form-control-sm" value="${max}">
      </div>
    </section>`;
}

// SOLO (Individual): opciones del modo en solitario. Hoy: animación de progreso
// (una rana cruza saltando charcos a medida que el alumno acierta). On/off.
//
// SIN CABECERA PROPIA CUANDO YA HAY UNA. La pestaña «Modos» pintaba DOS secciones
// tituladas «Individual», con el mismo icono y una detrás de la otra: la de la
// plantilla (`spec.rules`, con el temporizador y los puntos) y esta. El profe ve
// dos veces el mismo rótulo y no puede saber por qué hay dos ni cuál manda.
// Son el mismo modo, así que son UNA sección: el shell dice si ya puso el título
// (captura del dueño, v1.51.616).
function soloBlock(a, { conTitulo = true } = {}) {
  const on = !!a.presentation?.soloAnimation && a.presentation.soloAnimation !== 'none';
  return `
    <section class="ww-mode-cfg" data-mode="solo">
      ${conTitulo ? '<h6 class="mb-1"><i class="bi bi-person-fill text-success"></i> Individual</h6>'
                  + '<p class="text-muted small mb-2">Opciones del modo en solitario.</p>' : ''}
      <label class="vs-fx-row" title="Muestra una rana que avanza con cada acierto.">
        <span class="form-check form-switch m-0">
          <input class="form-check-input solo-anim-toggle" type="checkbox" role="switch" ${on ? 'checked' : ''}>
        </span>
        <span class="vs-fx-label">Animación de progreso<small class="d-block text-muted">Una rana cruza saltando charcos a medida que el alumno acierta. Solo en modo Individual.</small></span>
      </label>
    </section>`;
}

/** HTML for the "Modos" tab. Empty-ish note if the activity has no extra modes. */
export function renderModesTab(a, { yaHayTituloIndividual = false } = {}) {
  const blocks = [soloBlock(a, { conTitulo: !yaHayTituloIndividual })];
  if (isVsCompatible(a)) blocks.push(vsBlock(a));
  if (sessionItems(a).length >= 1) blocks.push(teamsBlock(a));
  if (getTemplate(a?.template)?.meta?.modes?.async) blocks.push(taskBlock(a));
  if (!blocks.length) {
    return `<p class="text-muted mb-0">Esta actividad no tiene modos extra configurables (En vivo tiene su propia pestaña).</p>`;
  }
  return `<div class="ww-modes-cfg">${blocks.join('<hr class="my-4">')}</div>`;
}

/** Wire the tab's controls. Mutates a.presentation and calls onChange. Updates
 *  selections IN PLACE (no repaint) so the active editor tab doesn't reset. */
export function wireModesTab(root, a, onChange) {
  const pres = () => (a.presentation = a.presentation || {});

  // Destroy stale previews from previous render, start fresh static thumbnails.
  _editorPreviewAnims.forEach(p => { try { p.destroy(); } catch {} });
  _editorPreviewAnims = [];
  const myGen = ++_editorPreviewGen;
  const previewEls = [...root.querySelectorAll('.vsanim-preview[data-src]')];
  if (previewEls.length) {
    startPreviewAnims(previewEls).then(anims => {
      if (myGen !== _editorPreviewGen) { anims.forEach(p => { try { p.destroy(); } catch {} }); return; }
      _editorPreviewAnims.push(...anims);
    }).catch(() => {});
  }

  // SOLO — animación de progreso on/off (hoy solo la rana).
  on(root, 'change', '.solo-anim-toggle', (_, el) => {
    pres().soloAnimation = el.checked ? 'frog' : null;
    onChange(a);
  });
  // VS — central animation on/off (default on = "cuerda").
  on(root, 'change', '.vsanim-toggle', (_, el) => {
    setVsAnimacion(a, el.checked);
    onChange(a);
    root.querySelector('.vsanim-list')?.classList.toggle('vsanim-list-off', !el.checked);
    // Sin animación no hay nada que compactar: el control se esconde con ella.
    root.querySelector('#vsanim-compact-row')?.classList.toggle('d-none', !el.checked);
  });
  on(root, 'change', '.vsanim-compact-toggle', (_, el) => {
    pres().vsAnimCompact = el.checked;
    onChange(a);
  });
  // VS — animation tiles.
  on(root, 'click', '.vsanim-pick', (_, b) => {
    pres().vsAnimation = b.dataset.id;
    onChange(a);
    root.querySelectorAll('.vsanim-pick').forEach(p => p.classList.toggle('is-active', p === b));
    root.querySelector('#vsanim-src-row')?.classList.toggle('d-none', !b.dataset.needssrc);
  });
  on(root, 'input', '#vsanim-src', (e) => { pres().vsAnimationSrc = e.target.value.trim(); onChange(a); });
  // VS — feedback toggles.
  on(root, 'change', '.vs-fx', (_, el) => {
    setVsFeedback(a, el.dataset.fx, el.checked);
    onChange(a);
  });

  // Equipos — defaults.
  on(root, 'click', '#tm-count button', (_, b) => {
    pres().teamsCount = Number(b.dataset.n);
    onChange(a);
    root.querySelectorAll('#tm-count button').forEach(x => x.classList.toggle('active', x === b));
  });
  on(root, 'click', '#tm-scoring button', (_, b) => {
    pres().teamsScoring = b.dataset.mode;
    onChange(a);
    root.querySelectorAll('#tm-scoring button').forEach(x => x.classList.toggle('active', x === b));
  });

  // Tarea — default attempts.
  on(root, 'input', '#tk-attempts', (e) => {
    pres().taskMaxAttempts = Math.max(1, Number(e.target.value) || 1);
    onChange(a);
  });
}
