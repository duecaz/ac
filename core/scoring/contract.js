// CONTRATO del resultado de scoreSubmission (docs/handoff-puntuacion.md §3):
//
//   { hits, total,     ← MÉRITO (obligatorio): partes acertadas / partes del ítem.
//                        Binarias: 1/1 ó 0/1. Tildes: 3/8. total=0 = "este ítem
//                        no se auto-puntúa" (wheel/question-live: puntúa el profe).
//     correct,         ← veredicto para UI (✓/✗). null = no puntuable.
//     points,          ← puntos de RANKING (escala del helper común award.js).
//     over?, perfect?  ← calidad (marcas de más / impecable), opcionales. }
//
// normalizeScore() rellena lo que un scorer viejo no dé: mérito binario derivado
// de `correct`. Permite que TODA vista (tabla, heatmap, CSV) lea hits/total sin
// ramas por plantilla. Lo exige tests/templateContract.test.mjs.
export function normalizeScore(r) {
  if (!r || typeof r !== 'object') return { correct: null, points: 0, hits: 0, total: 0 };
  const total = Number.isFinite(r.total) ? r.total : 1;
  const hits = Number.isFinite(r.hits) ? r.hits : (r.correct === true ? 1 : 0);
  return { ...r, correct: r.correct ?? null, points: r.points || 0, hits, total };
}
