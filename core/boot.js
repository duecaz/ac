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
import { observeResize } from './observeResize.js';

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

// EL MENÚ HAMBURGUESA (móvil) — abrir, y sobre todo CERRAR.
//
// Estaba resuelto con `onclick` en el HTML: toggle al pulsar y quitar la clase
// al pulsar una acción. Faltaba lo que todo el mundo hace sin pensar — tocar
// FUERA para cerrar—, así que el desplegable se quedaba abierto tapando la
// pantalla hasta acertarle otra vez al botón (reporte del dueño, 2026-08-15).
// Se cablea aquí, donde ya vive el resto del chrome de la barra, y no en cada
// HTML: dos copias de un mismo comportamiento derivan (esa es la lección de la
// semana). Cierra por las CUATRO vías que un usuario espera: el propio botón,
// una acción del menú, un toque fuera, y Escape.
export function wireTopbarMenu(sel = '.ww-topbar') {
  const bar = document.querySelector(sel);
  if (!bar || bar.dataset.wwMenuWired) return () => {};
  bar.dataset.wwMenuWired = '1';
  const boton = bar.querySelector('.ww-topbar__burger');
  const sello = () => boton?.setAttribute('aria-expanded', String(bar.classList.contains('open')));
  const cerrar = () => { bar.classList.remove('open'); sello(); };
  bar.addEventListener('click', (e) => {
    if (e.target.closest('.ww-topbar__burger')) { bar.classList.toggle('open'); sello(); return; }
    if (e.target.closest('.ww-topbar__actions')) cerrar();
  });
  const fuera = (e) => { if (!bar.contains(e.target)) cerrar(); };
  const esc = (e) => { if (e.key === 'Escape') cerrar(); };
  document.addEventListener('click', fuera);
  document.addEventListener('keydown', esc);
  // Navegar también cierra: con el menú abierto encima de la vista nueva, el
  // profe cree que no pasó nada y vuelve a pulsar (ley de vista §23).
  window.addEventListener('hashchange', cerrar);
  const soltarMedida = medirBarra(bar);
  return () => {
    document.removeEventListener('click', fuera);
    document.removeEventListener('keydown', esc);
    window.removeEventListener('hashchange', cerrar);
    soltarMedida();
  };
}

// EL ALTO DE LA BARRA SE MIDE, NO SE DECLARA.
//
// La pantalla del alumno se compromete a llenar la ventana sin scroll, y para
// eso descuenta la barra con `--ww-topbar-h`. Ese valor nació como un 56 escrito
// en el CSS… y un número escrito es una promesa que el navegador no firmó: la
// barra es `flex-wrap: wrap`, así que a ciertos anchos las acciones saltan de
// línea y mide bastante más; y con el zoom del navegador, o una fuente de
// sistema más grande, tampoco son 56. Cada píxel que la barra crece por encima
// del número es un píxel de scroll en el móvil del alumno — que es justo lo que
// seguía apareciendo tras «arreglarlo» con la constante (dueño, 2026-08-15:
// «seguro no cuenta el tamaño del navbar»).
//
// Se mide la caja REAL y se reescribe cuando cambia (rotar, redimensionar,
// abrir el desplegable). `observeResize` está rAF-debounced (§ ResizeObserver en
// players), así que esto no dispara bucles de layout.
function medirBarra(bar) {
  const raiz = document.documentElement;
  const anota = () => {
    const alto = Math.ceil(bar.getBoundingClientRect().height);
    // Con el desplegable ABIERTO la barra crece hacia abajo en `position:
    // absolute` (no ocupa flujo): ese alto no se descuenta, o el juego pegaría
    // un salto cada vez que el alumno abre el menú.
    if (!bar.classList.contains('open') && alto > 0) {
      raiz.style.setProperty('--ww-topbar-h', alto + 'px');
    }
  };
  anota();
  return observeResize(bar, anota);
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
