// Crucigrama — solo player. Aquí queda lo que TOCA EL DOM: montar, teclear,
// pintar el veredicto y cerrar. Lo demás vive en tres módulos propios, que se
// prueban desde Node (tests/crossword.test.mjs):
//   · view.js   — el markup de la rejilla y las pistas
//   · cursor.js — moverse por el crucigrama (celda activa, dirección, saltos)
//   · check.js  — qué está bien, qué letra regala la pista y cuánto vale
import { html, mount, raizDe, $, $$ } from '../../core/html.js';
import { on } from '../../core/events.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { scoreCrosswordSubmission } from './scorer.js';
import { palabraJugable } from '../../core/contentModels/words.js';
import { buildGrid } from './generator.js';
import { observeResize } from '../../core/observeResize.js';
import { hudSet } from '../../core/playerHud.js';
import { celdaPx, crosswordHtml } from './view.js';
import { celdasDe, crearCursor } from './cursor.js';
import { palabraParaPista, palabraResuelta, primeraVacia, puntuarCrucigrama, revisarTodo } from './check.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').CrosswordWord} CrosswordWord
 */

/**
 * @param {string|Element} rootSel
 * @param {import('../../kernel/contracts/activity.js').Activity} activity
 * @param {import('../../kernel/contracts/template.js').PlayerOpts} [opts]
 * @returns {Promise<void>}
 */
