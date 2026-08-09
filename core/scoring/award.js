// PUNTOS (ranking) — la ÚNICA fórmula que convierte mérito en puntos, compartida
// por todos los scorers (antes en core/scoreHelpers.js, ya retirado). Ver
// docs/historico/handoff-puntuacion.md: la PLANTILLA decide el MÉRITO (hits/total), este
// módulo decide los PUNTOS.

import { itemWindowMs } from '../timings.js';

// Puntos base de un acierto: los del ítem, si no los de la config, si no 1.
export function basePoints(item, scoring) {
  return item?.points || scoring?.pointsPerCorrect || 1;
}

// Techo POR DEFECTO de una actividad cuando la plantilla no deriva uno propio
// del scorer: el máximo declarado, o "un acierto por ítem". Vive aquí para que
// numerador y denominador del "X / max" salgan del mismo sitio — antes esta
// misma fórmula estaba copiada en el shell solo y en la vista de Tarea, y podían
// dar denominadores distintos para el mismo intento.
export function defaultMaxScore(activity, itemCount) {
  return activity?.scoring?.maxScore || ((activity?.scoring?.pointsPerCorrect || 1) * (itemCount || 0));
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
    // La ventana es la DEL ÍTEM (R-3): con tiempo por pregunta, dividir por la
    // ventana de la actividad daría un bonus mal calculado en silencio — de más
    // en las preguntas largas y de menos en las cortas.
    const remain = Math.max(0, 1 - (msTaken || 0) / itemWindowMs(activity, item));
    return Math.round(base * 500 + (live.speedBonusMax ?? 1000) * remain);
  }
  return base;
}
