// Shared editor section for the per-MODE play settings, so any template editor
// gets the same "Modos de juego" tab with ONE include — instead of each editor
// re-inventing it (the drift trap). It configures what each shared-screen mode
// needs and writes to the SAME fields the play views already read:
//
//   VS      → presentation.vsAnimation / vsAnimationSrc (animation) and
//             presentation.vsFeedback {sound,flash,confetti} (per-answer fx).
//   Equipos → presentation.teamsCount (2-4) + presentation.teamsScoring (auto|judge)
//             used as the SETUP defaults in teamsView / memoryView.
//   Tarea   → presentation.taskMaxAttempts (default intentos al crear la tarea).
//
// Which blocks appear is gated by the SAME rules as the mode bar (core/modes.js):
// VS only when isVsCompatible; Tarea only when the template declares modes.async.
import { escapeHtml } from './html.js';
import { on } from './events.js';
import { isVsCompatible, sessionItems } from '../kernel/session/engine.js';
import { listVsAnimations } from './vsAnimations.js';
import { getTemplate } from './registry.js';

const VS_FX_DEFAULTS = { sound: true, flash: true, confetti: false };

const fxRow = (key, label, hint, on) => `
  <label class="vs-fx-row" title="${escapeHtml(hint)}">
    <span class="form-check form-switch m-0">
      <input class="form-check-input vs-fx" type="checkbox" role="switch" data-fx="${key}" ${on ? 'checked' : ''}>
    </span>
    <span class="vs-fx-label">${escapeHtml(label)}<small class="d-block text-muted">${escapeHtml(hint)}</small></span>
  </label>`;

function vsBlock(a) {
  const cur = a.presentation?.vsAnimation || 'svg-tug';
  const curSrc = a.presentation?.vsAnimationSrc || '';
  const fx = { ...VS_FX_DEFAULTS, ...(a.presentation?.vsFeedback || {}) };
  const anims = listVsAnimations();
  const needsSrcNow = anims.find(v => v.id === cur)?.needsSrc;
  return `
    <section class="ww-mode-cfg" data-mode="vs">
      <h6 class="mb-1"><i class="bi bi-fire text-danger"></i> VS (duelo)</h6>
      <p class="text-muted small mb-2">Cómo se ve y suena el duelo 1‑contra‑1 en pantalla compartida.</p>
      <label class="form-label small text-muted">Animación central del duelo</label>
      <div class="d-flex flex-wrap gap-2 mb-2">
        ${anims.map(v => `
          <div class="ww-pick-tile vsanim-pick ${cur === v.id ? 'is-active' : ''}" data-id="${v.id}" data-needssrc="${v.needsSrc ? '1' : ''}" role="button" title="${escapeHtml(v.description || '')}" style="width:150px">
            <div class="vsanim-tile-body"><i class="bi ${v.kind === 'lottie' ? 'bi-filetype-json' : 'bi-people-fill'}"></i><div class="small fw-semibold mt-1">${escapeHtml(v.label)}</div></div>
          </div>`).join('')}
      </div>
      <div id="vsanim-src-row" class="mb-3 ${needsSrcNow ? '' : 'd-none'}" style="max-width:520px">
        <label class="form-label small text-muted">URL del archivo Lottie (.json)</label>
        <input id="vsanim-src" class="form-control form-control-sm" placeholder="https://…/animacion.json" value="${escapeHtml(curSrc)}">
        <div class="form-text">Fotograma 0 = gana izquierda · último = gana derecha · centro = empate.</div>
      </div>
      <label class="form-label small text-muted">Feedback en cada respuesta</label>
      <div class="vs-fx-grid">
        ${fxRow('sound', 'Sonido', 'Un sonido corto al acertar o fallar.', fx.sound)}
        ${fxRow('flash', 'Destello de color', 'Fondo verde al acertar, rojo al fallar.', fx.flash)}
        ${fxRow('confetti', 'Confeti por pregunta', 'Lluvia de confeti en cada acierto (desactivado por defecto).', fx.confetti)}
      </div>
    </section>`;
}

function teamsBlock(a) {
  const count = a.presentation?.teamsCount || 2;
  const scoring = a.presentation?.teamsScoring || 'auto';
  const T = getTemplate(a.template);
  const canAuto = typeof T?.scoreSubmission === 'function' && typeof T?.getRoundPayload === 'function';
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

/** HTML for the "Modos" tab. Empty-ish note if the activity has no extra modes. */
export function renderModesTab(a) {
  const blocks = [];
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
    pres().vsFeedback = { ...VS_FX_DEFAULTS, ...(a.presentation?.vsFeedback || {}), [el.dataset.fx]: el.checked };
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
