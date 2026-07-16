// Kit COMPARTIDO para los previews de tarjeta (miniatura 16:10 del home).
// Módulo HOJA: importa solo core/html.js — así cada `template.js` puede declarar
// su `static previewHtml(act)` importando de aquí SIN crear un ciclo con
// core/activityThumb.js (que a su vez despacha a las plantillas por el registro).
//
// El preview es markup ESTÁTICO de la primera pantalla del juego (sin timers,
// listeners ni canvas), escalado a la tarjeta. Vive JUNTO a la plantilla (en su
// template.js) para que no se desincronice del juego y para que el contrato
// (tests/templateContract.test.mjs) pueda exigir que exista: imposible crear una
// actividad sin preview u olvidar añadirla a un switch central.
import { escapeHtml } from './html.js';

// Escenario virtual = resolución nativa del panel (1280×800, 16:10). La actividad
// se pinta a este tamaño y luego TODO el escenario se escala a la tarjeta.
export const STAGE_W = 1280, STAGE_H = 800;

// Iconos de forma de las opciones (Quiz/Live), en orden.
export const SHAPE_ICONS = ['bi-triangle-fill', 'bi-diamond-fill', 'bi-circle-fill', 'bi-square-fill'];

// Cabecera "1 / N · ★ 0" que comparten Quiz y Operaciones.
export function headHtml(idx, total) {
  return `<div class="ww-phead d-flex justify-content-between align-items-center">
    <span class="badge bg-secondary">${idx} / ${total}</span>
    <span class="badge bg-primary">★ 0</span></div>`;
}

// Preview de respaldo: solo el título centrado. Lo usa una plantilla cuando su
// contenido está vacío (actividad recién creada), y activityThumb cuando una
// plantilla no declara previewHtml.
export function emptyHtml(act) {
  return `<div class="ww-player" style="display:flex;align-items:center;justify-content:center">
    <h2 class="text-center">${escapeHtml(act.title || 'Actividad')}</h2></div>`;
}
