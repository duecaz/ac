// LA REVISIÓN PALABRA POR PALABRA, Y QUE SUS NÚMEROS CUADREN.
//
// Rescatada de la app anterior de Tildes (dueño 2026-08-27, con capturas): la
// corrección se pintaba SOLO dentro del texto, en rojo, y para saber qué había
// fallado había que releer la frase buscando letras de color. La lista lo dice
// de un vistazo, y el docente puede ANULAR un veredicto.
//
// LO QUE ESTA SUITE PROTEGE es lo que ya se rompió una vez escribiéndola:
// perdonar una marca DE MÁS la pintaba de verde y el pie decía «1 / 8 correctas»
// mientras el veredicto de al lado seguía en «0/8 aciertos». Dos números que no
// cuadran, en la pantalla cuyo único trabajo es que cuadren. Aquí se fija el
// invariante: el contador del pie y los aciertos del SCORER son siempre el mismo
// número, con anulaciones y sin ellas.
//
// Run: node tests/tcRevision.test.mjs
import assert from 'node:assert';
import { filasRevision, resumenRevision, valorAnulado, efectivoDe } from '../core/textCorrectionRound.js';
import { scoreMarksPerHit } from '../core/textMarks.js';
import { corrigeAlFinal, DEFAULT_REVIEW } from '../core/constants.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// «Santa Rosa de Lima, patrona de America y las Filipinas nacio en Lima…» — el
// texto se guarda SIN tildes y las marcas dicen dónde van (posición de la vocal).
const TEXTO = 'Santa Rosa de Lima patrona de America y las Filipinas nacio en Lima';
const P = { text: TEXTO, marks: [
  { kind: 'tilde', pos: TEXTO.indexOf('America') + 2 },   // la «e» de América
  { kind: 'tilde', pos: TEXTO.indexOf('nacio') + 4 },     // la «o» de nació
] };
const ACT = { scoring: { pointsPerCorrect: 10 } };
const posDe = (palabra) => P.marks.find(m => TEXTO.slice(m.pos - 4, m.pos + 4).includes(palabra.slice(0, 4))).pos;

// ── 1) Las palabras salen ESCRITAS COMO DEBEN QUEDAR ────────────────────────
// «América», no «America»: es lo que el alumno tiene que aprender a ver. Una
// lista que repitiera la palabra mal escrita enseñaría el error.
{
  const filas = filasRevision(P, 'tilde', new Set());
  assert.deepStrictEqual(filas.map(f => f.palabra), ['América', 'nació'],
    'la revisión muestra la palabra ya acentuada, no la del texto sin tildes');
  ok('las palabras se muestran acentuadas («América», «nació»), que es lo que hay que aprender');
}

// ── 2) TRES clases de fila, no dos ──────────────────────────────────────────
// Las marcas DE MÁS no salían en la app anterior. Aquí no se pueden callar: el
// puntaje es NETO (aciertos − de más), y una lista que dijera «2/2 correctas»
// junto a 0 puntos sería un número imposible de explicar con la clase delante.
{
  const got = new Set([posDe('America'), 3]);      // una bien y una donde no tocaba
  const filas = filasRevision(P, 'tilde', got);
  const estados = filas.map(f => f.estado).sort();
  assert.deepStrictEqual(estados, ['demas', 'falta', 'ok'],
    'tienen que aparecer las tres: acertada, sin marcar y DE MÁS');
  ok('tres clases de fila: acertada · sin marcar · de más (la tercera explica por qué baja el puntaje)');
}

// ── 3) EL INVARIANTE: el pie y el scorer dicen el mismo número ──────────────
// Se prueban TODAS las combinaciones de anulación posibles sobre un caso con las
// tres clases. Sin este barrido, el fallo que ya ocurrió —perdonar una de más
// contaba como acierto— habría vuelto a pasar en cuanto alguien tocara el panel.
{
  const got = new Set([posDe('America'), 3]);
  const filas = filasRevision(P, 'tilde', got);
  const todas = filas.map(f => f.pos);
  let combos = 0;
  for (let m = 0; m < (1 << todas.length); m++) {
    const anulados = new Set(todas.filter((_, i) => m & (1 << i)));
    const { buenas, total } = resumenRevision(filas, anulados);
    const r = scoreMarksPerHit(valorAnulado([...got], anulados, P, 'tilde'), P, ['tilde'], ACT);
    assert.strictEqual(buenas, r.hits,
      `con anulaciones {${[...anulados]}} el pie dice ${buenas} y el scorer ${r.hits}`);
    assert.strictEqual(total, r.total, 'y el denominador también tiene que ser el mismo');
    combos++;
  }
  ok(`el pie y el scorer coinciden en las ${combos} combinaciones de anulación posibles`);
}

