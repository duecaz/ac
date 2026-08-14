// ¿QUÉ LE FALTA A LA ACTIVIDAD? — la revisión que impide jugar a medias.
//
// El caso real (2026-08-14): dibujo subido, etiquetas SIN escribir, y la app
// dejaba jugar. En el juego no había nada que arrastrar. La regla que se fija
// aquí es la de cualquier aplicación con datos incompletos: no dejar continuar
// y decir EN ROJO qué falta.
// Run: node tests/activityCheck.test.mjs
import assert from 'node:assert';
import '../core/registerTemplates.js';
import { listTemplates } from '../core/registry.js';
import { revisarActividad, modelosRevisados, sinEscribirNada } from '../core/activityCheck.js';
import { migrate, newActivity } from '../core/migrate.js';
import { SCHEMA_VERSION } from '../core/constants.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
// `schemaVersion` explícito: sin él migrate cree que viene de v1 y RECONSTRUYE
// el contenido desde la muestra de la plantilla — el contenido de la prueba
// desaparecía y el revisor veía otra actividad.
const act = (template, content, title = 'Mi actividad') =>
  migrate({ id: 'x', template, title, content, schemaVersion: SCHEMA_VERSION });

// ── El caso que lo originó ───────────────────────────────────────────────────
{
  const r = revisarActividad(act('diagram', { image: 'data:image/png;base64,AA', pins: [
    { id: 'pin_1', label: 'Hoja', x: .2, y: .2 },
    { id: 'pin_2', label: '',     x: .5, y: .5 },
    { id: 'pin_3', label: '   ',  x: .8, y: .8 },
  ] }));
  assert.strictEqual(r.listo, false, 'con etiquetas en blanco NO se puede jugar');
  assert.deepStrictEqual(r.problemas, [
    'La etiqueta 2 está sin escribir.',
    'La etiqueta 3 está sin escribir.',
  ], 'y se dice CUÁL: «hay una etiqueta vacía» obliga a buscarla a ojo');

  const sinDibujo = revisarActividad(act('diagram', { image: null, pins: [{ id: 'p', label: 'Hoja', x: .5, y: .5 }] }));
  assert.ok(sinDibujo.problemas.includes('Falta el dibujo de fondo.'));
  ok('el caso real: dibujo con etiquetas en blanco → no está listo, y se nombra cada etiqueta');
}

// ── El título es el primer dato (decisión del dueño) ─────────────────────────
{
  const pins = [{ id: 'p', label: 'Hoja', x: .5, y: .5 }];
  const contenido = { image: 'data:image/png;base64,AA', pins };
  for (const t of ['', '   ', 'Sin título']) {
    const r = revisarActividad(act('diagram', contenido, t));
    assert.ok(r.problemas.includes('Falta el título de la actividad.'), `«${t}» no es un título`);
  }
  // CONTRA-PRUEBA: con todo puesto, se juega. Una regla que nunca deja pasar
  // nada es igual de inútil que no tenerla.
  const buena = revisarActividad(act('diagram', contenido, 'Partes de la planta'));
  assert.deepStrictEqual(buena.problemas, []);
  assert.strictEqual(buena.listo, true, 'CONTRA-PRUEBA: completa y con título → se juega');
  ok('el título vacío (o «Sin título») es un dato que falta, y con todo puesto se juega');
}

// ── Vacía del todo: se pide UNA cosa, no una lista de reproches ──────────────
{
  const r = revisarActividad(act('diagram', { image: null, pins: [] }, 'Plantas'));
  assert.deepStrictEqual(r.problemas, ['Todavía no tiene contenido.'],
    'sin nada escrito no se enumera además cada campo que falta: abruma y no dice qué hacer');
  assert.ok(r.primerPaso.length > 20, 'y viene con el primer paso que enseña el editor');
  // La frase NO declina el nombre del elemento: «ninguna par» / «ninguna
  // elemento» salían de intentarlo. Quien sabe decirlo bien es la plantilla.
  assert.ok(!/ningun/i.test(r.problemas[0]), 'nada de artículos que no concuerdan');
  ok('la actividad vacía pide UNA cosa, y el «cómo» lo dice la plantilla en su primer paso');
}

