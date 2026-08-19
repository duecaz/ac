// LA IA QUE ESCRIBE CONTENIDO — el núcleo, probado SIN RED.
//
// Todo con respuestas GRABADAS: lo que se prueba no es que el modelo acierte
// (eso no lo decide un test), sino que NADA entre en la actividad del profe sin
// pasar la revisión. Cada caso de abajo es una forma concreta en que un modelo
// de lenguaje mete la pata y que, sin revisar, se paga con la clase delante.
//
// Run: node tests/aiContent.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { interpretarRespuesta, fusionarContenido, pedirContenido, MODELOS_IA, iaSabeEscribir }
  from '../core/aiContent.js';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── Forma de la respuesta ────────────────────────────────────────────────────
{
  // El envoltorio ```json … ``` es el error más común y más tonto: no puede
  // costar una generación entera.
  const r = interpretarRespuesta('items', '```json\n[{"pregunta":"¿Capital de Perú?"}]\n```');
  assert.strictEqual(r.error, null);
  assert.strictEqual(r.piezas, 1);
  assert.strictEqual(r.content.items[0].question, '¿Capital de Perú?');

  assert.ok(interpretarRespuesta('items', 'esto no es json').error, 'un texto suelto no revienta: se dice');
  assert.ok(interpretarRespuesta('items', '{"algo":1}').error, 'sin lista de elementos, se dice');
  assert.ok(interpretarRespuesta('inventado', '[]').error, 'un modelo que no existe no se intenta');
  ok('lee la respuesta con envoltorio, y lo que no se puede leer lo DICE (no lo cuela a medias)');
}

// ── qa · el distractor que TAMBIÉN es correcto ───────────────────────────────
{
  const r = interpretarRespuesta('qa', JSON.stringify([
    // Trampa: «Ciudad de México» es la respuesta escrita de otra forma. Si entra
    // como opción falsa, el alumno la toca, acierta, y la app le dice que no.
    { pregunta: '¿Capital de México?', respuesta: 'México D.F.',
      opciones: ['México D.F.', 'mexico d.f.', 'Lima', 'Bogotá'] },
    { pregunta: 'Sin respuesta', opciones: ['a', 'b'] },
    { respuesta: 'Sin enunciado', opciones: ['a', 'b'] },
    { pregunta: 'Sin opciones falsas', respuesta: 'X', opciones: ['X', 'x'] },
  ]));
  assert.strictEqual(r.piezas, 1, 'solo sobrevive la buena');
  const it = r.content.items[0];
  assert.strictEqual(it.options.filter(o => o.toLowerCase().replace(/\s/g, '') === 'méxicod.f.'.replace(/\s/g, '')).length, 1,
    'la respuesta aparece UNA vez: el duplicado disfrazado se quita');
  assert.strictEqual(it.options[it.answerIdx[0]], it.answer, 'answerIdx apunta a la respuesta de verdad');
  assert.strictEqual(r.descartadas.length, 3);
  ok('qa: quita el distractor que también era correcto, y descarta lo que no se puede usar');
}

// ── pairs · uno a uno ────────────────────────────────────────────────────────
{
  const r = interpretarRespuesta('pairs', JSON.stringify([
    { izquierda: 'perro', derecha: 'dog' },
    // Trampa: «perro» ya está a la izquierda. Con las dos, el juego marca error
    // a quien une bien — y por la forma del JSON no se ve nada raro.
    { izquierda: 'Perro', derecha: 'can' },
    { izquierda: 'gato', derecha: 'DOG' },
    { izquierda: 'sol', derecha: '' },
    { izquierda: 'luna', derecha: 'moon' },
  ]));
  assert.deepStrictEqual(r.content.pairs.map(p => [p.left, p.right]),
    [['perro', 'dog'], ['luna', 'moon']]);
  assert.strictEqual(r.descartadas.length, 3, 'la repetida por cada lado y la incompleta');
  ok('pairs: exige uno a uno — «perro» no puede emparejar con dos cosas');
}

