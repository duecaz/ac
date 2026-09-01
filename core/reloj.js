// EL RELOJ DE LA ACTIVIDAD — uno solo, y lo llaman todos.
//
// Había TRES formas de decir la misma frase («cuánto llevas» / «cuánto te
// queda»): la cuenta atrás por ítem dentro del shell secuencial, el cronómetro
// del HUD (`cronoHud`, pegado por encima) y el reloj propio del runner de
// Tildes/Comas. Tres piezas ⇒ tres sitios donde configurarlo ⇒ el campo del
// editor existía en 4 plantillas de 13 y el cronómetro acabó siendo una casilla
// perdida en la pestaña de Puntuación. El dueño lo dijo así (2026-09-01): «solo
// le pusiste un cronómetro y listo… debe ser general para toda actividad tipo
// pregunta que sea compatible, debemos unificar, no estar parchando».
//
// LA REGLA, aquí y en ningún otro sitio:
//   · con LÍMITE (`rules.timer > 0`) → CUENTA ATRÁS, y avisa al llegar a cero:
//     es accionable (se acabó el turno);
//   · sin límite → CRONÓMETRO ascendente, que se puede apagar (`rules.crono:false`);
//   · nunca los dos a la vez — dos relojes en pantalla confunden.
//
// DÓNDE se pinta NO lo decide el reloj: se lo dan (`pintar`). El chip del HUD y
// la barra de Tildes/Comas son dos sitios distintos para el mismo dato, y por
// eso el módulo no sabe de DOM.
//
// Debajo usa los primitivos de §23 —`createCountdown` para la duración y
// `startElapsedTicker` para el ascendente—: no inventa un tercer reloj, los
// ORDENA. Y `serverNow()` para el ascendente, que es contra el reloj que mide
// ese primitivo (§22-5).
import { createCountdown } from './soloTimer.js';
import { startElapsedTicker } from './deadlineTicker.js';
import { serverNow } from './serverNow.js';

/** QUÉ RELOJ LE TOCA a esta actividad, sin montar nada. Lo preguntan el editor
 *  (para ofrecer el campo correcto), las vistas y los tests. */
export function relojDe(activity) {
  const limite = Math.max(0, Number(activity?.rules?.timer) || 0);
  if (limite > 0) return { tipo: 'cuenta', segundos: limite };
  if (activity?.rules?.crono === false) return { tipo: 'ninguno', segundos: 0 };
  return { tipo: 'crono', segundos: 0 };
}

/** ¿Esta PLANTILLA admite cuenta atrás? Lo DECLARA ella (`meta.play.reloj`), y
 *  la unidad es su palabra: «pregunta», «frase», «sopa». Sin declaración no hay
 *  cuenta atrás — una mecánica libre (Memoria, Emparejar) se cronometra, no se
 *  corta a mitad. */
export function unidadDeCuenta(T) {
  const u = T?.meta?.play?.reloj?.unidad;
  return typeof u === 'string' && u ? u : null;
}

/** ¿Y cronómetro? Por defecto sí: es información sin coste. Una plantilla puede
 *  decir que no (`reloj: { crono: false }`) si su mecánica ya lleva su tiempo a
 *  la vista, como Ordena las Pelotas. */
export function admiteCrono(T) {
  return T?.meta?.play?.reloj?.crono !== false;
}

/**
 * Monta el reloj que toque y devuelve `{ tipo, stop }`.
 * @param {object}   o
 * @param {object}   o.activity  de aquí sale QUÉ reloj (rules.timer / rules.crono).
 * @param {(texto:string, pct:number|null)=>void} o.pintar  dónde se ve. `pct` solo
 *        tiene sentido en la cuenta atrás (barra de progreso); en el cronómetro es null.
 * @param {()=>boolean} [o.alive]  guard de escenario (§23): un tick tardío no pinta.
 * @param {number}   [o.desde]  instante de inicio del ascendente (serverNow()).
 * @param {()=>void} [o.onFin]  se acabó el tiempo (solo cuenta atrás).
 */
export function montarReloj({ activity, pintar, alive = () => true, desde, onFin } = {}) {
  const nada = { tipo: 'ninguno', stop: () => {} };
  const cfg = relojDe(activity);
  if (typeof pintar !== 'function' || cfg.tipo === 'ninguno') return nada;
  // SIN PANTALLA NO HAY RELOJ QUE PINTAR. Los shells se prueban en Node con
  // raíces de mentira y sin DOM: un intervalo REAL sobre algo que nunca «muere»
  // deja la suite colgada al salir. Ya pasó con el cronómetro del HUD y volvió a
  // pasar al unificar; el guard va aquí, en el dueño del reloj, para no tener
  // que acordarse en cada llamante.
  if (typeof document === 'undefined') return nada;

  if (cfg.tipo === 'cuenta') {
    const total = cfg.segundos;
    const cuenta = createCountdown(total, {
      onTick: (quedan) => { if (alive()) pintar(`⏱ ${Math.max(0, quedan)}`, (Math.max(0, quedan) / total) * 100); },
      onTimeout: () => { if (alive()) onFin?.(); },
    });
    cuenta.start();
    pintar(`⏱ ${total}`, 100);   // el primer número se ve YA, sin esperar un tick
    return { tipo: 'cuenta', stop: () => cuenta.stop() };
  }

  const tick = startElapsedTicker({
    since: desde ?? serverNow(),
    while: alive,
    onTick: ({ label }) => pintar(`⏱ ${label}`, null),
  });
  return { tipo: 'crono', stop: tick.stop };
}
