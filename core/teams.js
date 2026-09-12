// Utilidades compartidas del modo EQUIPOS (Equipos por turnos y Memoria por
// equipos) para no duplicar colores, el color por equipo, los inputs de nombres,
// el marcador de chips ni el podio final.
import { escapeHtml, $, $$ } from './html.js';
import { on } from './events.js';
import { cierreHtml } from './podium.js';
export const TEAM_COLORS = ['danger', 'primary', 'success', 'warning'];
/** Cuántos equipos se pueden elegir en la antesala. Uno solo no es un juego por
 *  turnos y con cinco los nombres no caben en la fila. */
const TEAM_COUNTS = [2, 3, 4];

/** UN equipo, tal y como lo lleva la máquina de equipos.
 *  @typedef {{id: string, name: string, score: number}} Equipo */

/** Color Bootstrap del equipo según su posición en la lista.
 *  @param {string} teamId @param {Equipo[]|null|undefined} teams @returns {string} */
export function teamColor(teamId, teams) {
  const i = (teams || []).findIndex(t => t.id === teamId);
  return TEAM_COLORS[(i < 0 ? 0 : i) % TEAM_COLORS.length];
}

/** HTML de los inputs de nombres de equipo por defecto ("Equipo 1..N").
 *  @param {number} count @returns {string} */
export function teamNameInputsHtml(count) {
  return Array.from({ length: count }, (_, i) => `
      <div class="col-6 col-md-3">
        <input class="form-control text-center border-${TEAM_COLORS[i % TEAM_COLORS.length]}" value="Equipo ${i + 1}" maxlength="14">
      </div>`).join('');
}

/** EL CUERPO DE LA ANTESALA DE EQUIPOS (cuántos equipos + sus nombres).
 *  Estaba tecleado dos veces —Equipos por turnos y Memoria por equipos— y ya
 *  había divergido: en Memoria la botonera marcaba siempre el 2 como activo,
 *  así que volver de una partida a 4 equipos enseñaba «2» resaltado. Cada vista
 *  añade LO SUYO después (puntuación, aviso de nº de preguntas) con `extra`.
 *  @param {{count: number, color?: string, extra?: string}} o @returns {string} */
export function teamsSetupBody({ count, color = 'success', extra = '' }) {
  return `
      <div class="my-3">
        <label class="form-label small text-muted d-block">¿Cuántos equipos?</label>
        <div class="btn-group" role="group" id="teams-count">
          ${TEAM_COUNTS.map(n => `<button class="btn btn-outline-${color} ${n === count ? 'active' : ''}" data-n="${n}">${n}</button>`).join('')}
        </div>
      </div>
      <div id="teams-names" class="row justify-content-center g-2 my-3" style="max-width:560px;margin:auto"></div>${extra}`;
}

/** Cablea la botonera del cuerpo de arriba: pinta los nombres al montar y los
 *  vuelve a pintar (y avisa) al cambiar el número.
 *  @param {string|Element} host @param {number} count
 *  @param {(n: number) => void} [alCambiar] */
export function wireTeamsSetup(host, count, alCambiar) {
  /** @param {number} n */
  const pintarNombres = (n) => {
    const box = $('#teams-names');
    if (box) box.innerHTML = teamNameInputsHtml(n);
  };
  pintarNombres(count);
  on(host, 'click', '#teams-count button', (_, b) => {
    const n = Number(b.dataset.n);
    $$('#teams-count button').forEach(x => x.classList.toggle('active', x === b));
    pintarNombres(n);
    alCambiar?.(n);
  });
}

/** Los nombres TECLEADOS, con el defecto puesto donde el campo quedó vacío.
 *  @returns {string[]} */
export function readTeamNames() {
  return /** @type {HTMLInputElement[]} */ ($$('#teams-names input'))
    .map((el, i) => (el.value || '').trim() || `Equipo ${i + 1}`);
}

/** EL CIERRE de una partida por equipos: el podio compartido (core/podium.js)
 *  con los dos botones que la clase espera —salir y otra vez—, iguales en los
 *  dos juegos por turnos.
 *  @param {{ranked: {name: string, score: number}[], backHref?: string, color?: string}} o
 *  @returns {string} */
export function teamsPodiumHtml({ ranked, backHref, color = 'success' }) {
  return cierreHtml({
    ranked, clase: 'teams-podium text-center',
    acciones: `
      ${backHref ? `<a href="${backHref}" class="btn btn-outline-secondary">Salir</a>` : ''}
      <button class="btn btn-${color} ms-2" id="teams-again"><i class="bi bi-arrow-repeat"></i> Otra vez</button>`,
  });
}

/** Fila de chips del marcador (nombre + puntos, resaltando el turno activo).
 *  Era HTML duplicado entre teamsView y memoryView.
 *  @param {Equipo[]} teams @param {string|null} activeId @param {boolean} [ended]
 *  @returns {string} */
export function teamsScoreboardHtml(teams, activeId, ended) {
  return `
    <div class="teams-scoreboard">
      ${teams.map(t => `
        <div class="teams-chip text-bg-${teamColor(t.id, teams)} ${!ended && t.id === activeId ? 'is-turn' : ''}">
          <span class="teams-chip-name">${escapeHtml(t.name)}</span>
          <span class="teams-chip-score">${t.score}</span>
        </div>`).join('')}
    </div>`;
}

