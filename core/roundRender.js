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

// Fisher–Yates, returns the same array (callers pass a copy when needed).
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
