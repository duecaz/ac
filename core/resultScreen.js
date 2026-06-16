// Pantalla de FIN de actividad, unificada para todas las plantillas (quiz, math,
// match, memory, tildes/comas, ruleta). Antes cada player repetía este HTML y su
// enlace "Inicio" → fácil que uno se desincronice (ya pasó). Devuelve un string;
// el player hace mount(rootSel, resultScreenHtml({...})). `lead`/`stats` son HTML
// ya formado por quien llama.
// Pasa `score` y `maxScore` numéricos para obtener icono/título automático según
// el porcentaje: ≥80% trofeo, ≥50% estrella, <50% emoji-frown.
export function resultScreenHtml({ icon, iconColor, title, lead = '', stats = '', homeHref = '#/home', score, maxScore } = {}) {
  if (icon === undefined && maxScore > 0) {
    const ratio = score / maxScore;
    if (ratio >= 0.8)      { icon = 'bi-trophy-fill';  iconColor = 'text-warning';  title = title ?? '¡Excelente!'; }
    else if (ratio >= 0.5) { icon = 'bi-star-fill';    iconColor = 'text-primary';  title = title ?? '¡Bien hecho!'; }
    else                   { icon = 'bi-emoji-frown';  iconColor = 'text-secondary'; title = title ?? '¡Sigue practicando!'; }
  }
  icon      = icon      ?? 'bi-trophy-fill';
  iconColor = iconColor ?? 'text-warning';
  title     = title     ?? '¡Terminado!';
  return `
    <div class="text-center py-5">
      <i class="bi ${icon} display-1 ${iconColor}"></i>
      <h2 class="mt-3">${title}</h2>
      ${lead ? `<p class="lead">${lead}</p>` : ''}
      ${stats ? `<p class="text-muted">${stats}</p>` : ''}
      <a href="${homeHref}" class="btn btn-primary"><i class="bi bi-house"></i> Inicio</a>
    </div>`;
}
