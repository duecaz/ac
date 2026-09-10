// Editor de Comas: pega el texto CON comas; la app las quita y guarda las
// posiciones. Wrapper de core/textCorrectionEditor.js (§21b: era el mismo
// editor que Tildes, tecleado dos veces — solo cambia el parser y los textos).
import { parseTextWithCommas } from '../../core/textMarks.js';
import { renderTextCorrectionEditor } from '../../core/textCorrectionEditor.js';

/**
 * @param {Element} root
 * @param {import('../../kernel/contracts/activity.js').Activity} activity
 * @param {(activity: import('../../kernel/contracts/activity.js').Activity) => void} onChange
 */
export function renderComasEditor(root, activity, onChange) {
  renderTextCorrectionEditor(root, activity, (a) => onChange(
    /** @type {import('../../kernel/contracts/activity.js').Activity} */ (a)
  ), {
    kind: 'coma',
    parse: parseTextWithCommas,
    textos: {
      instrucciones: 'Escribe la frase <b>con sus comas</b>. La app las quita y guarda dónde van.',
      placeholder: 'ej. Hola, ¿cómo estás?',
    },
  });
}
