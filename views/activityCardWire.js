// LOS CLICS DE LA TARJETA, UN DUEÑO (§21b).
//
// El markup de la tarjeta es único desde hace versiones (core/activityCard.js) y
// su CONFIGURACIÓN también (las variantes). Lo que seguía copiado era el TERCER
// trozo: qué pasa al pulsar. Las cinco vistas que listan actividades repetían
// las mismas cuatro líneas (`.act-play` → #/play, `.act-vs` → #/vs, `.act-teams`
// → rutaDeModo, `[data-play]` → #/play) y solo "Mis actividades" sabía qué hacer
// con los modos de profe (candado → frase → entrar). Por eso Live y Tarea no
// podían aparecer fuera de "Mis actividades": el botón existiría y no haría nada.
//
// Aquí vive ese comportamiento UNA vez. Una vista que pinte tarjetas llama a
// `wireActivityCard(rootSel)` y ya tiene los cinco modos, con su candado y su
// aviso; lo SUYO (editar, borrar, publicar, likes propios) lo sigue cableando
// ella. Lo vigila `tests/activityCard.test.mjs`.
import { on } from '../core/events.js';
import { navigate } from '../core/router.js';
import { rutaDeModo, modeAuthHint } from '../core/modes.js';
import { toast } from '../core/toast.js';
import { get } from '../core/storage.js';
import { revisarActividad } from '../core/activityCheck.js';
import { openLoginModal } from './loginModal.js';

/**
 * Cablea los modos de la tarjeta en `rootSel` (delegado, se limpia al cambiar
 * de ruta como todo lo demás — §23).
 */
export function wireActivityCard(rootSel) {
  // Jugar: el preview clicable y el botón Individual llevan al mismo sitio.
  on(rootSel, 'click', '[data-play]', (_, b) => navigate(`#/play/${b.dataset.play}`));
  on(rootSel, 'click', '.act-play', (_, b) => navigate(`#/play/${b.dataset.id}`));
  on(rootSel, 'click', '.act-vs', (_, b) => navigate(`#/vs/${b.dataset.id}`));
  on(rootSel, 'click', '.act-teams', (_, b) => navigate(rutaDeModo('teams', { id: b.dataset.id, template: b.dataset.tpl })));
  on(rootSel, 'click', '.act-list', (_, b) => navigate(`#/list/${b.dataset.id}`));

  // MODOS DE PROFE. Dos puertas, en este orden:
  //  1. sin sesión → se DICE por qué (la frase sale de core/modes.js, una sola
  //     redacción) y se ofrece entrar ahí mismo; nunca navegar a una pantalla
  //     que va a rebotar (§22: avisar ANTES);
  //  2. actividad a medias → no se lleva a la clase. Solo se puede comprobar lo
  //     que está en este navegador; para lo de la biblioteca la puerta de verdad
  //     está en la RUTA (#/launch y #/tasks revisan igual), que además cubre el
  //     marcador y el botón «atrás».
  const hostClick = (mode, go) => (_, b) => {
    if (b.dataset.locked) {
      const hint = modeAuthHint(mode);
      toast(hint + '. Los alumnos NO necesitan cuenta.', 'info', 5000);
      openLoginModal({ reason: hint });
      return;
    }
    const id = b.dataset.id;
    const local = get(id);
    if (local) {
      const rev = revisarActividad(local);
      if (!rev.jugable) {
        toast(`«${local.title || 'Esta actividad'}» aún no se puede lanzar: ${rev.problemasDeJuego[0]}`, 'danger', 6000);
        navigate(`#/edit/${id}`);
        return;
      }
    }
    go(id);
  };
  on(rootSel, 'click', '.act-pin', hostClick('live', id => navigate(`#/launch/${id}`)));
  on(rootSel, 'click', '.act-task', hostClick('task', id => navigate(`#/tasks/${id}`)));
}
