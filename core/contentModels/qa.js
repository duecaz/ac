// Question-Answer content model used by the quiz template.
export function isCorrect(item, value) {
  if (item.answer == null) return null;
  if (Array.isArray(item.answer)) return item.answer.map(s => norm(s)).includes(norm(value));
  return norm(item.answer) === norm(value);
}
function norm(s) {
  return String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
}
