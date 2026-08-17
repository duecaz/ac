// EL MARCO DE JUEGO de las páginas EN VIVO — la del alumno y la del docente.
//
// Nació como «el marco del alumno» (hallazgo del dueño, 2026-08-14: «el alumno
// no tiene player ni botón de fullscreen»): sus pantallas se pintaban a página
// desnuda, sin marco, sin esquina de pantalla completa y sin el andamio
// responsive de `.ww-player-frame`.
//
// Un día después apareció el mismo agujero en el OTRO lado (2026-08-15, con
// captura): «la página del docente tiene el fondo de la actividad, ¿por qué?».
// La vista del profe aplicaba el tema y el fondo al `<body>`, así que el
// cuaderno de la actividad se pintaba por toda la web —barra incluida— y el
// juego no tenía caja: el contenido de la carrera quedaba arriba y debajo un
// campo de renglones hasta el final del scroll. Es EL MISMO fallo que se cerró
// en el alumno, en la vista que se proyecta en la pared del aula.
//
// Por eso este módulo dejó de llamarse «del alumno». La decisión sigue siendo NO
// hacer un player por público: el marco ya existe y la esquina superior derecha
// ES del marco (estándar transversal). Un segundo player sería otra copia que
// diverge — la enfermedad que esta semana costó siete mandos muertos y siete
// definiciones de «pareja jugable».
//
// Qué da este módulo:
//   · el marco `.ww-player-frame` con su esquina de pantalla completa
//     (`.ww-fs-btn--corner`, la misma pieza y el mismo cableado que el profe);
//   · un ESCENARIO (`#s-stage`) donde la vista pinta sus fases. El marco vive
//     FUERA del escenario: los `mount()` de cada fase no se lo llevan por
//     delante, y el botón sobrevive de la primera pantalla al podio.
//
// El TEMA y el FONDO no se aplican aquí: los pone la vista sobre `frame`, porque
// en vivo el fondo es POR FASE (juego sí, lobby/podio no — `sceneToggle`). El
// alumno los quería desde el primer pintado y por eso pasa `escena: true`.
//
// La vista llama a `montarMarcoJuego(rootSel, activity)` UNA vez y a partir de
// ahí monta todo en el selector que se le devuelve.
import { html, mount } from './html.js';
import { fullscreenButtonHtml, attachFullscreenButton } from './fullscreen.js';
import { applySkin } from './skins.js';
import { applyBackground } from './backgrounds.js';
import { aspectoDe, aspectStyle } from './frameAspect.js';

// `caja`: si la superficie es un MARCO con forma (proporción, esquinas, sombra)
// o solo un ÁMBITO. El alumno quiere caja — el juego es una cosa dentro de una
// página, y con 4:3 se dimensiona sola. El docente NO: sus pantallas tienen
// alturas muy distintas (el lobby lleva «Únete en…», el PIN y un QR; la carrera,
// tres líneas) y encerrarlas en una proporción CORTA lo que sobra — con el QR a
// medias nadie entra a la sala (dueño, 2026-08-16, con captura). Ahí la
// superficie solo sirve para UNA cosa que sí hace falta: acotar el fondo, que si
// no se va al <body> y pinta la web entera. El botón de pantalla completa NO lo
// pone: las pantallas del docente ya traen el suyo (cada `paint*` de hostLive lo
// pinta en su barra), y añadir la esquina del marco dejaba DOS botones visibles,
// con el de la fase debajo del de la esquina por z-index.
export function montarMarcoJuego(rootSel, activity, { escena = true, caja = true } = {}) {
  // UNA PROPORCIÓN, Y EL RESTO LO HACE PANTALLA COMPLETA (dueño, 2026-08-16).
  // Esto NO es una medida más: es dejar de tener las mías. La pantalla del
  // alumno intentaba LLENAR la ventana, y para eso hacía falta saber cuánto mide
  // —100dvh, menos la barra, menos las barras de desplazamiento…— y cada resta
  // fallaba en algún aparato. Con una proporción, el marco es un elemento normal
  // en una página normal: el mismo `.ww-play-page .ww-player-frame` que el profe
  // usa desde el principio, con sus reglas y sin una línea de alto propia.
  //
  // Y la proporción es la que DECLARA LA PLANTILLA, la misma que ve el profe
  // (core/frameAspect.js). Estuvo un 4:3 escrito aquí a mano: servía para la
  // tarea, pero dejaba al alumno con otra forma que a su profesor en 11 de las
  // 13 — y la Ruleta, que pide un cuadrado, jugándose en un rectángulo.
  const estilo = aspectStyle(aspectoDe(activity));
  mount(rootSel, html`
    <div class="ww-play-page">
      <div class="ww-player-frame ww-student-frame${caja ? '' : ' ww-frame--libre'}" id="ww-frame"${caja ? ` style="${estilo}"` : ''}>
        ${caja ? fullscreenButtonHtml({ corner: true }) : ''}
        <div id="s-stage" class="ww-student-stage"></div>
      </div>
    </div>
  `);
  const frame = document.getElementById('ww-frame');
  if (escena) {
    // Ámbito: el marco, NUNCA <body> (un tema global se queda pegado a la vista
    // siguiente, §23 — y es lo que pintaba la web entera de cuaderno).
    applySkin(activity?.presentation?.skin || 'default', frame);
    applyBackground(activity?.presentation?.background || 'none', frame,
      activity?.presentation?.backgroundImage || null);
  }
  const soltar = attachFullscreenButton(frame, { target: frame });
  return { stageSel: '#s-stage', frame, dispose: soltar };
}
