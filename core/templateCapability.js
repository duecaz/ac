// Predicado COMPARTIDO: "¿esta plantilla puede autopuntuar una ronda?" — hace
// falta scoreSubmission (puntuar) Y renderRound (pintar el ítem sin backend).
//
// Antes vivía triplicado con criterios DISTINTOS: core/modes.js exigía solo
// renderRound, kernel/session/engine.js (createTeamsSession) exigía solo
// scoreSubmission, y views/teamsView.js exigía scoreSubmission+getRoundPayload
// (no renderRound). Con eso, una plantilla como Crucigrama/Ruleta/Abre-Cajas
// (scoreSubmission+getRoundPayload, SIN renderRound) pasaba el check de
// teamsView pero luego `roundBody()` no podía pintar la ronda (exige
// renderRound) → el botón "Revelar" se quedaba deshabilitado para siempre.
// Hoy no es alcanzable (core/modes.js ya oculta "Equipos" para esas plantillas
// antes de llegar a teamsView), pero los tres sitios deben usar el MISMO
// criterio para no volver a desalinearse si el gateo de arriba cambia.
//
// Módulo sin imports (ni de core/ ni de kernel/) a propósito: core/modes.js
// importa kernel/session/engine.js, así que si este predicado viviera en
// cualquiera de los dos, el otro no podría importarlo sin crear un ciclo.
export function canAutoScoreRound(T) {
  return typeof T?.scoreSubmission === 'function' && typeof T?.renderRound === 'function';
}
