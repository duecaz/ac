// EL CRUCIGRAMA POR DENTRO — el cursor y la comprobación, desde Node.
//
// Estas ~130 líneas vivían dentro de `templates/crossword/player.js`, enredadas
// con `querySelector` y `classList`: comprobar que al escribir la última letra
// el cursor salta al hueco correcto, o que «Verificar» no marca en rojo una
// casilla vacía, exigía un navegador y una persona mirando. Al sacarlas a
// `cursor.js` y `check.js` (Fase 6 del plan de simplificar) se vuelven
// ejecutables, que era el punto.
//
// Run: node tests/crossword.test.mjs
import assert from 'node:assert';
import { buildGrid } from '../templates/crossword/generator.js';
import { celdasDe, crearCursor } from '../templates/crossword/cursor.js';
import { palabraParaPista, palabraResuelta, primeraVacia, puntuarCrucigrama, revisarTodo }
  from '../templates/crossword/check.js';
import { celdaPx } from '../templates/crossword/view.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Un crucigrama de verdad, pequeño: CASA en horizontal y dos verticales que la
// cruzan (AMOR por la A, SOL por la S).
//    C A S A
//    . M O .
//    . O L .
//    . R . .
const WORDS = [
  { id: 'w1', word: 'CASA', clue: 'hogar', row: 0, col: 0, dir: 'H' },
  { id: 'w2', word: 'AMOR', clue: 'cariño', row: 0, col: 1, dir: 'V' },
  { id: 'w3', word: 'SOL',  clue: 'astro', row: 0, col: 2, dir: 'V' },
];
const tablero = buildGrid(WORDS);
const nuevoCursor = () => crearCursor({
  grid: tablero.grid, words: tablero.words, wordNums: tablero.wordNums,
  rows: tablero.rows, cols: tablero.cols,
});
const vacia = () => Array.from({ length: tablero.rows }, () => Array(tablero.cols).fill(''));
/** Escribe una palabra entera en la rejilla del alumno. */
const escribir = (g, w, texto = w.word) => {
  celdasDe(w).forEach(({ r, c, i }) => { g[r][c] = texto[i] ?? ''; });
  return g;
};

// ── El tablero de prueba es el que se cree ──────────────────────────────────
{
  assert.strictEqual(tablero.rows, 4);
  assert.strictEqual(tablero.cols, 4);
  assert.strictEqual(tablero.grid[0][0].blocked, false);
  assert.strictEqual(tablero.grid[1][0].blocked, true, '(1,0) no lo ocupa ninguna palabra');
  assert.deepStrictEqual(tablero.grid[0][1].wordIds, ['w1', 'w2'], 'la A es cruce');
  ok('rejilla de prueba: 4×4 con dos cruces reales');
}

// ── El cursor elige palabra según la dirección en curso ─────────────────────
{
  const cur = nuevoCursor();
  assert.strictEqual(cur.seleccionar(0, 1), true);
  assert.strictEqual(cur.estado.wordId, 'w1', 'en horizontal, la casilla de cruce es de CASA');
  // Tocar la MISMA casilla gira el cursor: y girar tiene que cambiar la palabra
  // activa, o el gesto no hace nada (es lo que pasaba: `activeWordId` se
  // quedaba en la palabra anterior, así que ni el resaltado ni el tecleo
  // cambiaban de dirección).
  cur.alternarDireccion();
  assert.strictEqual(cur.estado.dir, 'V');
  assert.strictEqual(cur.estado.wordId, 'w2', 'al girar, la casilla pasa a ser de AMOR');
  // CONTRA-PRUEBA: girar otra vez devuelve a la palabra de partida.
  cur.alternarDireccion();
  assert.strictEqual(cur.estado.wordId, 'w1');
  ok('girar el cursor en un cruce cambia la palabra activa (y volver, también)');
}

// ── Una casilla que solo pertenece a una palabra impone su dirección ────────
{
  const cur = nuevoCursor();
  cur.seleccionar(0, 0);
  assert.strictEqual(cur.estado.wordId, 'w1');
  cur.seleccionar(3, 1);            // última letra de AMOR: no hay horizontal ahí
  assert.strictEqual(cur.estado.dir, 'V', 'el cursor gira solo si la celda solo tiene vertical');
  assert.strictEqual(cur.estado.wordId, 'w2');
  assert.strictEqual(cur.seleccionar(3, 3), false, 'una casilla negra no se puede seleccionar');
  assert.strictEqual(cur.estado.r, 3, 'y el cursor no se mueve de donde estaba');
  ok('seleccionar respeta las casillas negras y gira con la palabra');
}

// ── Avanzar salta a los HUECOS de la palabra, no a la casilla de al lado ────
{
  const cur = nuevoCursor();
  const g = vacia();
  cur.seleccionar(0, 0);
  g[0][0] = 'C'; g[0][1] = 'A';     // la segunda ya estaba escrita (una pista)
  cur.avanzar(g);
  assert.deepStrictEqual([cur.estado.r, cur.estado.c], [0, 2], 'se salta la casilla ya escrita');
  // Con la palabra llena, un paso en la dirección del cursor.
  escribir(g, WORDS[0]);
  cur.seleccionar(0, 3);
  assert.strictEqual(cur.avanzar(g), false, 'al final de la fila no hay a dónde ir');
  ok('avanzar busca el siguiente hueco de la palabra y, si está llena, da un paso');
}

// ── Retroceder (borrar en casilla vacía) no se sale de la palabra ───────────
{
  const cur = nuevoCursor();
  cur.seleccionar(0, 2);
  assert.strictEqual(cur.retroceder(), true);
  assert.deepStrictEqual([cur.estado.r, cur.estado.c], [0, 1]);
  cur.seleccionar(0, 0);
  assert.strictEqual(cur.retroceder(), false, 'en la primera letra no se retrocede');
  ok('retroceder se mueve dentro de la palabra y para en su primera letra');
}

