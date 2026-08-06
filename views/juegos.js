// LA ESTANTERÍA DE JUEGOS (norte §4c/§7c) — la tercera entrada del menú.
//
// Los juegos son la familia SIN contenido del docente: la plantilla genera el
// tablero, así que no se crean, no se publican y no piden cuenta. No caben en
// "crear una actividad" y por eso tienen estantería propia DENTRO del catálogo
// del profe — no una sección para alumnos (§7c: quien los lanza es el profe, en
// su clase, para los cinco minutos de cambio de ritmo).
//
// La vista no conoce ningún juego por nombre: lista lo que declare
// `meta.kind: 'juego'` (contrato §4c), con su HABILIDAD como subtítulo. Un juego
// nuevo aparece aquí solo. El catálogo está acotado en OCHO (norte §4c) y eso lo
// vigila `tests/kind.test.mjs`, no esta vista.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { navigate } from '../core/router.js';
import { listTemplates } from '../core/registry.js';
import { newActivity } from '../core/migrate.js';
import { get, save } from '../core/storage.js';

/** Los juegos instalados, del registro (nunca cableados aquí). */
export function gameTemplates() {
  return listTemplates().filter(T => T.meta?.kind === 'juego');
}

// El juego se juega sobre una actividad LOCAL fija por plantilla (`game_<name>`):
// se crea la primera vez con el contenido por defecto y se reutiliza — el juego
// es UNO (§4c), no una actividad que el profe colecciona.
function gameActivityId(name) { return `game_${name}`; }

export function renderJuegos(rootSel) {
  const juegos = gameTemplates();
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
          ${juegos.map(T => `
            <article class="acard juego-card" data-game="${escapeHtml(T.meta.name)}" role="button" tabindex="0">
              <div class="acard-preview juego-card__pv">
                <div class="juego-card__icon"><i class="bi ${escapeHtml(T.meta.icon || 'bi-controller')}"></i></div>
              </div>
              <div class="acard-body">
                <div class="acard-toprow">
                  <span class="tag tag--${escapeHtml(T.meta.color || 'info')}"><i class="bi bi-controller"></i> ${escapeHtml(T.meta.skill || 'Juego')}</span>
                </div>
                <h3 class="acard-title">${escapeHtml(T.meta.label)}</h3>
                <p class="acard-sub">${escapeHtml(T.meta.instructions || '')}</p>
                <button class="btn-primary-solid w-100 juego-play" data-game="${escapeHtml(T.meta.name)}">
                  <i class="bi bi-play-fill"></i> Jugar
                </button>
              </div>
            </article>`).join('')}
        </div>` : `
        <div class="home-empty"><i class="bi bi-controller"></i><p>Aún no hay juegos instalados.</p></div>`}
      <p class="text-muted small mt-4" style="max-width:640px">
        Los juegos no llevan contenido tuyo: no se editan, no se publican y no se
        mandan como tarea. Para ejercicios con tu tema,
        <a href="#/mine">tus actividades</a> o la <a href="#/explore">biblioteca</a>.
      </p>
    </div>
  `);

  const play = (name, mode = '') => {
    const T = gameTemplates().find(x => x.meta.name === name);
    if (!T) return;
    const id = gameActivityId(name);
    if (!get(id)) {
      const a = newActivity(name);
      a.id = id;
      a.title = T.meta.label;
      save(a);
    }
    navigate(`#/${mode || 'play'}/${id}`);
  };
  on(rootSel, 'click', '.juego-play', (e, b) => { e.stopPropagation(); play(b.dataset.game); });
  on(rootSel, 'click', '.juego-card', (_, c) => play(c.dataset.game));
}
