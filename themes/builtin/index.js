// LOS SIETE SKINS DE FÁBRICA — uno por fichero, y aquí la lista.
//
// Un skin es DATO: un manifiesto de tokens CSS (`cssVars`), con su etiqueta, su
// fondo y, si lo tiene, su hoja propia en `themes/<name>/skin.css`. Vivían los
// siete dentro de `core/skins.js`, que así era a la vez el motor (registrar,
// aplicar, previsualizar) y la paleta entera: 250 de sus 445 líneas eran
// colores. Ahora el motor es el motor y cada tema se lee —y se toca— solo.
//
// Un tema NUEVO: crea `themes/<name>/index.js` (o su fichero aquí), exporta el
// manifiesto y súmalo a la lista de abajo. El contrato (core/skinContract.js)
// exige que declare el set COMPLETO de tokens de `default`, no un subconjunto.
//
// ── TOKEN CONTRACT ────────────────────────────────────────────────────────────
// These are the CSS vars activity stylesheets read. Skins override them.
// All activity CSS defines fallback defaults so a skin only needs to set
// what it actually changes.
//
// EL CONTRATO COMPLETO Y AL DÍA está en `docs/tokens.md` — GENERADO por
// `node tools/tokens.mjs`, con quién declara y quién consume CADA token. Lo que
// sigue es un resumen de orientación, escrito a mano y por tanto sujeto a
// quedarse viejo (lo estuvo: tenía valores por defecto que ya no eran los del
// código). Ante una discrepancia, manda el índice generado.
//
// GLOBAL
//   --ww-bg            page / player background
//   --ww-bg-soft       secondary / soft background
//   --ww-fg            primary text
//   --ww-card-bg       card / panel fill
//   --ww-card-border   card / panel border
//   --ww-accent        brand accent (buttons, links)
//   --ww-shape-1..4    answer option colours (maps to quiz/live)
//   --ww-success       correct answer green
//   --ww-danger        wrong answer red
//   --ww-warning       warning / time-running-out amber
//
// KEYPAD  (math activity) - la fuente es styles/math.css; esto es el indice.
//
//   LA MEDIDA MADRE. El enunciado, el visor y la cifra de una tecla son EL MISMO
//   tamano y salen de UN token. Cambiando `--math-cifra` se reescala toda la
//   calculadora de una vez: es la palanca que un tema quiere el 90 % de las veces.
//   El MODO (VS, Equipos) declara su valor; el TEMA gana por especificidad.
//   `tools/matrix-smoke.mjs` mide los tres RENDERIZADOS y exige que coincidan, asi
//   que un tema que use las escotillas absolutas debe moverlas LAS TRES JUNTAS.
//   --math-cifra       lo que mide una cifra      default: max(1rem, 11cqmin)
//   --math-font        tipografia de la calculadora  default: inherit (la del marco)
//
// LA OPCIÓN DE RESPUESTA (styles/opcion.css) — la pastilla que el alumno pulsa,
// igual en los cinco modos. El tema pide el relieve; no escribe dentro.
//   --opt-border        borde                default: 2px card (solo) / 1px transparente (ronda)
//   --opt-radius        redondeo             default: max(10px, 1.6cqmin)
//   --opt-weight        grosor de la letra   default: 600
//   --opt-shadow        sombra en reposo     default: ninguna
//   --opt-transition    transicion           default: la del modo
//   --opt-hover         transform al pasar   default: translateY(-2px)
//   --opt-hover-filter  filtro al pasar      default: ninguno
//   --opt-shadow-hover  sombra al pasar      default: 0 4px 12px rgba(0,0,0,.1)
//   --opt-press         transform al pulsar  default: como el hover
//   --opt-shadow-active sombra al pulsar     default: como la de reposo
//   --ww-shape-1..4     fondo de cada forma (acepta color O degradado)
//
//   EL ROTULO DEL TEMA sobre el enunciado (arcade pone «SOLVE!»). Sin el primero,
//   el pseudo-elemento no existe y no ocupa un pixel:
//   --math-q-rotulo          texto (`content`)      default: none (no se pinta)
//   --math-q-rotulo-color    su tinta               default: inherit
//   --math-q-rotulo-shadow   su sombra              default: none
//   --math-q-rotulo-size     su tamano              default: .5em
//   --math-head-min    alto de la banda cabecera  default: auto (lo declara el modo)
//   --math-tope        tope de ancho del bloque   default: 75cqh (Individual: 52cqh)
//   --key-size         key font-size              default: var(--math-cifra)
//   --display-size     answer display font-size   default: var(--math-cifra)
//   --math-q-size      question font-size         default: var(--math-cifra)
//
//   --key-bg           key fill                  default: #fff
//   --key-fg           key text                  default: #212529
//   --key-border       key border shorthand       default: 2px solid #ced4da
//   --key-radius       key corner radius          default: .5rem
//   --key-weight       key font-weight            default: 700
//   --key-pad          key padding shorthand      default: 0
//   --key-shadow       key box-shadow             default: none
//   --key-cols         keypad grid columns        default: 3
//   --key-rows         keypad grid rows           default: 4
//   --key-gap          keypad grid gap            default: clamp(.3rem,1.4cqmin,.7rem)
//   --key-ok-bg        submit key fill            default: --ww-success
//   --key-ok-fg        submit key text            default: #fff
//   --key-fn-bg        backspace key fill         default: #f1f3f5
//   --display-bg       answer display fill        default: #fff
//   --display-fg       answer display text        default: #212529
//   --display-border   answer display border      default: 3px solid #dee2e6
//   --display-radius   answer display radius      default: .6rem
//   --display-pad      answer display padding     default: .1rem 1rem
//   --math-q-weight    question font-weight       default: 800
//   --math-q-color     question text color        default: inherit
//   --math-gap         round flex gap             default: clamp(.4rem,2cqmin,1.1rem)
//
// VS LAYOUT (set by vsView on each panel; skins read in skin.css overrides)
//   --panel-bg         device panel fill
//   --panel-glow       device panel box-shadow glow
//   --panel-radius     device panel corner radius
//   --bar-bg           scorebar background
//   --bar-team-l       left team accent colour
//   --bar-team-r       right team accent colour
//   --badge-bg         VS badge fill
// ─────────────────────────────────────────────────────────────────────────────
import { skinDefault } from './default.js';
import { skinClassroom } from './classroom.js';
import { skinVibrante } from './vibrante.js';
import { skinRetro } from './retro.js';
import { skinJungle } from './jungle.js';
import { skinTvShow } from './tv-show.js';
import { skinArcade } from './arcade.js';

/** En este orden se ofrecen al profe. `default` el primero: es el que sirve de
 *  respaldo cuando una actividad pide un skin que ya no existe.
 *  @type {import('../../core/skins.js').Skin[]} */
export const SKINS_DE_FABRICA = [
  skinDefault, skinClassroom, skinVibrante, skinRetro, skinJungle, skinTvShow, skinArcade,
];
