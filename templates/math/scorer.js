// Numeric scorer for the Operaciones template. Same shape as the other scorers.
// Mérito binario (hits/total; total 0 = sin clave de respuesta → no puntuable).
// P5 (docs/historico/handoff-puntuacion.md): puntos por la fórmula común awardPoints —
// plano por defecto, y en VIVO con el mismo bonus de velocidad que quiz
// (antes math pagaba 1 punto plano en live mientras quiz pagaba ~1500: escalas
// incomparables en la misma sesión de clase).
import { awardPoints } from '../../core/scoring/index.js';

function normNum(s) { return String(s ?? '').trim().replace(',', '.'); }

export function scoreMathSubmission({ value, item, msTaken, activity, mode = 'solo' }) {
  if (item.answer == null || item.answer === '') return { correct: null, points: 0, hits: 0, total: 0 };
  const v = normNum(value), a = normNum(item.answer);
  const ok = v !== '' && !Number.isNaN(Number(v)) && Number(v) === Number(a);
  const points = awardPoints({ correct: ok, item, msTaken, activity, mode });
  return { correct: ok, points, hits: ok ? 1 : 0, total: 1 };
}
