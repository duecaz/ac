// LOS CLICS DE LA TARJETA, UN DUEÑO (§21b).
//
// El markup de la tarjeta es único desde hace versiones (core/activityCard.js) y
// su CONFIGURACIÓN también (las variantes). Lo que seguía copiado era el TERCER
// trozo: qué pasa al pulsar. Las cinco vistas que listan actividades repetían
// las mismas cuatro líneas —cada una traduciendo a mano una clase (`act-vs`) a
// una ruta (`#/vs/:id`)— y solo "Mis actividades" sabía qué hacer con los modos
// de profe (candado → frase → entrar). Por eso Live y Tarea no podían aparecer
// fuera de "Mis actividades": el botón existiría y no haría nada.
//
// Aquí vive ese comportamiento UNA vez. Una vista que pinte tarjetas llama a
// `wireActivityCard(rootSel)` y ya tiene los cinco modos, con su candado y su
// aviso; lo SUYO (editar, borrar, publicar, likes) lo sigue cableando ella.
//
// Y la RUTA no se escribe aquí: cada botón declara su modo (`data-mode`) y
// `rutaDeModo()` —el dueño de las rutas, core/modes.js— la resuelve. Así un modo
// nuevo no obliga a tocar este fichero. Lo vigila `tests/activityCard.test.mjs`.
import { on } from '../core/events.js';
import { navigate } from '../core/router.js';
import { rutaDeModo } from '../core/modes.js';
import { pedirCuentaParaModo } from './loginModal.js';

/**
 * Cablea los modos de la tarjeta en `rootSel` (delegado, se limpia al cambiar
 * de ruta como todo lo demás — §23).
 */
export function wireActivityCard(rootSel) {
  // El preview clicable es un atajo al modo Individual, no un modo aparte.
  on(rootSel, 'click', '[data-play]', (_, b) => navigate(rutaDeModo('solo', { id: b.dataset.play })));
  // Una lista de actividades no es un modo de `MODE_DEFS`: es su propia ruta.
  on(rootSel, 'click', '[data-mode="list"]', (_, b) => navigate(`#/list/${b.dataset.id}`));
  on(rootSel, 'click', '.act-mode[data-mode]:not([data-mode="list"])', (_, b) => {
    // LA PUERTA SE AVISA ANTES DE CRUZARLA (§22): sin sesión, un modo de profe
    // no navega a una pantalla que va a rebotar — dice por qué y ofrece entrar
    // ahí mismo, con la MISMA frase que usan el botón, el router y la barra de
    // modos del reproductor.
    if (b.dataset.locked) { pedirCuentaParaModo(b.dataset.mode); return; }
    navigate(rutaDeModo(b.dataset.mode, { id: b.dataset.id, template: b.dataset.tpl }));
  });
}

// Aquí estuvo una comprobación de «actividad a medias» antes de lanzar Live o
// Tarea. Se ha ido: solo sabía mirar el almacén de ESTE navegador, así que en la
// portada, la biblioteca o el perfil —el caso que la tarjeta viene a habilitar—
// no se ejecutaba nunca. La puerta de verdad está en la RUTA (`#/launch` y
// `#/tasks` revisan la actividad ya resuelta, local o de la nube, y ofrecen ir a
// editarla), que además cubre el marcador y el botón «atrás». Una puerta que se
// abre o no según dónde viva el JSON es peor que una sola puerta más abajo.