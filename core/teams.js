// Utilidades compartidas del modo EQUIPOS (Equipos por turnos y Memoria por
// equipos) para no duplicar colores, el color por equipo, los inputs de nombres,
// el marcador de chips ni el podio final.
import { escapeHtml } from './html.js';
import { podiumHtml } from './podium.js';
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

/** Podio del final de partida por equipos (trofeo + empate + barras + ranking).
 *  `actionsHtml` añade los botones propios de cada vista (Salir / Otra vez).
 *  Era HTML duplicado entre teamsView y memoryView. */
export function teamsPodiumHtml(lb, { actionsHtml = '' } = {}) {
  const top = lb[0];
  const tie = lb.length > 1 && lb[1].score === top.score;
  const ranked = lb.map(t => ({ name: t.name, score: t.score }));
  return `
    <div class="teams-podium text-center">
      <h2 class="mb-3"><i class="bi bi-trophy-fill text-warning"></i> ${tie ? '¡Empate!' : `🏆 ¡${escapeHtml(top.name)} gana!`}</h2>
      ${podiumHtml(ranked)}
      ${lb.length > 3 ? `<div class="teams-ranking mt-3">${lb.slice(3).map(t => `<div class="d-flex justify-content-between teams-rank-row"><span>${t.rank}. ${escapeHtml(t.name)}</span><b>${t.score}</b></div>`).join('')}</div>` : ''}
      ${actionsHtml}
    </div>`;
}

