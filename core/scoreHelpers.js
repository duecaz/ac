// Convenciones de puntuación compartidas por TODOS los scorers de plantilla.
// Antes cada scorer reimplementaba estas mismas líneas (`item.points ||
// scoring.pointsPerCorrect || 1`, el suelo de puntos por fallo, y el dispatch
// Kahoot solo/live). Centralizado aquí para una sola fuente de verdad.

// Puntos base de un acierto: los del ítem, si no los de la config, si no 1.
export function basePoints(item, scoring) {
  return item?.points || scoring?.pointsPerCorrect || 1;
}

// Puntos de un fallo: 0 salvo que se configure una penalización (negativa).
export function wrongPoints(scoring) {
  const ppw = scoring?.pointsPerWrong ?? 0;
  return ppw < 0 ? ppw : 0;
}

// ¿Puntuación estilo Kahoot (con bonus por velocidad)? En vivo manda
// live.pointsModel; en solo, el modo avanzado scoring.mode.
export function useKahoot(mode, scoring, live) {
  return (mode === 'live' && live?.pointsModel === 'kahoot')
      || (mode === 'solo' && scoring?.mode === 'kahoot');
}