// ── words · palabra suelta, y la pista que regala la respuesta ───────────────
{
  const r = interpretarRespuesta('words', JSON.stringify([
    { palabra: 'caballo', pista: 'Animal que se monta' },
    // Trampa: la pista contiene la palabra. Se conserva la palabra y se tira la
    // pista, que es lo que sirve; tirar la palabra sería peor.
    { palabra: 'perro', pista: 'El perro es el mejor amigo del hombre' },
    { palabra: 'oso hormiguero', pista: 'Come hormigas' },
    { palabra: 'CABALLO', pista: 'Repetida' },
    { palabra: 'a', pista: 'Muy corta' },
  ]));
  assert.deepStrictEqual(r.content.words.map(w => w.word), ['CABALLO', 'PERRO']);
  assert.strictEqual(r.content.words[0].clue, 'Animal que se monta');
  assert.strictEqual(r.content.words[1].clue, '', 'la pista que contenía la palabra se descarta');
  assert.ok(r.descartadas.some(d => /oso hormiguero/i.test(d)), 'dos palabras no caben en la rejilla');

  // Sopa de Letras guarda cadenas sueltas; Crucigrama, fichas con pista. Se pide
  // una vez y se aplana, en vez de generar dos veces.
  const sopa = interpretarRespuesta('words', JSON.stringify([{ palabra: 'gato', pista: 'Maúlla' }]),
    { palabrasComoTexto: true });
  assert.deepStrictEqual(sopa.content.words, ['GATO']);
  ok('words: una sola palabra de letras, sin repetir, y la pista no puede contener la palabra');
}

// ── textCorrection · las posiciones NO las calcula la IA ─────────────────────
{
  // Era el mayor riesgo del plan: pedirle índices a un modelo y que un carácter
  // de desplazamiento marque mal al alumno que acierta. Se le pide la frase BIEN
  // ESCRITA y `parseRichText` deriva texto+marcas — el mismo camino que una
  // frase pegada a mano en el editor.
  const r = interpretarRespuesta('textCorrection', JSON.stringify([
    { frase: 'El pájaro cantó, y después voló.' },
    { frase: 'Frase sin nada que corregir' },
  ]));
  assert.strictEqual(r.piezas, 1, 'una frase sin tildes ni comas no da juego: se descarta');
  const p = r.content.passages[0];
  assert.ok(!/[áéíóú,]/i.test(p.text), 'el texto guardado va SIN tildes ni comas: es lo que el alumno corrige');
  assert.ok(p.marks.length >= 3, 'y las marcas salen derivadas, no inventadas');
  for (const m of p.marks) {
    assert.ok(m.pos >= 0 && m.pos < p.text.length, `la marca ${m.pos} cae dentro del texto`);
    if (m.kind === 'tilde') assert.ok(/[aeiou]/i.test(p.text[m.pos]), 'una tilde cae sobre una vocal');
  }
  ok('textCorrection: la IA escribe la frase, el código deriva las posiciones exactas');
}

// ── Añadir, nunca reemplazar ─────────────────────────────────────────────────
{
  const actual = { items: [{ id: 'q_mio', question: 'La mía', answer: 'X', options: ['X', 'Y'] }] };
  const fus = fusionarContenido(actual, { items: [{ id: 'q_ia', question: 'De la IA' }] });
  assert.deepStrictEqual(fus.items.map(i => i.id), ['q_mio', 'q_ia'],
    'lo escrito a mano se conserva y va PRIMERO');
  assert.strictEqual(actual.items.length, 1, 'no muta lo que le dan');

  // La pieza en blanco con la que nacen las plantillas (R-D) no es trabajo del
  // profe: conservarla dejaría un hueco delante de lo que escribió la IA.
  const conHueco = fusionarContenido({ items: [{ id: 'q_vacio', question: '' }] },
    { items: [{ id: 'q_ia', question: 'De la IA' }] });
  assert.deepStrictEqual(conHueco.items.map(i => i.id), ['q_ia']);
  ok('fusionar AÑADE (nunca pisa lo escrito a mano) y se come el hueco vacío del principio');
}

