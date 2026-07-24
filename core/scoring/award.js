// PUNTOS (ranking) — la ÚNICA fórmula que convierte mérito en puntos, compartida
// por todos los scorers (antes en core/scoreHelpers.js, ya retirado). Ver
// docs/handoff-puntuacion.md: la PLANTILLA decide el MÉRITO (hits/total), este
// módulo decide los PUNTOS.

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

// Fórmula ÚNICA de puntos para un acierto binario: plana o Kahoot (base×500 +
// bonus por velocidad restante). Es LA implementación oficial — ninguna
// plantilla debe re-escribir su propio bonus de velocidad (deuda D del handoff:
// wordsearch aún tiene uno propio; migrarlo es la fase P5, cambia puntajes).
export function awardPoints({ correct, item, msTaken, activity, mode = 'solo' }) {
  const scoring = activity?.scoring || {};
  if (correct === null) return 0;
  if (!correct) return wrongPoints(scoring);
  const base = basePoints(item, scoring);
  if (useKahoot(mode, scoring, activity?.live)) {
    const live = activity?.live || {};
    const max = (live.questionTimer || 20) * 1000;
    const remain = Math.max(0, 1 - (msTaken || 0) / max);
    return Math.round(base * 500 + (live.speedBonusMax ?? 1000) * remain);
  }
  return base;
}
