// Utilidades compartidas del modo EQUIPOS (Equipos por turnos y Memoria por
// equipos) para no duplicar colores, el color por equipo, los inputs de nombres,
// el marcador de chips ni el podio final.
import { escapeHtml } from './html.js';
export const TEAM_COLORS = ['danger', 'primary', 'success', 'warning'];

/** Color Bootstrap del equipo según su posición en la lista. */
export function teamColor(teamId, teams) {
  const i = (teams || []).findIndex(t => t.id === teamId);
  return TEAM_COLORS[(i < 0 ? 0 : i) % TEAM_COLORS.length];
}

/** HTML de los inputs de nombres de equipo por defecto ("Equipo 1..N"). */
export function teamNameInputsHtml(count) {
  return Array.from({ length: count }, (_, i) => `
      <div class="col-6 col-md-3">
        <input class="form-control text-center border-${TEAM_COLORS[i % TEAM_COLORS.length]}" value="Equipo ${i + 1}" maxlength="14">
      </div>`).join('');
}

/** Fila de chips del marcador (nombre + puntos, resaltando el turno activo).
 *  Era HTML duplicado entre teamsView y memoryView. */
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