// ── Lo que hace injugable a cada modelo ──────────────────────────────────────
{
  // Sin respuesta marcada, TODO cuenta como fallo y nadie se entera hasta el podio.
  const quiz = revisarActividad(act('quiz', { items: [
    { id: 'q1', question: '¿2+2?', options: ['3', '4'], answerIdx: [1] },
    { id: 'q2', question: '¿Capital?', options: ['Lima', 'Quito'], answer: '' },
    { id: 'q3', question: '', options: ['a', 'b'], answerIdx: [0] },
  ] }));
  assert.deepStrictEqual(quiz.problemas, [
    'La pregunta 2 no tiene marcada la respuesta correcta.',
    'La pregunta 3 está sin escribir.',
  ]);

  // CONTRA-PRUEBA que costó un fallo de la matriz: Operaciones usa el MISMO
  // modelo `qa` pero con respuesta ABIERTA (teclado numérico). Exigirle dos
  // opciones la dejaba injugable — el aviso correcto para una plantilla es una
  // pared para la de al lado.
  const abierta = revisarActividad(act('math', { items: [
    { id: 'm1', question: '2 × 6', answer: '12', points: 1 },
  ] }));
  assert.deepStrictEqual(abierta.problemas, [], 'una pregunta de respuesta abierta no necesita opciones');
  const unaOpcion = revisarActividad(act('quiz', { items: [
    { id: 'q1', question: '¿2+2?', options: ['4', ''], answerIdx: [0] },
  ] }));
  assert.deepStrictEqual(unaOpcion.problemas, ['La pregunta 1 necesita al menos dos opciones.'],
    'pero si SÍ juega con opciones, una sola no es una elección');

  const parejas = revisarActividad(act('match', { pairs: [
    { id: 'p1', left: 'gato', right: 'cat' },
    { id: 'p2', left: 'perro', right: '' },
  ] }));
  assert.deepStrictEqual(parejas.problemas, ['La pareja 2 está a medias: necesita sus dos lados.']);
  // Una pareja de IMÁGENES está completa aunque no tenga texto.
  const conImagen = revisarActividad(act('match', { pairs: [
    { id: 'p1', left: '', leftImage: 'data:image/png;base64,AA', right: 'gato' },
  ] }));
  assert.deepStrictEqual(conImagen.problemas, [], 'una pareja con imagen en un lado está completa');
  ok('cada modelo dice lo suyo: sin respuesta marcada · pareja a medias · y la imagen cuenta como lado');
}

