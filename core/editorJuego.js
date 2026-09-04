// EL EDITOR DE UN JUEGO — uno para Pelotas, Colorear, Tangram y Rompecabezas.
//
// Un juego (norte §4c) no tiene contenido del docente: su «editor» son los
// AJUSTES DEL JUEGO (qué dibujo, qué figura, cuántas piezas) sobre el andamio
// común `renderEditorShell`, con una sola pestaña. Los tres juegos de inicial
// nacieron copiando el wrapper de Pelotas línea por línea — B5 los cazó al
// 100 % de parecido el día que se escribieron (2026-09-04). La misma función
// escrita cuatro veces acaba diciendo cuatro cosas: aquí vive una.
import { renderEditorShell } from './editorShell.js';

/**
 * @param {Function} asegurar   `ensureContent` del juego: deja `content` jugable
 * @param {string}   etiqueta   nombre de la pestaña única («Tablero», «Dibujo»…)
 * @param {Function} html       `(activity) => html` de esa pestaña
 * @param {Function} wire       `(root, activity, onChange) => void`
 */
export function renderEditorJuego(root, activity, onChange, { asegurar, etiqueta, html, wire }) {
  asegurar(activity);
  renderEditorShell(root, activity, onChange, { content: { label: etiqueta, html, wire } });
}