// ── 4) PERDONAR UNA DE MÁS NO ES UN ACIERTO ─────────────────────────────────
// El fallo concreto, con nombre. Perdonar significa «esto ya no resta», que es
// lo que hace el scorer al quitar esa posición — no «esto estaba bien».
{
  const got = new Set([3]);                        // solo una marca, y de más
  const filas = filasRevision(P, 'tilde', got);
  const anulados = new Set([3]);
  assert.strictEqual(efectivoDe(filas.find(f => f.pos === 3), true), 'perdon',
    'una de más perdonada se queda en «perdonada», ni acierto ni fallo');
  assert.strictEqual(resumenRevision(filas, anulados).buenas, 0,
    'y NO cuenta como correcta: el pie decía «1 / 8» con el veredicto en «0/8»');
  const r = scoreMarksPerHit(valorAnulado([...got], anulados, P, 'tilde'), P, ['tilde'], ACT);
  assert.strictEqual(r.over, 0, 'lo que sí hace es dejar de restar…');
  assert.strictEqual(r.hits, 0, '…sin regalar un acierto');
  ok('perdonar una marca de más deja de restar y NO regala un acierto');
}

// ── 5) ANULAR PASA POR EL SCORER, no por una suma aparte ────────────────────
// La ley del repo es un solo scorer por plantilla. La anulación se EXPRESA como
// las posiciones que el alumno habría marcado, así que el puntaje del docente y
// el del scorer no pueden divergir ni queriendo.
{
  const got = [];                                   // no marcó nada
  const anulados = new Set([posDe('America')]);     // el docente la da por buena
  const r = scoreMarksPerHit(valorAnulado(got, anulados, P, 'tilde'), P, ['tilde'], ACT);
  assert.strictEqual(r.hits, 1, 'dar por buena una que faltaba añade su posición');
  assert.strictEqual(r.points, 10, 'y el puntaje sale del scorer con el ppc de la actividad (10)');
  // CONTRA-PRUEBA: anular en el otro sentido QUITA la marca, no la añade dos veces.
  const buena = [posDe('America')];
  const r2 = scoreMarksPerHit(valorAnulado(buena, anulados, P, 'tilde'), P, ['tilde'], ACT);
  assert.strictEqual(r2.hits, 0, 'CONTRA-PRUEBA: anular una acertada la quita');
  ok('anular se expresa como posiciones y lo puntúa el MISMO scorer (10 pts por marca)');
}

// ── 6) CORREGIR AL FINAL ES EL DEFECTO, y lo dice UN solo sitio ─────────────
// Lo preguntan el runner (para saltarse la corrección entre frases) y el editor
// (para marcar la casilla). Escrito dos veces —un `!== false` y un `=== true`—
// darían defectos OPUESTOS sin que nadie lo notara hasta tener la clase delante.
{
  assert.strictEqual(corrigeAlFinal({}), true,
    'una actividad sin nada declarado corrige AL FINAL: es lo que pidió el aula');
  assert.strictEqual(corrigeAlFinal({ review: {} }), true,
    'y un bloque review vacío tampoco cambia el defecto');
  assert.strictEqual(corrigeAlFinal({ review: { alFinal: false } }), false,
    'solo apagarlo a propósito devuelve la corrección entre frases');
  assert.strictEqual(corrigeAlFinal(null), true, 'sin actividad, el defecto sigue siendo el defecto');
  assert.strictEqual(DEFAULT_REVIEW.alFinal, true,
    'y el defecto declarado en constants tiene que decir lo MISMO que el predicado');
  ok('corregir al final es el defecto, con un solo dueño y coherente con DEFAULT_REVIEW');
}

console.log(`\ntcRevision.test: ${passed} checks passed`);
