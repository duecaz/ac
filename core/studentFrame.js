// EL MARCO DEL ALUMNO — el mismo marco de juego que ya tiene el profe, para las
// páginas del móvil (en vivo y tarea).
//
// El hallazgo del dueño (2026-08-14): «el alumno no tiene player ni botón de
// fullscreen». Era verdad: las pantallas del alumno se pintaban a página
// desnuda — sin marco, sin esquina de pantalla completa, sin el andamio
// responsive de `.ww-player-frame`. Solo el lobby tenía un botoncito suelto.
//
// La decisión es NO hacer «otro player para él»: el marco ya existe y la
// esquina superior derecha ES del marco (estándar transversal). Un segundo
// player sería otra copia que diverge — la enfermedad que esta misma semana
// costó siete mandos muertos y siete definiciones de «pareja jugable».
//
// Qué da este módulo:
//   · el marco `.ww-player-frame` con su esquina de pantalla completa
//     (`.ww-fs-btn--corner`, la misma pieza y el mismo cableado que el profe);
//   · el TEMA y el FONDO de la actividad, aplicados al marco: el snapshot de la
//     sala ya viaja con `presentation`, así que el móvil se ve como la pizarra;
//   · un ESCENARIO (`#s-stage`) donde la vista pinta sus fases. El marco vive
//     FUERA del escenario: los `mount()` de cada fase no se lo llevan por
//     delante, y el botón sobrevive de la primera pantalla al podio.
//
// La vista llama a `montarMarcoAlumno(rootSel, activity)` UNA vez y a partir de
// ahí monta todo en el selector que se le devuelve.
import { html, mount } from './html.js';
import { fullscreenButtonHtml, attachFullscreenButton } from './fullscreen.js';
import { applySkin } from './skins.js';
import { applyBackground } from './backgrounds.js';
import { getTemplate } from './registry.js';

export function montarMarcoAlumno(rootSel, activity) {
  // LA PROPORCIÓN, DEL MISMO SITIO QUE EN EL PROFE. La declara la plantilla
  // (`meta.aspectRatio`) y `views/playerView.js` la escribe igual; aquí viaja
  // como `--ww-ar` y solo la usa el CSS a partir de 900px de ancho (en vertical
  // el marco ES la pantalla). Sin esto el marco del alumno no tenía proporción
  // ninguna y lo que se veía era casualidad del respaldo.
  const ar = getTemplate(activity?.template)?.meta?.aspectRatio;
  const estilo = ar && ar !== 'auto' ? ` style="--ww-ar: ${ar}"` : '';
  mount(rootSel, html`
    <div class="ww-play-page ww-student-page">
      <div class="ww-player-frame ww-student-frame" id="ww-frame"${estilo}>
        ${fullscreenButtonHtml({ corner: true })}
        <div id="s-stage" class="ww-student-stage"></div>
      </div>
    </div>
  `);
  const frame = document.getElementById('ww-frame');
  // El tema y el fondo del PROFE, también en el móvil. Ámbito: el marco, nunca
  // <body> (un tema global se quedaría pegado a la vista siguiente, §23).
  applySkin(activity?.presentation?.skin || 'default', frame);
  applyBackground(activity?.presentation?.background || 'none', frame,
    activity?.presentation?.backgroundImage || null);
  const soltar = attachFullscreenButton(frame, { target: frame });
  return { stageSel: '#s-stage', frame, dispose: soltar };
}
