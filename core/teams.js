// Utilidades compartidas del modo EQUIPOS (Equipos por turnos y Memoria por
// equipos) para no duplicar colores, el color por equipo ni los inputs de nombres.
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
