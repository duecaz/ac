// LA ESTANTERÍA DE JUEGOS (norte §4c/§7c) — la tercera entrada del menú.
//
// Los juegos son la familia SIN contenido del docente: la plantilla genera el
// tablero, así que no se crean, no se publican y no piden cuenta. No caben en
// "crear una actividad" y por eso tienen estantería propia DENTRO del catálogo
// del profe — no una sección para alumnos (§7c: quien los lanza es el profe, en
// su clase, para los cinco minutos de cambio de ritmo).
//
// La vista NO pinta tarjetas propias: usa LA TARJETA ÚNICA (core/activityCard.js,
// variante 'library'), que es la que ya sabe dibujar el preview real del tablero
// y decide que un juego se presenta por su HABILIDAD. Aquí solo se decide QUÉ se
// lista (kind 'juego', del registro) y el pie ("Jugar"). Un juego nuevo aparece
// solo; el techo de OCHO lo vigila `tests/kind.test.mjs`.
import { html, mount } from '../core/html.js';
import { listTemplates } from '../core/registry.js';
import { newActivity } from '../core/migrate.js';
import { get, save } from '../core/storage.js';
import { activityCardHtml } from '../core/activityCard.js';
import { canHost } from '../core/authGate.js';
import { wireActivityCard } from './activityCardWire.js';

/** Los juegos instalados, del registro (nunca cableados aquí). */
export function gameTemplates() {
  return listTemplates().filter(T => T.meta?.kind === 'juego');
}

// Cada juego vive sobre UNA actividad local fija (`game_<name>`): se crea la
// primera vez con el contenido por defecto y se reutiliza — el juego es UNO
// (§4c), no algo que el profe colecciona.
function ensureGameActivity(T) {
  const id = `game_${T.meta.name}`;
  const existente = get(id);
  if (existente) return existente;
  const a = newActivity(T.meta.name);
  a.id = id;
  a.title = T.meta.label;
  save(a);
  return a;
}

export function renderJuegos(rootSel) {
  const juegos = gameTemplates();
  // Una vez por pintada, no por tarjeta (ver explore.js).
  const authed = canHost();
  mount(rootSel, html`
    <div class="home-wrap">
      <div class="home-head">
        <div>
          <h1><i class="bi bi-controller"></i> Juegos</h1>
          <p>Listos para la pizarra, sin preparar nada: el cambio de ritmo, el premio,
             el reto entre dos. Se ordenan por la habilidad que entrenan.</p>
        </div>
      </div>
      ${juegos.length ? `
        <div class="home-grid">
          ${juegos.map(T => {
            const a = ensureGameActivity(T);
            return activityCardHtml(a, { variant: 'library', authed });
          }).join('')}
        </div>` : `
        <div class="home-empty"><i class="bi bi-controller"></i><p>Aún no hay juegos instalados.</p></div>`}
      <p class="text-muted small mt-4" style="max-width:640px">
        Los juegos no llevan contenido tuyo: no se editan, no se publican y no se
        mandan como tarea. Para ejercicios con tu tema,
        <a href="#/mine">tus actividades</a> o la <a href="#/explore">biblioteca</a>.
      </p>
    </div>
  `);

  wireActivityCard(rootSel);
}