// ── Lo que la revisión de código cazó (v1.51.475) ────────────────────────────
{
  // (0) LAS DOS REGRESIONES: se prueban por el camino REAL (`newActivity`), no
  //     con objetos a mano — las dos se colaron precisamente porque el test
  //     construía el ítem a mano y la app lo construye con `newEmpty()`.
  //     · Operaciones: `newEmpty` del modelo `qa` siembra 4 opciones VACÍAS, así
  //       que «tiene array de opciones» la dejaba injugable con teclado numérico.
  //     · Quiz recién creado: `points: 1` contaba como «algo escrito», así que
  //       nacía con la lista roja en vez de la pista azul.
  const mates = newActivity('math');
  mates.title = 'Tablas del 2';
  mates.content.items = [{ id: 'm1', question: '2 × 6', answer: '12', options: ['', '', '', ''], points: 1 }];
  assert.deepStrictEqual(revisarActividad(mates).problemas, [],
    'una operación de respuesta abierta se juega, aunque el modelo le siembre opciones vacías');
  for (const t of ['quiz', 'math', 'match', 'memory', 'diagram', 'wheel', 'tildes']) {
    assert.strictEqual(revisarActividad(newActivity(t)).vacia, true,
      `${t} recién creada está VACÍA (pista azul), no «a medias» (lista roja)`);
  }

  // (a) Marcada pero SIN TEXTO: borrar la opción marcada dejaba `answerIdx`
  //     apuntando a un hueco. El revisor decía «lista» y el scorer daba 0 a
  //     todo — el mismo agujero que este guardián venía a cerrar.
  const huecoMarcado = revisarActividad(act('quiz', { items: [
    { id: 'q1', question: '¿2+2?', options: ['', 'tres'], answerIdx: [0] },
  ] }));
  assert.deepStrictEqual(huecoMarcado.problemas, ['La pregunta 1 no tiene marcada la respuesta correcta.'],
    'una marca sobre una opción vacía no es una respuesta');

  // (b) Las filas EN BLANCO son sitio libre, no error: Emparejar siembra 4 al
  //     crear la actividad y los players ya las ignoran al jugar.
  const conHuecos = revisarActividad(act('match', { pairs: [
    { id: 'p1', left: 'gato', right: 'cat' },
    { id: 'p2', left: '', right: '' },
    { id: 'p3', left: '', right: '' },
  ] }));
  assert.deepStrictEqual(conHuecos.problemas, [], 'las filas en blanco no se reprochan');
  assert.strictEqual(conHuecos.jugable, true);

  // (c) El TÍTULO se reclama, pero NO cierra la puerta del juego: `migrate` pone
  //     «Sin título» por defecto y eso dejaría injugable una actividad completa
  //     traída del banco compartido.
  const sinTitulo = revisarActividad(act('match', { pairs: [{ id: 'p1', left: 'a', right: 'b' }] }, ''));
  assert.strictEqual(sinTitulo.listo, false, 'el editor sigue pidiendo el título');
  assert.strictEqual(sinTitulo.jugable, true, 'pero el título no impide JUGAR lo que está completo');
  assert.deepStrictEqual(sinTitulo.problemasDeJuego, []);

  // (d) «Vacía» lo decide UN criterio (¿hay algo escrito?), no un contador de
  //     filas: con las 4 parejas sembradas en blanco, la actividad está vacía.
  const reciennacida = act('match', { pairs: [{ id: 'p1', left: '', right: '' }] }, 'X');
  assert.strictEqual(sinEscribirNada(reciennacida), true, 'filas sembradas en blanco = nada escrito');
  assert.strictEqual(revisarActividad(reciennacida).vacia, true, 'y el jugador ve la pista, no la lista de reproches');
  ok('los siete hallazgos de la revisión: marca sin texto · filas en blanco · el título no cierra la puerta · un solo criterio de «vacía»');
}

// ── GUARDARRAÍL DE DESCUBRIMIENTO ────────────────────────────────────────────
// La lección de la tarjeta única: una lista enumerada vigila el pasado. Se
// recorren las plantillas REGISTRADAS y se exige que el modelo de cada una esté
// cubierto — una plantilla o un modelo nuevo sin revisor rompe CI en vez de
// dejar pasar contenido a medias en silencio.
{
  const cubiertos = new Set(modelosRevisados());
  const huerfanos = [...new Set(listTemplates()
    // Las de contenido GENERADO no tienen nada escrito que revisar y lo DECLARAN
    // (`editor.generado`). Antes tenían una entrada que devolvía [] solo para
    // que esta prueba pasara, y así «sin revisor» significaba dos cosas: «no hay
    // nada que revisar» y «modelo nuevo que se nos olvidó».
    .filter(T => !T.meta?.editor?.generado)
    .map(T => T.meta?.contentModel)
    .filter(m => m && !cubiertos.has(m)))];
  assert.deepStrictEqual(huerfanos, [],
    `modelos de contenido sin revisor en core/activityCheck.js: ${huerfanos.join(', ')}`);

  // Y ninguna plantalla registrada revienta al revisarla vacía.
  for (const T of listTemplates()) {
    const r = revisarActividad(migrate({ id: 'x', template: T.meta.name, title: '', schemaVersion: SCHEMA_VERSION }));
    assert.ok(Array.isArray(r.problemas), `${T.meta.name} se revisa sin romper`);
  }
  ok(`las ${listTemplates().length} plantillas registradas tienen revisor y ninguna rompe al revisarla vacía`);
}

console.log(`\n  ${passed} activityCheck checks passed`);
