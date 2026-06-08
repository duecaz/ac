// Shared "choice round" renderer for the session formats (VS / Equipos-auto).
// Paints ONE multiple-choice round (a prompt + option buttons) into `root` and
// calls onSubmit(value) once when an option is chosen, then locks itself; the
// surrounding view shows ✓/✗ feedback. Reused by Quiz and Match so the option
// UI lives in one place. Templates with a non-choice interaction (Tildes/Comas)
// render their own.
import { escapeHtml } from './html.js';

const SHAPE_ICONS = ['bi-triangle-fill', 'bi-diamond-fill', 'bi-circle-fill', 'bi-square-fill'];

export function renderChoiceRound(root, payload, { onSubmit } = {}) {
  const opts = payload?.options || [];
  root.innerHTML = `
    <div class="rq-q text-center fs-4 fw-semibold mb-3">${escapeHtml(payload?.question || '')}</div>
    ${payload?.image ? `<div class="text-center mb-2"><img src="${escapeHtml(payload.image)}" style="max-height:130px" class="img-fluid"></div>` : ''}
    <div class="ww-kahoot-grid">
      ${opts.map((o, i) => `
        <button class="btn vs-opt rq-opt" data-value="${escapeHtml(o)}">
          <i class="bi ${SHAPE_ICONS[i % 4]} me-2"></i>${escapeHtml(o)}
        </button>`).join('')}
    </div>`;
  let done = false;
  root.querySelectorAll('.rq-opt').forEach(btn => btn.addEventListener('click', () => {
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
export function renderKeypadRound(root, payload, { onSubmit } = {}) {
  root.innerHTML = `
    <div class="ww-keypad-round">
      <div class="ww-keypad-q">${escapeHtml(payload?.question || '')} <span class="ww-keypad-eq">=</span></div>
      <div class="ww-keypad-display" data-display>0</div>
      <div class="ww-keypad">
        ${[1,2,3,4,5,6,7,8,9].map(n => `<button type="button" class="btn ww-key" data-k="${n}">${n}</button>`).join('')}
        <button type="button" class="btn ww-key ww-key-fn" data-k="back" aria-label="Borrar"><i class="bi bi-backspace"></i></button>
        <button type="button" class="btn ww-key" data-k="0">0</button>
        <button type="button" class="btn ww-key ww-key-ok" data-k="ok" aria-label="Aceptar"><i class="bi bi-check-lg"></i></button>
      </div>
    </div>`;
  const disp = root.querySelector('[data-display]');
  let val = '';
  let done = false;
  const draw = () => { disp.textContent = val === '' ? '0' : val; };
  root.querySelectorAll('.ww-key').forEach(btn => btn.addEventListener('click', () => {
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

// Fisher–Yates, returns the same array (callers pass a copy when needed).
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
