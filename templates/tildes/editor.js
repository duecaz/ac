// Editor de Tildes: escribe CON tildes; la app las quita y guarda dónde van.
// Wrapper de core/textCorrectionEditor.js (§21b: era el mismo editor que
// Comas, tecleado dos veces — solo cambia el parser y los textos).
import { parseAccentedText } from '../../core/textMarks.js';
import { renderTextCorrectionEditor } from '../../core/textCorrectionEditor.js';

export function renderTildesEditor(root, activity, onChange) {
  renderTextCorrectionEditor(root, activity, onChange, {
    kind: 'tilde',
    parse: parseAccentedText,
    textos: {
      instrucciones: 'Escribe el texto SIN tildes. Después haz clic en cada vocal que debería llevar tilde.',
      labelTextarea: 'Escribe la frase <b>con tildes</b>. La app las quita automáticamente y guarda dónde van.',
      placeholder: 'ej. canción popular',
    },
  });
}
