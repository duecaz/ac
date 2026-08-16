// VIGÍA DE UN FLUJO PERMANENTE — renovar ANTES de que lo corten.
//
// La idea es del dueño (2026-08-16), viendo la consola llena de cortes en el
// modo en vivo: «si es por inactividad debería tener un aviso antes de cumplirse
// la inactividad, eso es básico». El principio es el correcto y es el que usa
// cualquier conexión larga; el matiz técnico es quién puede darlo:
//
//   · SSE (`EventSource`) es de UNA dirección. El navegador NO puede mandar un
//     latido por ese canal, así que «avisar» no lo puede hacer el cliente.
//   · Lo que sí puede el cliente es NO ESPERAR AL ERROR: si el flujo lleva
//     demasiado tiempo callado, lo renueva por decisión propia. El resultado es
//     un relevo silencioso —sin error en consola y sin banner de «Reconectando»—
//     en vez de un corte que el profe ve con la clase delante.
//
// Por qué es un PRIMITIVO y no un `setInterval` suelto en el adaptador: la ley
// de vista (§23) dice que un reloj repetitivo va por su primitivo o lo limpia un
// ciclo de vida. Aquí además el scheduler se INYECTA, así que la regla se prueba
// con tiempo congelado y sin abrir un navegador.
//
// Uso:
//   const vigia = startStreamWatchdog({ silencioMs: 80000, onRenew: () => … });
//   vigia.touch();        // cada vez que llega algo por el flujo
//   vigia.stop();         // al desuscribirse (el disposer de la vista)
import { clock } from './clock.js';

/**
 * @param {object} opts
 * @param {number} opts.silencioMs   cuánto silencio se tolera antes de renovar.
 * @param {Function} opts.onRenew    qué hacer cuando se agota (cerrar y reconectar).
 * @param {number} [opts.chequeoMs]  cada cuánto se mira el reloj (def. 10 s).
 * @param {Function} [opts.now]      reloj (def. `clock.now`) — inyectable para test.
 * @param {Function} [opts.setIntervalFn] scheduler inyectable.
 * @param {Function} [opts.clearIntervalFn]
 */
export function startStreamWatchdog({
  silencioMs,
  onRenew,
  chequeoMs = 10000,
  now = () => clock.now(),
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  let ultimo = now();
  let vivo = true;
  const id = setIntervalFn(() => {
    if (!vivo) return;
    if (now() - ultimo < silencioMs) return;
    // Se reinicia ANTES de avisar: si `onRenew` reconecta y el flujo nuevo tarda
    // en hablar, no queremos una segunda renovación al chequeo siguiente.
    ultimo = now();
    onRenew();
  }, chequeoMs);
  return {
    touch() { ultimo = now(); },
    stop() { vivo = false; clearIntervalFn(id); },
  };
}
