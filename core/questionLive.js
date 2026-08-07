// Compartido entre el host (proyector) y el alumno del modo 'question-live'
// (Abre Cajas / Ruleta Live). La paleta estaba duplicada literal en
// hostLive.js y studentLive.js — un cambio de color en uno desincronizaba al otro.
export const QL_COLORS = ['#e74c3c','#e67e22','#d4ac0d','#27ae60','#16a085','#2980b9','#8e44ad','#c0392b'];

// ── EL TABLERO DE CAJAS, una sola vez ──────────────────────────────────────
// Estaba pintado TRES veces —host (`.ql-box`), alumno (`.ql-sbox`) e Individual
// (`.ab-box`)— con la misma decisión de color escrita tres veces y ya con
// reglas ligeramente distintas (el host repartía en hasta 6 columnas y los
// otros dos en 4). Lo que cambia de verdad entre las tres es el CHROME (clase,
// si se puede tocar, qué se ve en una caja hecha), no la decisión.
//
//   hecha  → verde, con lo que valió (o un ✓ si no hay puntos que enseñar)
//   ABIERTA→ blanca con el borde de su color (es la que se está respondiendo)
//   libre  → su color
const VERDE = '#198754';

/** Columnas del tablero: cuadrado-ish, acotado. `max` lo decide la pantalla
 *  (el proyector del host cabe más ancho que el móvil del alumno). */
export function qlCols(n, max = 4) {
  return Math.min(max, Math.max(2, Math.ceil(n / 2)));
}

/**
 * @param {number} total   cuántas cajas
 * @param {object} o
 *   done   Set|objeto: caja → puntos (o true). Una caja "hecha" ya no se toca.
 *   open   índice de la caja abierta (o null)
 *   cls    clase base de la caja en esta pantalla
 *   pickable(idx) → ¿esta pantalla deja tocar esta caja?
 *   label(idx, puntos) → qué se pinta dentro cuando está hecha
 */
export function qlBoxesHtml(total, { done = {}, open = null, cls = 'ql-box', pickable = () => false, extraStyle = '' } = {}) {
  const puntosDe = (i) => (done instanceof Set ? (done.has(i) ? true : null) : done[i] ?? null);
  return Array.from({ length: total }, (_, idx) => {
    const hecha = puntosDe(idx) != null;
    const abierta = open === idx;
    const color = QL_COLORS[idx % QL_COLORS.length];
    let style, clase = cls;
    if (hecha)        { style = `background:${VERDE};border-color:${VERDE};color:#fff`; clase += ' ql-done'; }
    else if (abierta) { style = `background:#fff;border:3px solid ${color};color:#1f2937`; clase += ' ql-open'; }
    else              { style = `background:${color};border-color:${color};color:#fff`; }
    const tocable = !hecha && !abierta && pickable(idx);
    const dentro = hecha
      ? (puntosDe(idx) === true ? '<i class="bi bi-check2"></i>' : `<span class="ql-num">+${puntosDe(idx)}</span>`)
      : `<span class="ql-num">${idx + 1}</span>`;
    return `<button class="${clase}" data-idx="${idx}" data-i="${idx}" ${tocable ? '' : 'disabled'}` +
      ` style="${style};${extraStyle};cursor:${tocable ? 'pointer' : 'default'};opacity:1">${dentro}</button>`;
  }).join('');
}

// ── EL ESTADO `ql_*` DE LA SALA, con dueño ─────────────────────────────────
// Ocho claves repartidas entre cuatro módulos (las dos vistas y los dos
// adaptadores) que las asumían sin que nada las declarara. Ya costó un fallo:
// el `item` del premio hubo que añadirlo a mano porque "sin la caja, el
// adaptador no puede escribir la fila de live_answers y los puntos se quedarían
// solo en el blob (podio a 0)" — exactamente lo que pasa con un contrato tácito
// repartido entre vista y adaptador. Aquí se CONSTRUYE el parche; las vistas
// dejan de escribir literales.

/** Cerrar la caja abierta sin dar puntos (queda disponible otra vez). */
export function qlClosePatch() {
  return { ql_open: null, ql_question: null, ql_image: null, ql_by: null, ql_by_name: null };
}

/** El docente premia al que pidió la palabra: cierra la caja Y la sella. */
export function qlAwardPatch({ playerId, points, item, points0 = {}, taken0 = {} }) {
  return {
    // `item` es imprescindible: con él el adaptador escribe la fila de
    // live_answers y el podio cuadra (§21 · el dueño necesita la caja).
    ql_award: { playerId, points, item },
    ...qlClosePatch(),
    ql_points: { ...points0, [item]: points },
    ql_taken: { ...taken0, [item]: playerId },   // CL-1: quién se la llevó
  };
}
