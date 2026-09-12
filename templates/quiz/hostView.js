// LA PANTALLA DEL PROYECTOR de Quiz en vivo: la rejilla de opciones de colores
// (fase `question`) y el reparto de respuestas con la correcta (fase `reveal`).
// Vive aparte de `template.js` porque eso es una VISTA —markup, colores y
// recuento— y la plantilla es una DECLARACIÓN: mezcladas, leer «qué declara
// Quiz» obligaba a saltarse 30 líneas de HTML.
import { SHAPE_ICONS } from '../../core/roundRender.js';
import { escapeHtml } from '../../core/html.js';
import { comoQaItem } from './item.js';

/** El valor que afirmó una respuesta de la sala. `answers` viaja como
 *  `unknown[]` en el contrato: cada plantilla sabe qué guarda dentro.
 * @param {unknown} a
 * @returns {unknown}
 */
function valorRespondido(a) {
  return (a && typeof a === 'object' && 'value' in a) ? a.value : undefined;
}

/**
 * `playerMap`: opcional `{ [valorDeOpción]: ['Ana', 'Beto', …] }`, lo arma el host.
 * @param {Element} root
 * @param {import('../../kernel/contracts/template.js').HostRoundContext} [ctx]
 * @returns {void}
 */
export function renderQuizRoundHost(root, { phase, item, answers = [], playerMap = {} } = {}) {
  const it = comoQaItem(item);
  const opts = it?.options || [];
  if (phase === 'reveal') {
    const counts = opts.map(o => answers.filter(a => String(valorRespondido(a)) === String(o)).length);
    const max = Math.max(1, ...counts);
    root.innerHTML = `
      <h3 class="text-center mb-3">${escapeHtml(it?.question || '')}</h3>
      <p class="text-center text-success fw-bold fs-4"><i class="bi bi-check-circle-fill"></i> ${escapeHtml(String(it?.answer ?? ''))}</p>
      <div class="mb-4">
        ${opts.map((o, i) => {
          const isOk = String(o) === String(it?.answer);
          const w = Math.round(100 * counts[i] / max);
          const names = playerMap[String(o)] || [];
          return `<div class="mb-2">
            <div class="d-flex justify-content-between"><span>${'ABCD'[i] || ''}. ${escapeHtml(o)} ${isOk ? '<i class="bi bi-check-circle-fill text-success"></i>' : ''}</span><b>${counts[i]}</b></div>
            <div class="progress" style="height:24px"><div class="progress-bar ${isOk ? 'bg-success' : 'bg-secondary'}" style="width:${w}%"></div></div>
            ${names.length ? `<div class="text-muted small mt-1 ps-1">${names.map(n => `<span class="badge bg-light text-dark border me-1">${escapeHtml(n)}</span>`).join('')}</div>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    return;
  }
  root.innerHTML = `
    <h2 class="text-center my-4">${escapeHtml(it?.question || '')}</h2>
    ${it?.image ? `<div class="text-center mb-3"><img src="${escapeHtml(it.image)}" class="img-fluid" style="max-height:240px"></div>` : ''}
    <div class="ww-opt-grid mb-4">
      ${opts.map((o, i) => `<button class="btn btn-lg ww-shape-${(i % 4) + 1}" disabled><i class="bi ${SHAPE_ICONS[i % 4]} me-2"></i>${escapeHtml(o)}</button>`).join('')}
    </div>`;
}
