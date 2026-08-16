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

export function montarMarcoJuego(rootSel, activity, { escena = true } = {}) {
  // SIN PROPORCIÓN IMPUESTA (dueño, 2026-08-16: «no fuerces nada, todo es
  // responsive»). Se llegó a escribir aquí la `meta.aspectRatio` de la plantilla
  // para que el marco del alumno se pareciera al del profe; era una medida más
  // que cuadrar contra el alto disponible, y por tanto otra fuente de sobras.
  // Estas páginas EN VIVO son la pantalla entera: el marco llena lo que hay.
  mount(rootSel, html`
    <div class="ww-play-page ww-student-page">
      <div class="ww-player-frame ww-student-frame" id="ww-frame">
        ${fullscreenButtonHtml({ corner: true })}
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
