// Utilidades de arranque compartidas por las tres entradas (main.teacher/
// student/embed). Antes cada una repetía: cablear sonidos+efectos al bus, sellar
// la versión en el navbar y montar el botón de silencio.
//
// Importar este módulo tiene EFECTO SECUNDARIO: suscribe sonidos y efectos
// visuales al bus de GameEvents (igual que los `import './core/sounds.js'`
// sueltos que había en cada main).
import './sounds.js';   // efecto: suscribe sonidos a GameEvents
import './effects.js';  // efecto: suscribe confeti/efectos a GameEvents
import { VERSION } from './constants.js';
import { isMuted, setMuted } from './sounds.js';
import { applyPerfClass } from './perf.js';

// Marca el dispositivo como lite (gama baja) lo antes posible → el CSS y la
// animación central degradan para que el VS responda fluido en pizarras lentas.
applyPerfClass();

// Escribe `v<VERSION>` en el slot de versión del navbar, si existe.
// Y lo convierte en el REPORTE DE UN TOQUE (core/bugReport.js): tocarlo copia
// versión + pantalla + últimos errores al portapapeles — el compañero que
// testea ya usa este chip para citar la versión; ahora el mismo gesto se lleva
// el contexto entero. Sin dato de alumno ni de aparato (R7).
export function stampVersion(id = 'ww-version') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = 'v' + VERSION;
  el.title = 'Tocar para copiar un reporte (versión · pantalla · últimos errores)';
  el.style.cursor = 'pointer';
  el.addEventListener('click', async () => {
    const { buildBugReport } = await import('./bugReport.js');
    const { toast } = await import('./toast.js');
    const texto = buildBugReport();
    try {
      await navigator.clipboard.writeText(texto);
      toast('Reporte copiado: pégalo en el chat del proyecto.', 'success', 4000);
    } catch {
      // Sin permiso de portapapeles (http, iframe): enséñalo para copiar a mano.
      toast('No se pudo copiar solo — cópialo de la consola.', 'warning', 5000);
      console.log(texto);
    }
  });
}

// Monta el botón de silencio en su slot del navbar (idempotente, se redibuja
// al alternar). No hace nada si el slot no existe (p.ej. en el embed).
export function attachMuteButton(slotId = 'ww-mute-slot') {
  const slot = document.getElementById(slotId);
  if (!slot) return;
  const paint = () => {
    slot.innerHTML = `<button class="btn btn-sm btn-outline-light" id="ww-mute-btn" title="${isMuted() ? 'Activar sonido' : 'Silenciar'}"><i class="bi ${isMuted() ? 'bi-volume-mute-fill' : 'bi-volume-up-fill'}"></i></button>`;
  };
  paint();
  slot.addEventListener('click', (e) => {
    if (e.target.closest('#ww-mute-btn')) { setMuted(!isMuted()); paint(); }
  });
}
