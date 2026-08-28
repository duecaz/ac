// Los cuatro formatos de sesión — un dueño único para que el despachador
// (createSession) y quien lo consume (kernel/live/engine.js, las vistas de
// modo) usen el MISMO valor.
//
// v1.51.630: separado de kernel/session/engine.js al partir el motor POR
// MÁQUINA (docs/leyes.md §0, deuda condicionada). Cada máquina (liveMachine.js,
// teamsMachine.js, vsMachine.js) sella `state.format` con esta constante — si
// viviera solo en engine.js, importarla desde una máquina crearía un ciclo
// máquina→fachada→máquina. engine.js re-exporta FORMATS desde aquí para que
// los importadores actuales (que esperan `from '.../session/engine.js'`) no
// se enteren del corte.
export const FORMATS = Object.freeze({ SOLO: 'solo', LIVE: 'live', TEAMS: 'teams', VS: 'vs' });
