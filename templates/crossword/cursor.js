// EL CURSOR DEL CRUCIGRAMA — moverse por la rejilla, sin DOM.
//
// Aquí vive lo que decide QUÉ CASILLA está activa y en qué dirección: elegir
// celda, alternar horizontal/vertical, avanzar al escribir, retroceder al
// borrar, saltar a la palabra siguiente. Estaba dentro de `player.js`, mezclado
// con `classList` y `querySelector`, y por eso ninguna suite podía ejecutarlo:
// para comprobar que al escribir la última letra el cursor salta al hueco
// correcto hacía falta un navegador. Ahora es estado + aritmética sobre la
// rejilla, y `tests/crossword.test.mjs` lo recorre entero desde Node.
//
// El player conserva su papel: tras cada movimiento repinta (resaltados,
// desplazar la pista a la vista) leyendo `cursor.estado`.

/**
 * @typedef {import('../../kernel/contracts/activity.js').CrosswordWord} CrosswordWord
 * @typedef {import('./generator.js').CrosswordGrid} CrosswordGrid
 * @typedef {{r: number, c: number, dir: 'H'|'V', wordId: string|null}} EstadoCursor
 */

/** Las celdas que ocupa una palabra, en su orden de lectura.
 * @param {CrosswordWord} w
 * @returns {{r: number, c: number, i: number}[]}
 */
export function celdasDe(w) {
  return Array.from({ length: w.word.length }, (_, i) => ({
    r: w.dir === 'H' ? w.row : w.row + i,
    c: w.dir === 'H' ? w.col + i : w.col,
    i,
  }));
}

/**
 * @param {{grid: CrosswordGrid['grid'], words: CrosswordWord[],
 *          wordNums: Record<string, number>, rows: number, cols: number}} tablero
 */
export function crearCursor({ grid, words, wordNums, rows, cols }) {
  const porId = new Map(words.map(w => [w.id, w]));
  /** @type {EstadoCursor} */
  const estado = { r: -1, c: -1, dir: 'H', wordId: null };

  /** @param {number} r @param {number} c @returns {boolean} */
  const esBlanca = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols && !grid[r][c].blocked;

  /** La palabra que pasa por esa celda en esa dirección (o la primera que pase).
   * @param {number} r @param {number} c @param {'H'|'V'} dir @returns {string|null} */
  function palabraEnCelda(r, c, dir) {
    const cell = grid[r]?.[c];
    if (!cell || cell.blocked) return null;
    return cell.wordIds.find(id => porId.get(id)?.dir === dir) ?? cell.wordIds[0] ?? null;
  }

  /** @param {number} r @param {number} c @returns {boolean} se movió */
  function seleccionar(r, c) {
    if (!esBlanca(r, c)) return false;
    estado.r = r; estado.c = c;
    // Se prefiere la palabra que va en la dirección actual; si no hay, se toma
    // la de la otra dirección Y el cursor gira con ella.
    const wid = palabraEnCelda(r, c, estado.dir) ?? palabraEnCelda(r, c, estado.dir === 'H' ? 'V' : 'H');
    const w = wid ? porId.get(wid) : null;
    if (w) estado.dir = w.dir;
    estado.wordId = palabraEnCelda(r, c, estado.dir);
    return true;
  }

  /** Tocar la MISMA celda gira el cursor. Al girar se recalcula la palabra
   *  activa: sin eso el giro no cambiaba ni el resaltado ni por dónde avanzaba
   *  el tecleo, o sea que el gesto no hacía nada. */
  function alternarDireccion() {
    estado.dir = estado.dir === 'H' ? 'V' : 'H';
    if (estado.r >= 0) estado.wordId = palabraEnCelda(estado.r, estado.c, estado.dir) ?? estado.wordId;
  }

  /** Un paso en línea recta hasta la siguiente casilla blanca.
   * @param {number} dr @param {number} dc @returns {boolean} */
  function mover(dr, dc) {
    let r = estado.r + dr, c = estado.c + dc;
    while (r >= 0 && r < rows && c >= 0 && c < cols) {
      if (esBlanca(r, c)) return seleccionar(r, c);
      r += dr; c += dc;
    }
    return false;
  }

  const pasoEnDireccion = () => mover(estado.dir === 'H' ? 0 : 1, estado.dir === 'H' ? 1 : 0);

  /** Tras escribir una letra: al siguiente HUECO de la palabra; si ya está
   *  llena, un paso en la dirección del cursor.
   * @param {string[][]} userGrid @returns {boolean} */
  function avanzar(userGrid) {
    const w = estado.wordId ? porId.get(estado.wordId) : null;
    if (!w) return pasoEnDireccion();
    // El índice se mide con la dirección de LA PALABRA, no con la del cursor.
    const idx = w.dir === 'H' ? estado.c - w.col : estado.r - w.row;
    for (const { r, c, i } of celdasDe(w)) {
      if (i <= idx) continue;
      if (!userGrid[r]?.[c]) return seleccionar(r, c);
    }
    return pasoEnDireccion();
  }

  /** Al borrar en una casilla vacía: una posición atrás dentro de la palabra.
   * @returns {boolean} */
  function retroceder() {
    const w = estado.wordId ? porId.get(estado.wordId) : null;
    if (!w) return false;
    const idx = w.dir === 'H' ? estado.c - w.col : estado.r - w.row;
    if (idx <= 0) return false;
    const anterior = celdasDe(w)[idx - 1];
    return seleccionar(anterior.r, anterior.c);
  }

  /** Tabulador: primera casilla de la palabra siguiente en esa dirección.
   * @param {'H'|'V'} dir @returns {boolean} */
  function siguientePalabra(dir) {
    const ordenadas = words.filter(w => w.dir === dir)
      .sort((a, b) => (wordNums[a.id] || 0) - (wordNums[b.id] || 0));
    if (!ordenadas.length) return false;
    const cur = ordenadas.findIndex(w => w.id === estado.wordId);
    const nxt = ordenadas[(cur + 1) % ordenadas.length];
    if (!nxt) return false;
    estado.dir = nxt.dir;
    return seleccionar(nxt.row, nxt.col);
  }

  /** @param {string} wid @returns {boolean} */
  function irAPalabra(wid) {
    const w = porId.get(wid);
    if (!w) return false;
    estado.dir = w.dir;
    return seleccionar(w.row, w.col);
  }

  return { estado, esBlanca, palabra: (/** @type {string|null} */ id) => (id ? porId.get(id) ?? null : null),
           seleccionar, alternarDireccion, mover, avanzar, retroceder, siguientePalabra, irAPalabra };
}
