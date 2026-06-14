// Pantalla de FIN de actividad, unificada para todas las plantillas (quiz, math,
// match, memory, tildes/comas, ruleta). Antes cada player repetía este HTML y su
// enlace "Inicio" → fácil que uno se desincronice (ya pasó). Devuelve un string;
// el player hace mount(rootSel, resultScreenHtml({...})). `lead`/`stats` son HTML
// ya formado por quien llama.
export function resultScreenHtml({ icon = 'bi-trophy-fill', title = '¡Terminado!', lead = '', stats = '', homeHref = '#/home' } = {}) {
  return `
    <div class="text-center py-5">
      <i class="bi ${icon} display-1 text-warning"></i>
      <h2 class="mt-3">${title}</h2>
      ${lead ? `<p class="lead">${lead}</p>` : ''}
      ${stats ? `<p class="text-muted">${stats}</p>` : ''}
      <a href="${homeHref}" class="btn btn-primary"><i class="bi bi-house"></i> Inicio</a>
    </div>`;
}
