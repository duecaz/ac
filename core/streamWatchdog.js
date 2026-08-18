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
// LA PESTAÑA OCULTA ES PARTE DE LA REGLA, no del adaptador (2026-08-18). Estuvo
// unos días repartida: el adaptador se cableaba su `visibilitychange` a mano y
// decidía por su cuenta cuándo no renovar. Eso dejaba la parte con más riesgo
// —«no gasto con la pantalla apagada, pero al volver quiero datos frescos»— sin
// un solo test, porque el único sitio donde se podía probar era un navegador de
// verdad. Aquí dentro es un caso más con un `document` de mentira.
//
// Uso:
//   const vigia = startStreamWatchdog({
//     silencioMs: 80000, onRenew: () => …, pausarOculto: true, jitterMs: 2000 });
//   vigia.touch();        // cada vez que llega algo por el flujo
//   vigia.stop();         // al desuscribirse (el disposer de la vista)
import { clock } from './clock.js';

/**
 * @param {object} opts
 * @param {number} opts.silencioMs   cuánto silencio se tolera antes de renovar.
 * @param {Function} opts.onRenew    qué hacer cuando se agota (cerrar y reconectar).
 * @param {number} [opts.chequeoMs]  cada cuánto se mira el reloj (def. 10 s).
 * @param {boolean} [opts.pausarOculto] con la pestaña oculta no se renueva, y al
 *        volver a primer plano se renueva SOLO si de verdad hubo silencio.
 * @param {number} [opts.jitterMs]   retraso aleatorio antes de renovar. Con 30
 *        móviles que se desbloquean a la vez («sacad el teléfono»), sin esto
 *        salen 30 reconexiones en el mismo segundo contra la misma Pi.
 * @param {Function} [opts.now]      reloj (def. `clock.now`) — inyectable para test.
 * @param {Function} [opts.setIntervalFn] scheduler inyectable.
 * @param {Function} [opts.clearIntervalFn]
 * @param {Function} [opts.setTimeoutFn]  scheduler del jitter, inyectable.
 * @param {Function} [opts.aleatorio] fuente del jitter (def. Math.random).
 * @param {object} [opts.doc]        `document` inyectable (null = sin pantalla).
 */
export function startStreamWatchdog({
  silencioMs,
  onRenew,
  chequeoMs = 10000,
  pausarOculto = false,
  jitterMs = 0,
  now = () => clock.now(),
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  setTimeoutFn = setTimeout,
  aleatorio = Math.random,
  doc = (typeof document !== 'undefined' ? document : null),
} = {}) {
  let ultimo = now();
  let vivo = true;

  const oculto = () => !!(pausarOculto && doc && doc.visibilityState === 'hidden');
  const silencio = () => now() - ultimo;

  function renovar() {
    if (!vivo) return;
    // Se reinicia ANTES de avisar: si `onRenew` reconecta y el flujo nuevo tarda
    // en hablar, no queremos una segunda renovación al chequeo siguiente.
    ultimo = now();
    if (!jitterMs) { onRenew(); return; }
    setTimeoutFn(() => { if (vivo) onRenew(); }, aleatorio() * jitterMs);
  }

  const id = setIntervalFn(() => {
    if (!vivo || oculto()) return;
    if (silencio() < silencioMs) return;
    renovar();
  }, chequeoMs);

  // AL VOLVER A PRIMER PLANO, solo si hubo silencio DE VERDAD. Renovar en cada
  // vuelta costaba una reconexión completa (SSE nuevo + POST de suscripción +
  // resincronizado) por cada vez que el alumno mira una notificación o el profe
  // hace Alt-Tab a sus diapositivas — y en esos saltos de dos segundos el flujo
  // no llegó a caerse. La mitad del umbral es el punto en que renovar sale más
  // barato que arriesgarse.
  const alVolver = () => {
    if (!vivo || !doc || doc.visibilityState !== 'visible') return;
    if (silencio() < silencioMs / 2) return;
    renovar();
  };
  if (pausarOculto && doc) doc.addEventListener('visibilitychange', alVolver);

  return {
    touch() { ultimo = now(); },
    /** Silencio acumulado del flujo, en ms (para quien necesite decidir). */
    silencioMs: silencio,
    stop() {
      vivo = false;
      clearIntervalFn(id);
      if (pausarOculto && doc) doc.removeEventListener('visibilitychange', alVolver);
    },
  };
}
