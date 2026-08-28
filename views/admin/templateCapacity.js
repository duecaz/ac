// v1.51.629: adminView se partió POR PANEL. Esta sección agrupa los TRES
// cuadros de diagnóstico que consumen `buildAdminMatrix()` (views/admin/matrix.js,
// construcción PURA de HTML): «Capacidad por plantilla» (qué modos puede
// ofrecer cada una) + «Tus actividades» (modos disponibles ahora) +
// «Conversiones de formato» (qué puede convertirse a qué). Las tres son
// SOLO LECTURA — nada que cablear, la vista es toda la sección.
import { escapeHtml } from '../../core/html.js';
import { MODE_DEFS } from '../../core/modes.js';
import { CONTRACT_METHODS } from '../../core/modeMatrix.js';

export function createTemplateCapacitySection({ acts, capRows, actRows, convRows }) {
  return {
    html: () => `
      <h5 class="mt-4">Capacidad por plantilla <small class="text-muted">(¿qué modos puede ofrecer?)</small></h5>
      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle">
          <thead class="table-light"><tr><th>Plantilla</th>
            ${MODE_DEFS.map(m => `<th class="text-center" title="${escapeHtml(m.label)}">${escapeHtml(m.short)}</th>`).join('')}
            ${CONTRACT_METHODS.map(me => `<th class="text-center small">${me.replace('render', 'r·').replace('Submission', '')}</th>`).join('')}
          </tr></thead>
          <tbody>${capRows}</tbody>
        </table>
      </div>
      <p class="small text-muted">Pasa el cursor sobre una celda de modo para ver el motivo. La derecha = métodos del contrato implementados.</p>

      <h5 class="mt-4">Tus actividades <small class="text-muted">(modos disponibles ahora)</small></h5>
      ${acts.length ? `<div class="table-responsive"><table class="table table-sm table-bordered align-middle">
        <thead class="table-light"><tr><th>Actividad</th>${MODE_DEFS.map(m => `<th class="text-center">${escapeHtml(m.short)}</th>`).join('')}<th></th></tr></thead>
        <tbody>${actRows}</tbody></table></div>` : '<p class="text-muted">No hay actividades guardadas.</p>'}

      <h5 class="mt-4">Conversiones de formato <small class="text-muted">(¿a qué puede cambiar cada plantilla conservando el contenido?)</small></h5>
      <div class="table-responsive"><table class="table table-sm table-bordered align-middle">
        <thead class="table-light"><tr><th>Plantilla</th><th>Puede convertirse a</th></tr></thead>
        <tbody>${convRows}</tbody></table></div>
      <div class="small text-muted">
        <b>directo</b> = mismo modelo de contenido (no transforma). <b>conversión</b> = transforma el contenido (puede perder datos).<br>
        <b>Matemáticas ⇄ Quiz</b> (modelo <code>qa</code>): de <b>Matemáticas → Quiz</b> se generan opciones automáticamente
        (la respuesta + distractores numéricos); de <b>Quiz → Matemáticas</b> se conserva pregunta y respuesta y se quitan las opciones.
        Reglas en <code>kernel/content/qaAdapt.js</code> · grafo por modelo en <code>kernel/content/convert.js</code>.
      </div>`,
    wire: () => {},
  };
}