// ── Tabulador: la palabra siguiente en esa dirección, en ciclo ──────────────
{
  const cur = nuevoCursor();
  cur.seleccionar(0, 1);            // AMOR sale por dirección vertical
  cur.estado.dir = 'V'; cur.estado.wordId = 'w2';
  cur.siguientePalabra('V');
  assert.strictEqual(cur.estado.wordId, 'w3', 'de AMOR a SOL');
  cur.siguientePalabra('V');
  assert.strictEqual(cur.estado.wordId, 'w2', 'y vuelve a la primera');
  ok('el tabulador recorre las palabras de una dirección en ciclo');
}

// ── Mover en línea recta se salta las casillas negras ───────────────────────
{
  const cur = nuevoCursor();
  cur.seleccionar(3, 1);
  assert.strictEqual(cur.mover(0, 1), false, 'a la derecha de (3,1) todo es negro');
  assert.deepStrictEqual([cur.estado.r, cur.estado.c], [3, 1]);
  cur.seleccionar(0, 0);
  assert.strictEqual(cur.mover(1, 0), false, 'debajo de la C no hay nada');
  ok('mover no aterriza nunca en una casilla negra');
}

// ── ¿Está resuelta? ─────────────────────────────────────────────────────────
{
  const g = vacia();
  assert.strictEqual(palabraResuelta(WORDS[0], g), false, 'vacía no es resuelta');
  escribir(g, WORDS[0], 'CASO');
  assert.strictEqual(palabraResuelta(WORDS[0], g), false);
  escribir(g, WORDS[0]);
  assert.strictEqual(palabraResuelta(WORDS[0], g), true);
  ok('una palabra está resuelta solo con TODAS sus letras y correctas');
}

// ── «Verificar»: qué se marca en rojo y qué no ──────────────────────────────
{
  const g = vacia();
  escribir(g, WORDS[0]);            // CASA bien
  g[1][1] = 'X';                    // una letra inventada dentro de AMOR
  const v = revisarTodo(tablero.words, g);
  assert.deepStrictEqual(v.palabras.find(p => p.id === 'w1'), { id: 'w1', estado: 'correct' });
  assert.deepStrictEqual(v.palabras.find(p => p.id === 'w2'), { id: 'w2', estado: 'wrong' });
  assert.deepStrictEqual(v.letrasMal, [{ r: 1, c: 1 }],
    'solo se marca en rojo lo ESCRITO y equivocado: una casilla en blanco no es un error');
  assert.ok(v.resueltas.includes('w1') && !v.resueltas.includes('w2'));
  assert.strictEqual(v.todas, false);
  ok('verificar marca palabras y letras sin señalar las casillas vacías');
}

// ── Lo ya resuelto no se vuelve a tocar (una pista no se repinta en rojo) ───
{
  const g = vacia();
  escribir(g, WORDS[0]);
  const v = revisarTodo(tablero.words, g, new Set(['w2', 'w3']));
  assert.deepStrictEqual(v.palabras.map(p => p.estado), ['correct', 'correct', 'correct']);
  assert.strictEqual(v.todas, true, 'con todas dadas por buenas, se acaba');
  assert.deepStrictEqual(v.letrasMal, [], 'las ya resueltas no aportan letras marcadas');
  ok('verificar confirma lo ya resuelto sin re-examinar sus letras');
}

// ── La pista: qué palabra y qué casilla ─────────────────────────────────────
{
  const g = vacia();
  const resueltas = new Set(['w1']);
  assert.strictEqual(palabraParaPista(tablero.words, resueltas, 'w1').id, 'w2',
    'si la activa ya está resuelta, se regala en la primera pendiente');
  assert.strictEqual(palabraParaPista(tablero.words, resueltas, 'w3').id, 'w3',
    'si la activa está pendiente, se regala ahí');
  assert.strictEqual(palabraParaPista(tablero.words, new Set(['w1', 'w2', 'w3']), null), null);
  escribir(g, WORDS[1], 'AM');
  assert.deepStrictEqual(primeraVacia(WORDS[1], g), { r: 2, c: 1, letra: 'O' });
  escribir(g, WORDS[1]);
  assert.strictEqual(primeraVacia(WORDS[1], g), null, 'sin huecos no hay nada que regalar');
  ok('la pista elige palabra pendiente y su primera casilla vacía');
}

// ── Puntaje y techo salen del MISMO scorer ──────────────────────────────────
{
  const puntos = (w) => w.word.length;   // un scorer de mentira, pero uno solo
  assert.deepStrictEqual(puntuarCrucigrama(tablero.words, new Set(['w1']), puntos),
    { score: 4, maxScore: 11 });
  assert.deepStrictEqual(puntuarCrucigrama(tablero.words, new Set(['w1', 'w2', 'w3']), puntos),
    { score: 11, maxScore: 11 }, 'resolverlas todas ES el techo');
  ok('el techo del crucigrama es lo que da el scorer si se resuelve todo');
}

// ── El tamaño de casilla: se reparte el hueco, con piso de legibilidad ──────
{
  assert.strictEqual(celdaPx(400, 400, 4, 4), 100);
  assert.strictEqual(celdaPx(400, 200, 4, 4), 50, 'manda el lado más corto');
  assert.strictEqual(celdaPx(40, 40, 10, 10), 18, 'nunca por debajo del piso de 18 px');
  ok('la casilla se calcula del hueco disponible y no baja de 18 px');
}

console.log(`\ncrossword.test: ${passed} checks passed`);
