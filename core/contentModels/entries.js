// Content model: a flat list of entries. HUÉRFANO: ninguna plantilla lo declara
// como su `contentModel` hoy (Wheel migró a 'items' en templateVersion 2; "Random
// Cards"/"Flashcards" nunca se construyeron). Sigue registrado en
// kernel/content/models.js por si una plantilla futura lo necesita.
export function newEmpty() { return { entries: ['', '', '', ''] }; }
export function validate(content) {
  const errs = [];
  if (!Array.isArray(content?.entries)) errs.push('entries must be an array');
  return errs;
}
