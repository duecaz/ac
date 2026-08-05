// EL RESUMEN DEL DUELO — qué hizo cada alumno, no solo quién ganó.
//
// Reportado en clase (Tildes en VS): "al finalizar debería salir lo que hizo el
// alumno, las tildes buenas y las malas, para saber quién ganó". Tenía razón y
// además el dato YA existía: los scorers de marcas devuelven `hits`/`over`/
// `total` en cada respuesta y el duelo se los tragaba — la pantalla final decía
// "3 de 5 aciertos · 3 pts" y ahí acababa la explicación.
//
// Con dos alumnos en la pizarra y la clase mirando, "ganó Ana" sin el porqué es
// una discusión asegurada. Esto lo cierra: cada lado, con lo que puso.
//
// GENÉRICO a propósito: no sabe de Tildes ni de Comas. Pinta el detalle SI el
// scorer lo declaró (`marks`), y si no se queda en aciertos — que es lo único
// honesto que se puede decir de un todo-o-nada. Una plantilla nueva cuyo scorer
// devuelva `hits/over/total` entra en el resumen sin tocar este archivo.
import { escapeHtml } from './html.js';

/**
 * Desglose de UN lado, en palabras de profe.
 * @param {object} side  `standings().left|right` (name, score, correct, marks)
 * @param {number} total nº de ítems del duelo
 * @returns {string[]} trozos listos para pintar, en orden de importancia
 */
export function sideBreakdown(side, total) {
  const out = [];
  const m = side?.marks;
  if (m && m.total > 0 && m.marca) {
    // MARCAS (Tildes/Comas): las tres cifras que el profe necesita para
    // arbitrar — lo que puso bien, lo que puso de más (y por eso resta) y lo
    // que se dejó sin marcar. Es justo lo que la pantalla final no decía.
    const sinMarcar = Math.max(0, m.total - m.hits);
    out.push(`${m.hits} de ${m.total} bien`);
    if (m.over) out.push(`${m.over} de más`);
    if (sinMarcar) out.push(`${sinMarcar} sin marcar`);
  } else if (m && m.total > 0) {
    // RESPUESTAS: aquí "de más" no significa nada (no se puede marcar de más en
    // una opción múltiple), así que no se inventa una tercera cifra. El
    // denominador es el del DUELO, no el de lo que le dio tiempo a contestar:
    // "1 de 1 aciertos" ocultaba que ese lado se quedó a mitad de carrera.
    const denom = (Number.isFinite(total) && total > 0) ? total : m.total;
    out.push(`${m.hits} de ${denom} aciertos`);
  } else if (Number.isFinite(total) && total > 0) {
    out.push(`${side?.correct ?? 0} de ${total} aciertos`);
  }
  // En carrera el duelo lo cierra el primero que acaba: decir que el otro no
  // terminó es la diferencia entre "perdió" y "iba más lento".
  if (out.length && side && side.done === false) out.push('no terminó');
  return out;
}

/**
 * El cuadro comparativo de las dos columnas. Se pinta en la celebración final
 * del duelo, debajo del podio.
 * @param {object} st `standings()` del duelo ya terminado
 */
export function duelSummaryHtml(st) {
  if (!st?.left || !st?.right) return '';
  const col = (s, sideId) => {
    const partes = sideBreakdown(s, st.total);
    if (!partes.length) return '';
    return `<div class="duel-sum__side duel-sum__side--${sideId}">
      <div class="duel-sum__name">${escapeHtml(s.name || '')}</div>
      <div class="duel-sum__score">${s.score} pts</div>
      <ul class="duel-sum__list">${partes.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
    </div>`;
  };
  const izq = col(st.left, 'left'), der = col(st.right, 'right');
  if (!izq && !der) return '';
  return `<div class="duel-sum">${izq}${der}</div>`;
}
