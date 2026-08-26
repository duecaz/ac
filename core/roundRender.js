// Shared "choice round" renderer for the session formats (VS / Equipos-auto).
// Paints ONE multiple-choice round (a prompt + option buttons) into `root` and
// calls onSubmit(value) once when an option is chosen, then locks itself; the
// surrounding view shows ✓/✗ feedback. Reused by Quiz and Match so the option
// UI lives in one place. Templates with a non-choice interaction (Tildes/Comas)
// render their own.
import { escapeHtml } from './html.js';

// Iconos de forma de las opciones (Quiz/Live), en orden. DUEÑO ÚNICO: estaban
// escritos cuatro veces (aquí, quiz/player.js y los dos módulos de preview que
// se retiraron en v1.51.406).
export const SHAPE_ICONS = ['bi-triangle-fill', 'bi-diamond-fill', 'bi-circle-fill', 'bi-square-fill'];

export function renderChoiceRound(root, payload, { onSubmit } = {}) {
  const opts = payload?.options || [];
  root.innerHTML = `
    <div class="rq-q text-center fs-4 fw-semibold mb-3">${escapeHtml(payload?.question || '')}</div>
    ${payload?.image ? `<div class="text-center mb-2"><img src="${escapeHtml(payload.image)}" style="max-height:130px" class="img-fluid"></div>` : ''}
    <div class="ww-opt-grid">
      ${opts.map((o, i) => `
        <button class="btn vs-opt rq-opt" data-value="${escapeHtml(o)}">
          <i class="bi ${SHAPE_ICONS[i % 4]} me-2"></i>${escapeHtml(o)}
        </button>`).join('')}
    </div>`;
  let done = false;
  // MULTITÁCTIL: usamos pointerdown (no click) para que en una pizarra
  // interactiva cada toque se procese por puntero e inmediatamente — dos
  // alumnos en los dos paneles VS pueden responder a la vez sin que el clic de
  // uno serialice/bloquee al otro. preventDefault evita selección/zoom.
  root.querySelectorAll('.rq-opt').forEach(btn => btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (done) return;
    done = true;
    root.querySelectorAll('.rq-opt').forEach(b => { b.disabled = true; });
    btn.classList.add('rq-picked');
    onSubmit?.(btn.dataset.value);
  }));
}

// Numeric keypad round (Operaciones): a prompt + on-screen number pad. Builds a
// digit string and calls onSubmit(value) once on ✓, then locks. Reused by the
// math template for SOLO and by VS / Equipos via renderRound.
// `data-ww-submit` marca EL control de envío (play.submit:'boton'). No es
// decorativo: `tools/matrix-smoke.mjs` los cuenta en el panel VS y falla si hay
// dos — "cuántos toques cuesta responder" es una decisión de producto, no algo
// que cada plantilla decida por su cuenta con la clase mirando.
export function renderKeypadRound(root, payload, { onSubmit } = {}) {
  root.innerHTML = `
    <div class="ww-keypad-round">
      <div class="edu-sec edu-sec--enunciado ww-keypad-head">
        <div class="ww-keypad-q">${escapeHtml(payload?.question || '')} <span class="ww-keypad-eq">=</span></div>
        <div class="ww-keypad-display" data-display>0</div>
      </div>
      <div class="edu-sec edu-sec--tablero ww-keypad">
        ${[1,2,3,4,5,6,7,8,9].map(n => `<button type="button" class="btn ww-key" data-k="${n}">${n}</button>`).join('')}
        <button type="button" class="btn ww-key ww-key-fn" data-k="back" aria-label="Borrar"><i class="bi bi-backspace"></i></button>
        <button type="button" class="btn ww-key" data-k="0">0</button>
        <button type="button" class="btn ww-key ww-key-ok" data-k="ok" data-ww-submit aria-label="Aceptar"><i class="bi bi-check-lg"></i></button>
      </div>
    </div>`;
  const disp = root.querySelector('[data-display]');
  let val = '';
  let done = false;
  const draw = () => { disp.textContent = val === '' ? '0' : val; };
  // pointerdown (no click) → respuesta táctil inmediata y por puntero (multitáctil).
  root.querySelectorAll('.ww-key').forEach(btn => btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (done) return;
    const k = btn.dataset.k;
    if (k === 'back') { val = val.slice(0, -1); draw(); return; }
    if (k === 'ok') {
      if (val === '') return;            // ignore empty submit
      done = true;
      root.querySelectorAll('.ww-key').forEach(b => { b.disabled = true; });
      onSubmit?.(val);
      return;
    }
    if (val.length < 9) { val += k; draw(); }
  }));
  draw();
}

// `shuffle` YA NO SE RE-EXPORTA desde aquí. Vive en `core/azar.js`, con la
// fuente de azar que lo alimenta. La re-exportación era una puerta de cortesía
// para no tocar los importadores, y contradecía justo lo que el movimiento venía
// a establecer: `azar.js` se declara «dueño único del barajado» y nueve de los
// once consumidores llegaban por otra puerta. Peor: `globos/template.js` no
// importaba NADA más de aquí, así que un módulo de declaración —que corre en
// Node, en los tests de contrato— dependía de un renderizador con DOM solo para
// barajar. Los nueve apuntan ya a `core/azar.js`.
