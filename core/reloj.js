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
//   · sin límite → CRONÓMETRO ascendente;
//   · y en las que no miden nada (Ruleta, Pedir la palabra, Ordena las Pelotas,
//     que lleva su propio tiempo en el tablero) → NINGUNO.
// Nunca los dos a la vez: es UN reloj, con dos formas de contar. El editor tenía
// dos mandos —el número y una casilla «Mostrar cronómetro» marcada y en gris— y
// eso se lee como «hay dos relojes» (dueño, 2026-09-02: «¿dos relojes a la vez?
// no debe existir otro reloj»). Ahora es UN mando: los segundos. Con 0, el
// cronómetro; con un número, la cuenta atrás.
//
// DÓNDE se pinta NO lo decide el reloj: se lo dan (`pintar`). El chip del HUD y
// la barra de Tildes/Comas son dos sitios distintos para el mismo dato, y por
// eso el módulo no sabe de DOM.
//
// Debajo usa los primitivos de §23 —`createCountdown` para la duración y
// `startElapsedTicker` para el ascendente—: no inventa un tercer reloj, los
// ORDENA. Y `serverNow()` para el ascendente, que es contra el reloj que mide
// ese primitivo (§22-5).
import { getTemplate } from './registry.js';
import { createCountdown } from './soloTimer.js';
import { startElapsedTicker } from './deadlineTicker.js';
import { serverNow } from './serverNow.js';
import { GameEvents, emitGame } from './gameEvents.js';

/** QUÉ RELOJ LE TOCA a esta actividad, sin montar nada. Lo preguntan el editor
 *  (para ofrecer el campo correcto), las vistas y los tests.
 *  La PLANTILLA se resuelve aquí para que ningún llamante tenga que acordarse:
 *  su declaración (`meta.play.reloj`) la obedecía SOLO el editor —pintaba o no
 *  la casilla— y el juego ni la preguntaba, así que la Ruleta y las Pelotas
 *  decían «yo no llevo reloj» y salían con su cronómetro igual. Una declaración
 *  que nadie obedece es peor que no tenerla. */
export function relojDe(activity, T = getTemplate(activity?.template)) {
  const limite = Math.max(0, Number(activity?.rules?.timer) || 0);
  if (limite > 0) return { tipo: 'cuenta', segundos: limite };
  if (!admiteCrono(T)) return { tipo: 'ninguno', segundos: 0 };
  return { tipo: 'crono', segundos: 0 };
}

/** ¿Esta PLANTILLA admite cuenta atrás? Lo DECLARA ella (`meta.play.reloj`), y
 *  la unidad es su palabra: «pregunta», «frase», «sopa», «partida», «crucigrama».
 *  Sin unidad no hay cuenta atrás — la Ruleta y Pedir la palabra no miden nada.
 *
 *  CUÁNTO por defecto (dueño 2026-09-01: «es 30 segundos por default»): la
 *  unidad manda. Donde la unidad es UN ítem —pregunta, operación, frase— son
 *  30 s, y ahí la orden se aplica literal. Donde la unidad es el TABLERO
 *  ENTERO en una sola pantalla, 30 s dejarían el juego sin jugar, así que el
 *  defecto es proporcional al trabajo que hay en pantalla: diagrama y
 *  emparejar 120 s, memoria 180 s, sopa y crucigrama 300 s. Es un DEFECTO, no
 *  un techo: el bloque «Tiempo» del editor lo cambia, y 0 sigue significando
 *  «sin límite» (entonces sale el cronómetro). */
export function unidadDeCuenta(T) {
  const u = T?.meta?.play?.reloj?.unidad;
  return typeof u === 'string' && u ? u : null;
}

/** ¿Y cronómetro? Por defecto sí: es información sin coste. Una plantilla puede
 *  decir que no (`reloj: { crono: false }`) si su mecánica ya lleva su tiempo a
 *  la vista (Ordena las Pelotas) o si no mide nada (Ruleta, Pedir la palabra).
 *  Lo decide la PLANTILLA, no el que prepara la clase: no es una preferencia,
 *  es si ese juego tiene algo que cronometrar.
 *  INTERNA a propósito: la pregunta que se hace fuera es «¿qué reloj le toca a
 *  esta actividad?» (`relojDe`), no «¿admite cronómetro?». Cuando la exportaba,
 *  el editor la usaba para pintar una casilla y el juego no la miraba — así se
 *  quedó la Ruleta declarando que no lleva reloj y saliendo con cronómetro. */
function admiteCrono(T) {
  return T?.meta?.play?.reloj?.crono !== false;
}

/**
 * Monta el reloj que toque y devuelve `{ tipo, stop }`.
 * @param {object}   o
 * @param {object}   o.activity  de aquí sale QUÉ reloj (rules.timer + la plantilla).
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
    // TIC-TAC en los últimos segundos. `core/sounds.js` llevaba desde el
    // principio un oyente de `GameEvents.TICK` (play('tick')) y NADIE lo emitía
    // (barrido B4, 2026-09-02): el sonido existía, cargado y mudo. Lo emite el
    // dueño del reloj, que es el único que sabe cuánto queda, y solo en la
    // cuenta atrás: un cronómetro ascendente no apremia a nadie.
    const TIC_DESDE = 5;
    const cuenta = createCountdown(total, {
      onTick: (quedan) => {
        if (!alive()) return;
        const q = Math.max(0, quedan);
        pintar(`⏱ ${q}`, (q / total) * 100);
        if (q > 0 && q <= TIC_DESDE) emitGame(GameEvents.TICK, { remainSec: q });
      },
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