// ── La petición: sin red, y cada fallo con su motivo ─────────────────────────
{
  const respuesta = (status, cuerpo) => async () => ({
    ok: status < 400, status, json: async () => cuerpo,
  });
  const base = { modelo: 'items', tema: 'ríos', url: 'http://x/ia', cantidad: 3 };

  const bien = await pedirContenido({ ...base,
    fetchFn: respuesta(200, { contenido: [{ pregunta: '¿Qué río es el más largo?' }] }) });
  assert.strictEqual(bien.piezas, 1);

  // R6 · cada fallo dice QUÉ pasó: son cosas distintas y se resuelven distinto.
  const falla = async (status, cuerpo) => {
    try { await pedirContenido({ ...base, fetchFn: respuesta(status, cuerpo) }); return null; }
    catch (e) { return e.message; }
  };
  assert.match(await falla(401), /cuenta/i, '401: hay que entrar');
  assert.match(await falla(429, { message: 'Máximo 20 al día.' }), /20 al día/, '429: el tope, con su cifra');
  assert.match(await falla(503), /no está configurada/i, '503: falta la clave en el servidor');
  const sinRed = await (async () => {
    try { await pedirContenido({ ...base, fetchFn: async () => { throw new Error('offline'); } }); }
    catch (e) { return e.message; }
  })();
  assert.match(sinRed, /conexión/i, 'sin red: lo dice, y es lo que el profe puede arreglar');

  await assert.rejects(() => pedirContenido({ ...base, tema: '  ' }), /de qué va/i,
    'sin tema no se gasta una llamada');
  ok('pedir: el camino bueno funciona y cada fallo trae su motivo (R6)');
}

// ── El cuadro y el hook no pueden desincronizarse ────────────────────────────
{
  const modelos = Object.keys(MODELOS_IA);
  assert.ok(modelos.length >= 5, 'los cinco modelos escribibles');
  for (const m of modelos) {
    assert.ok(MODELOS_IA[m].etiqueta && MODELOS_IA[m].elemento && MODELOS_IA[m].describe,
      `${m} declara etiqueta, elemento y qué se le pide`);
    assert.ok(iaSabeEscribir(m));
  }
  assert.ok(!iaSabeEscribir('ballsort'), 'Pelotas genera sus tableros sola: la IA no entra');
  assert.ok(!iaSabeEscribir('diagram'), 'Diagrama necesita una imagen: la IA no entra');
  ok(`los ${modelos.length} modelos escribibles declaran lo suyo (y los dos que no, fuera)`);

  // EL CUADRO DEL HOOK Y EL DE AQUÍ NO PUEDEN DESINCRONIZARSE. El prompt vive en
  // la Pi a propósito (si el navegador mandara instrucciones, el extremo sería
  // un modelo de lenguaje gratis), y eso deja DOS listas de modelos en dos
  // runtimes distintos. Un modelo nuevo que se declare aquí y no allí devolvería
  // «tipo de contenido desconocido» al tocar el botón. Se comprueba leyendo el
  // fichero del hook: es la única forma de atarlos sin una Pi delante.
  const hook = readFileSync(join(ROOT, 'pb_hooks/aulareto.pb.js'), 'utf8');
  const sinEsquema = modelos.filter(m => !new RegExp(`\\b${m}\\s*:`).test(hook.split('const PROVEEDORES')[0]));
  assert.deepStrictEqual(sinEsquema, [],
    `modelos declarados en MODELOS_IA sin esquema en pb_hooks/aulareto.pb.js: ${sinEsquema.join(', ')}`);
  // CONTRA-PRUEBA: la comprobación mira de verdad (si no, pasaría con cualquier cosa).
  assert.ok(!/\bballsort\s*:/.test(hook.split('const PROVEEDORES')[0]),
    'y el hook no declara esquemas de más');
  ok('los esquemas del hook cubren los mismos modelos que el cliente (no pueden divergir)');
}

console.log(`\naiContent.test: ${passed} checks passed`);
