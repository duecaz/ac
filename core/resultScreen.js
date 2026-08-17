// Pantalla de FIN de actividad, unificada para todas las plantillas (quiz, math,
// match, memory, tildes/comas, ruleta). Antes cada player repetía este HTML y su
// enlace "Inicio" → fácil que uno se desincronice (ya pasó). Devuelve un string;
// el player hace mount(rootSel, resultScreenHtml({...})). `lead`/`stats` son HTML
// ya formado por quien llama.
// Pasa `score` y `maxScore` numéricos para obtener icono/título automático según
// el porcentaje: ≥80% trofeo, ≥50% estrella, <50% emoji-frown.
//
// A DÓNDE LLEVA EL BOTÓN no se decide aquí: lo declara `core/afterPlay.js` a
// partir del MODO y de si hay sesión. Esta pantalla llevaba `#/home` escrito a
// mano → «Mis actividades», que a quien juega sin cuenta no le pertenece
// (hallazgo del dueño, 2026-08-17) y que en la app del alumno ni existe.
// `mode` es el mismo de `core/persistPolicy.js`.
import { destinoTrasJugar, puedeRepetir } from './afterPlay.js';

export function resultScreenHtml({ icon, iconColor, title, lead = '', stats = '', mode = 'solo', score, maxScore } = {}) {
  if (icon === undefined && maxScore > 0) {
    const ratio = score / maxScore;
    if (ratio >= 0.8)      { icon = 'bi-trophy-fill';  iconColor = 'text-warning';  title = title ?? '¡Excelente!'; }
    else if (ratio >= 0.5) { icon = 'bi-star-fill';    iconColor = 'text-primary';  title = title ?? '¡Bien hecho!'; }
    else                   { icon = 'bi-emoji-frown';  iconColor = 'text-secondary'; title = title ?? '¡Sigue practicando!'; }
  }
  icon      = icon      ?? 'bi-trophy-fill';
  iconColor = iconColor ?? 'text-warning';
  title     = title     ?? '¡Terminado!';
  const salida = destinoTrasJugar(mode);
  // «Jugar otra vez» es la acción PRINCIPAL de quien acaba de jugar (es lo que
  // ofrece Wordwall al terminar, en vez de mandarte a un panel): va primero y
  // en color. Donde hay tope de intentos (Tarea) no se ofrece — repetir no
  // sería gratis y el botón mentiría.
  const repetir = puedeRepetir(mode)
    ? `<button type="button" class="btn btn-primary btn-lg me-2" data-ww-replay><i class="bi bi-arrow-repeat"></i> Jugar otra vez</button>`
    : '';
  return `
    <div class="text-center py-5">
      <i class="bi ${icon} display-1 ${iconColor}"></i>
      <h2 class="mt-3">${title}</h2>
      ${lead ? `<p class="lead">${lead}</p>` : ''}
      ${stats ? `<p class="text-muted">${stats}</p>` : ''}
      <div class="mt-3">
        ${repetir}
        <a href="${salida.href}" class="btn btn-outline-secondary btn-lg"><i class="bi ${salida.icon}"></i> ${salida.label}</a>
      </div>
    </div>`;
}