export async function renderCrosswordPlayer(rootSel, activity, opts = {}) {
  const contenido = /** @type {{words?: CrosswordWord[]}|null|undefined} */ (activity.content);
  const wordsRaw = (contenido?.words || [])
    .filter(w => palabraJugable(w) && w.clue);

  // `rootSel` puede llegar como ELEMENTO (lo declara el shell): interpolarlo en
  // un selector daba «[object HTMLElement] .cw-grid-wrap», que no casa con nada.
  const raiz = () => raizDe(rootSel);
  /** @param {string} sel @returns {HTMLElement|null} */
  const dentro = (sel) => $(sel, raiz());
  /** @param {string} sel @returns {HTMLElement[]} */
  const todos = (sel) => $$(sel, raiz());

  if (!wordsRaw.length) {
    mount(rootSel, html`<div class="alert alert-warning m-3">No hay palabras configuradas.</div>`);
    return;
  }

  const { grid, rows, cols, wordNums, words } = buildGrid(wordsRaw);
  if (!rows || !cols) {
    mount(rootSel, html`<div class="alert alert-danger m-3">Error al generar el crucigrama.</div>`);
    return;
  }

  const ctx = runFreeformPlayer(rootSel, activity, opts);
  const totalWords = words.length;
  // AYUDA DECLARADA por el editor («Sin ayuda» / «Primera letra de cada
  // palabra»). El ajuste existía y no lo leía nadie: el botón «Pista» salía
  // siempre, también con «Sin ayuda» elegido, y la primera letra no se
  // regalaba nunca. Un mando que no manda es peor que no tenerlo.
  const hintMode = String(activity.rules?.hintMode || 'none');

  // Lo que ha escrito el alumno + las palabras que ya se dan por buenas.
  /** @type {string[][]} */
  const userGrid  = Array.from({ length: rows }, () => Array(cols).fill(''));
  /** @type {Set<string>} */
  const solvedIds = new Set();

  const cursor = crearCursor({ grid, words, wordNums, rows, cols });
  const cur = cursor.estado;

  mount(rootSel, crosswordHtml({ grid, words, wordNums, rows, cols, hintMode }));
  requestAnimationFrame(fitGrid);
  attachInteraction();

  // ── Fit grid to available space ──────────────────────────────────────────

  function fitGrid() {
    const wrap = dentro('.cw-grid-wrap');
    const grid = dentro('.cw-grid');
    if (!wrap || !grid) return;
    const availW = wrap.clientWidth  - 4;  // 4px = border*2
    const availH = wrap.clientHeight - 4;
    if (!availW || !availH) return;
    grid.style.setProperty('--cw-cell', `${celdaPx(availW, availH, rows, cols)}px`);
  }

  // Recalculate if container resizes; disconnect when game finishes.
  // rAF-debounced (observeResize): fitGrid muta --cw-cell dentro del observado.
  /** @type {(() => void)|null} */
  let stopRo = null;
  if (typeof ResizeObserver !== 'undefined') {
    const wrap = dentro('.cw-grid-wrap');
    if (wrap) stopRo = observeResize(wrap, fitGrid);
  }

  // ── Interaction ──────────────────────────────────────────────────────────

  function attachInteraction() {
    // Teclado invisible del móvil. Acotado a la raíz de ESTE crucigrama: un id
    // global lo comparten todas las copias montadas en la página.
    const ki = /** @type {HTMLInputElement|null} */ (dentro('[data-cw="ki"]'));

    // Click on a cell
    on(rootSel, 'pointerdown', '.cw-white', (e, el) => {
      e.preventDefault();
      const r = +(el.dataset.r ?? -1), c = +(el.dataset.c ?? -1);
      if (r === cur.r && c === cur.c) cursor.alternarDireccion();
      else cursor.seleccionar(r, c);
      highlightActive();
      ki?.focus();
    });

    // Mobile / desktop keyboard input
    ki?.addEventListener('keydown', (e) => {
      if (cur.r < 0) return;
      if (e.key === 'Backspace') { e.preventDefault(); eraseLetter(); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); cursor.mover(0, 1); highlightActive(); return; }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); cursor.mover(0,-1); highlightActive(); return; }
      if (e.key === 'ArrowDown')  { e.preventDefault(); cursor.mover(1, 0); highlightActive(); return; }
      if (e.key === 'ArrowUp')    { e.preventDefault(); cursor.mover(-1,0); highlightActive(); return; }
      if (e.key === 'Tab') { e.preventDefault(); cursor.siguientePalabra(cur.dir); highlightActive(); return; }
    });

    ki?.addEventListener('input', () => {
      if (cur.r < 0) return;
      const raw = ki.value.replace(/\s/g, '');
      ki.value = '';
      if (!raw) return;
      const char = raw.slice(-1).toUpperCase();
      if (/[A-ZÁÉÍÓÚÜÑ]/.test(char)) setLetter(char);
    });

    // Clue click → go to word start
    on(rootSel, 'click', '.cw-clue', (_, el) => {
      const wid = el.dataset.wid;
      if (!wid || !cursor.irAPalabra(wid)) return;
      highlightActive();
      ki?.focus();
    });

    // Buttons
    on(rootSel, 'click', '#cw-check', checkAll);
    on(rootSel, 'click', '#cw-hint',  giveHint);
    // Con «Primera letra de cada palabra» se regalan AL EMPEZAR, una vez
    // montada la rejilla (antes hace falta que existan las celdas).
    if (hintMode === 'first') regalarPrimerasLetras();
    on(rootSel, 'click', '#cw-reset', resetGrid);
  }

  // ── Cell helpers ──────────────────────────────────────────────────────────

  /** @param {number} r @param {number} c @returns {HTMLElement|null} */
  function cellEl(r, c) {
    return dentro(`.cw-grid [data-r="${r}"][data-c="${c}"]`);
  }
  /** @param {number} r @param {number} c @returns {HTMLElement|null} */
  function letterEl(r, c) { return dentro(`[data-cwl="${r}-${c}"]`); }
  /** @param {string} wid @returns {HTMLElement|null} */
  function clueEl(wid)    { return dentro(`.cw-clue[data-wid="${wid}"]`); }

  /** Escribe una letra REGALADA (pista): en el modelo y en la casilla.
   * @param {number} r @param {number} c @param {string} char @returns {void} */
  function regalarLetra(r, c, char) {
    userGrid[r][c] = char;
    const el = letterEl(r, c);
    if (el) { el.textContent = char; el.classList.add('cw-hint-letter'); }
  }

  /** Regala la PRIMERA letra de cada palabra (modo «first»). Se pinta como una
   *  pista porque lo es, y se hace tras montar la rejilla. */
  function regalarPrimerasLetras() {
    for (const w of words) {
      if (userGrid[w.row][w.col]) continue;
      regalarLetra(w.row, w.col, w.word[0]);
    }
    updateProgress();
  }

  function highlightActive() {
    // Clear all highlights
    todos('.cw-white').forEach(el => el.classList.remove('cw-active-word', 'cw-active-cell'));
    todos('.cw-clue').forEach(el => el.classList.remove('cw-clue-active'));
    if (cur.r < 0) return;

    // Highlight all cells of active word
    const w = cursor.palabra(cur.wordId);
    if (w) {
      for (const { r, c } of celdasDe(w)) cellEl(r, c)?.classList.add('cw-active-word');
      clueEl(w.id)?.classList.add('cw-clue-active');
      // Scroll clue into view
      clueEl(w.id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // Highlight active cell itself
    cellEl(cur.r, cur.c)?.classList.add('cw-active-cell');
  }

  /** @param {string} char @returns {void} */
  function setLetter(char) {
    if (!cursor.esBlanca(cur.r, cur.c)) return;
    const r = cur.r, c = cur.c;
    userGrid[r][c] = char;
    const el = letterEl(r, c);
    if (el) { el.textContent = char; el.classList.remove('cw-wrong-letter'); }
    // Remove wrong state from cell
    cellEl(r, c)?.classList.remove('cw-wrong-word');

    // Check if the words through this cell are now solved
    comprobarPalabrasDe(r, c);
    cursor.avanzar(userGrid);
    highlightActive();
  }

  /** Las palabras que pasan por una casilla que acaba de cambiar.
   * @param {number} r @param {number} c @returns {void} */
  function comprobarPalabrasDe(r, c) {
    for (const wid of grid[r]?.[c]?.wordIds || []) {
      if (solvedIds.has(wid)) continue;
      const w = cursor.palabra(wid);
      if (!w || !palabraResuelta(w, userGrid)) continue;
      solvedIds.add(wid);
      markWord(wid, 'correct');
      updateProgress();
      if (solvedIds.size === totalWords) finishGame();
    }
  }

  function eraseLetter() {
    const el = letterEl(cur.r, cur.c);
    if (el && userGrid[cur.r]?.[cur.c]) {
      const r = cur.r, c = cur.c;
      userGrid[r][c] = '';
      el.textContent = '';
      el.classList.remove('cw-wrong-letter');
      cellEl(r, c)?.classList.remove('cw-correct-word', 'cw-wrong-word');
      // Un-solve if word was solved
      for (const wid of grid[r]?.[c]?.wordIds || []) {
        if (!solvedIds.has(wid)) continue;
        solvedIds.delete(wid);
        markWord(wid, 'none');
      }
    } else {
      // Move back and erase
      if (cursor.retroceder()) {
        const el2 = letterEl(cur.r, cur.c);
        if (el2) { userGrid[cur.r][cur.c] = ''; el2.textContent = ''; }
      }
      highlightActive();
    }
    updateProgress();
  }

  /** @param {string} wid @param {'correct'|'wrong'|'none'} state @returns {void} */
  function markWord(wid, state) {
    const w = cursor.palabra(wid);
    if (!w) return;
    for (const { r, c } of celdasDe(w)) {
      const el = cellEl(r, c);
      el?.classList.remove('cw-correct-word', 'cw-wrong-word');
      if (state === 'correct') el?.classList.add('cw-correct-word');
      if (state === 'wrong')   el?.classList.add('cw-wrong-word');
    }
    const cl = clueEl(wid);
    cl?.classList.remove('cw-clue-solved', 'cw-clue-wrong');
    if (state === 'correct') cl?.classList.add('cw-clue-solved');
    if (state === 'wrong')   cl?.classList.add('cw-clue-wrong');
  }

  function checkAll() {
    const veredicto = revisarTodo(words, userGrid, solvedIds);
    for (const { r, c } of veredicto.letrasBien) letterEl(r, c)?.classList.remove('cw-wrong-letter');
    for (const { r, c } of veredicto.letrasMal)  letterEl(r, c)?.classList.add('cw-wrong-letter');
    for (const id of veredicto.resueltas) solvedIds.add(id);
    for (const { id, estado } of veredicto.palabras) markWord(id, estado);
    updateProgress();
    if (veredicto.todas) finishGame();
  }

  function giveHint() {
    // Reveal one unsolved letter in the active word (or any word)
    const w = palabraParaPista(words, solvedIds, cur.wordId);
    if (!w) return;
    const hueco = primeraVacia(w, userGrid);
    if (!hueco) return;
    regalarLetra(hueco.r, hueco.c, hueco.letra);
    comprobarPalabrasDe(hueco.r, hueco.c);
    updateProgress();
  }

  function resetGrid() {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        userGrid[r][c] = '';
        const el = letterEl(r, c);
        if (el) { el.textContent = ''; el.className = 'cw-letter'; }
        cellEl(r, c)?.classList.remove('cw-correct-word', 'cw-wrong-word');
      }
    solvedIds.clear();
    todos('.cw-clue').forEach(el => el.classList.remove('cw-clue-solved','cw-clue-wrong'));
    updateProgress();
  }

  // ── Progress + finish ─────────────────────────────────────────────────────

  function updateProgress() {
    hudSet(document.querySelector('.cw-wrap'), 'pagina', `${solvedIds.size} / ${totalWords}`);
  }

  // Dos caminos llevan aquí —resolver la última palabra o agotarse el tiempo—
  // y el segundo no puede repetir el podio ni la celebración.
  let terminado = false;
  function finishGame() {
    if (terminado) return;
    terminado = true;
    stopRo?.();
    // Puntúa con el MISMO scorer de la plantilla (una llamada por palabra
    // resuelta): sin aritmética propia en el player. El techo es, por
    // definición, lo que da ese scorer si se resuelven todas.
    const { score, maxScore } = puntuarCrucigrama(words, solvedIds,
      (w) => scoreCrosswordSubmission({ value: w.word, item: w, activity }).points);
    // El final lo pinta el SHELL (sin salida, ver core/soloPlayer.js): antes había un cartel
    // propio que celebraba con confeti aunque solo se hubieran resuelto 3 de
    // 8 palabras, y al cerrarse dejaba al alumno parado en el tablero sin
    // puntaje ni salida (§21b, un solo dueño del final). El confeti REAL
    // sigue en el PODIUM que emite el shell al cerrar; aquí solo se le entrega
    // la VERDAD de cómo acabó (R6): completado o no, y cuántas palabras.
    const completo = solvedIds.size >= totalWords;
    ctx.finish({
      score, maxScore,
      icon: completo ? 'bi-trophy-fill' : 'bi-hourglass-split',
      iconColor: completo ? 'text-warning' : 'text-secondary',
      title: completo ? '¡Crucigrama completado!' : 'Se acabó el tiempo',
      stats: `${solvedIds.size} / ${totalWords} palabras encontradas`,
    });
  }

  // El RELOJ no espera a nadie: al agotarse se cierra con lo resuelto.
  ctx.alAgotarse(finishGame);

  // Select the first cell of the first word on load
  const primera = [...words].sort((a, b) => (wordNums[a.id] || 0) - (wordNums[b.id] || 0))[0];
  if (primera) {
    cursor.irAPalabra(primera.id);
    highlightActive();
  }
}
