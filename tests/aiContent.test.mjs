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
import { interpretarRespuesta, fusionarContenido, pedirContenido, diagnosticarFalloDeRed, MODELOS_IA, iaSabeEscribir }
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
  // UN `fetch` QUE LANZA SON VARIAS COSAS DISTINTAS, y confundirlas manda a
  // mirar al sitio equivocado: el dueño leyó «comprueba tu internet» con la
  // conexión perfecta y el servidor respondiendo bien. Aquí se comprueba lo
  // mínimo —que se distingue «no hay red» de «hay red y aun así falla»—; el
  // reparto fino de causas lo miden las sondas de `diagnosticarFalloDeRed`.
  const lanza = async () => {
    try { await pedirContenido({ ...base, fetchFn: async () => { throw new Error('boom'); } }); }
    catch (e) { return e.message; }
  };
  // `navigator` en Node es de solo lectura: se sustituye con defineProperty.
  const antes = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const fingir = (onLine) => Object.defineProperty(globalThis, 'navigator',
    { value: { onLine }, configurable: true, writable: true });
  fingir(false);
  assert.match(await lanza(), /Sin conexión/i, 'sin red: se dice, y es lo que el profe puede arreglar');
  fingir(true);
  const conRed = await lanza();
  assert.doesNotMatch(conRed, /Sin conexión/i,
    'CON red y aun así falla: NO se culpa a su internet');
  assert.match(conRed, /servidor|navegador/i, 'y el mensaje señala dónde mirar');
  if (antes) Object.defineProperty(globalThis, 'navigator', antes);
  else delete globalThis.navigator;

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
  const lib = readFileSync(join(ROOT, 'pb_hooks/aulareto-lib.js'), 'utf8');
  const esquemas = lib.split('const PROVEEDORES')[0];
  const sinEsquema = modelos.filter(m => !new RegExp(`\\b${m}\\s*:`).test(esquemas));
  assert.deepStrictEqual(sinEsquema, [],
    `modelos declarados en MODELOS_IA sin esquema en pb_hooks/aulareto-lib.js: ${sinEsquema.join(', ')}`);
  // CONTRA-PRUEBA: la comprobación mira de verdad (si no, pasaría con cualquier cosa).
  assert.ok(!/\bballsort\s*:/.test(esquemas), 'y el hook no declara esquemas de más');
  ok('los esquemas del hook cubren los mismos modelos que el cliente (no pueden divergir)');
}

// ── EL HOOK NO PUEDE DECLARAR NADA FUERA DE SUS HANDLERS ─────────────────────
// La trampa nº1 de PocketBase, y costó un 400 en la Pi: cada handler corre en un
// runtime APARTE y NO ve el ámbito exterior, así que una constante declarada
// arriba del fichero simplemente no existe dentro del callback — el handler
// revienta con un ReferenceError y PocketBase lo devuelve como «Something went
// wrong». No se ve en ninguna prueba local porque este fichero no corre aquí:
// solo se puede vigilar leyéndolo.
{
  const hook = readFileSync(join(ROOT, 'pb_hooks/aulareto.pb.js'), 'utf8');
  // Fuera de comentarios, a nivel de línea sin sangrar, solo puede haber
  // `routerAdd(` (y sus cierres). Nada de const/let/var/function.
  const sueltas = hook.split(/\r?\n/)
    .filter(l => /^(const|let|var|function|class)\s/.test(l));
  assert.deepStrictEqual(sueltas, [],
    'pb_hooks/aulareto.pb.js declara cosas FUERA de un handler; los handlers no las verán '
    + `(muévelas a aulareto-lib.js y usa require): ${sueltas.join(' · ')}`);
  // Y lo compartido se pide DENTRO, con require.
  assert.ok(/require\(`\$\{__hooks\}\/aulareto-lib\.js`\)/.test(hook),
    'cada handler debe hacer su propio require del módulo compartido');
  ok('el hook no declara nada fuera de sus handlers (la trampa que devolvía 400)');
}

// ── UN ERROR QUE EL NAVEGADOR NO PUEDE LEER ES UN ERROR PERDIDO ──────────────
// La consola enseñó un 502 bloqueado por no traer cabecera de permiso: la app
// decía «no se pudo conectar» y el motivo —que el servidor SÍ había escrito—
// se quedaba en la Pi. Con `curl` no se ve, porque `curl` no aplica esa
// política. Así que la ruta de contenido responde SIEMPRE por `lib.responder`,
// que vuelve a poner el permiso justo antes de salir.
//
// Y el precio de enseñar el motivo no puede ser la clave: el error de una
// llamada HTTP trae la URL, y la de Gemini lleva la clave DENTRO (`?key=…`).
{
  const hook = readFileSync(join(ROOT, 'pb_hooks/aulareto.pb.js'), 'utf8');
  const post = hook.slice(hook.indexOf("routerAdd('POST', '/api/ia/contenido'"));
  const crudas = post.split(/\r?\n/).filter(l => /\breturn e\.json\(/.test(l));
  assert.deepStrictEqual(crudas, [],
    `la ruta de contenido responde sin volver a poner el permiso (usa lib.responder): ${crudas.join(' · ')}`);
  assert.ok(/} catch \(err\) {[\s\S]*El servidor falló al preparar el contenido/.test(post),
    'y el handler entero va dentro de un try: si revienta, PocketBase responde por él y sin cabeceras');
  // CONTRA-PRUEBA de que el barrido mira donde debe: las rutas de arriba SÍ
  // usan e.json directamente (no pasan por el motivo del profe) y no se cuentan.
  assert.ok(/return e\.json\(200, \{ ok: true \}\)/.test(hook), 'el preflight sigue respondiendo directo');
  ok('todo error de la ruta de contenido sale con permiso de origen (o el navegador lo esconde)');

  // NINGÚN ERROR CON ESTADO 5xx. La prueba desde la Pi lo enseñó de golpe: por
  // 127.0.0.1 el hook contestaba `502 {"message":"La IA no pudo responder
  // (404)"}` —correcto y legible— y por el dominio público llegaba `error code:
  // 502` a secas. Cloudflare sustituye las respuestas de error del origen por su
  // propia página: sin cuerpo, sin cabeceras, invisible para el navegador. Un
  // 4xx pasa intacto. Todo el tiempo que se gastó buscando un fallo de permisos
  // era esto, así que la regla se escribe, no se recuerda.
  const estados = [...post.matchAll(/lib\.responder\(e, (\d{3})/g)].map(m => Number(m[1]));
  assert.ok(estados.length >= 5, 'el barrido tiene que estar viendo las respuestas de verdad');
  assert.deepStrictEqual(estados.filter(s => s >= 500), [],
    'un error 5xx del origen lo sustituye Cloudflare por una página sin cuerpo: usa 424');
  assert.ok(estados.includes(200), 'y el camino bueno sigue devolviendo 200');
  ok('ningún error sale con estado 5xx (Cloudflare se los come y el motivo se pierde)');

  // La redacción, PROBADA: el patrón, no una clave concreta — así tapa también
  // la de mañana. Es el único trozo del hook que se puede ejecutar aquí.
  const { createRequire } = await import('node:module');
  const { sinSecretos } = createRequire(import.meta.url)(join(ROOT, 'pb_hooks/aulareto-lib.js'));
  const real = 'Post "https://generativelanguage.googleapis.com/v1beta/x:generateContent?key=AIzaSyABCDEF123456": dial tcp';
  assert.ok(!sinSecretos(real).includes('AIzaSyABCDEF123456'), 'la clave de la URL no viaja al navegador');
  assert.ok(sinSecretos(real).includes('dial tcp'), 'pero el motivo sí: taparlo todo sería volver al silencio');
  assert.ok(!sinSecretos('Bearer xai-abcdef1234567890').includes('xai-abcdef1234567890'),
    'y la de Grok, que va en la cabecera, tampoco');
  ok('el motivo del fallo viaja limpio de claves (patrón, no lista)');
}

// ── CUANDO `fetch` LANZA, EL MENSAJE TIENE QUE VENIR DE UNA MEDIDA ───────────
// Se gastaron tres arreglos seguidos culpando al permiso de origen (CORS) sin
// una sola medida delante, y el servidor estaba impecable: el diagnóstico desde
// la Pi devolvía 200 y 401 con sus cabeceras, también por el dominio público.
// El navegador no dice por qué lanza, así que hay que preguntárselo con sondas.
// Cada caso de abajo es un fallo REAL distinto que antes se contaba igual —y
// mandaba a arreglar el sitio equivocado.
{
  const URL_IA = 'https://pb.lanube.uno/api/ia/contenido';
  // Un `fetch` de mentira al que se le dice qué sonda funciona y cuál no.
  const falso = (vale) => async (url, opt = {}) => {
    const sonda = (opt.method || 'GET') === 'GET' ? 'estado'
      : opt.mode === 'no-cors' ? 'opaca'
      : opt.headers?.Authorization ? 'sesion'
      : 'simple';
    if (!vale[sonda]) throw new TypeError('Failed to fetch');
    return { ok: true, status: sonda === 'estado' ? 200 : 401 };
  };

  const sinRed = await diagnosticarFalloDeRed({ url: URL_IA, enLinea: false, fetchFn: falso({}) });
  assert.match(sinRed, /Sin conexión/, 'sin red, se dice sin red');

  const nada = await diagnosticarFalloDeRed({ url: URL_IA, fetchFn: falso({}) });
  assert.match(nada, /no consigue llegar al servidor/,
    'si ni el GET simple pasa, no puede ser el permiso de origen del POST');
  assert.ok(nada.includes('/api/ia/estado'), 'y dice QUÉ dirección probar en una pestaña');

  // EL CASO REAL (lo que enseñó la consola): el preflight pasa, la petición
  // llega y el servidor devuelve 502 sin cabecera de permiso. La primera
  // versión de esta sonda decía «falla la comprobación previa» — lo contrario
  // de lo que pasaba — porque probaba con un POST simple, que ni siquiera la
  // dispara. Con sesión de mentira el trámite previo es el mismo que el real.
  const error502 = await diagnosticarFalloDeRed({
    url: URL_IA, fetchFn: falso({ estado: true, sesion: true, simple: true, opaca: true }) });
  assert.match(error502, /respondió con un ERROR/,
    'si la sonda con sesión pasa, el permiso está bien: lo que falla es la respuesta del servidor');
  assert.match(error502, /_\/#\/logs/, 'y dice DÓNDE está el motivo que el navegador oculta');

  const previa = await diagnosticarFalloDeRed({ url: URL_IA, fetchFn: falso({ estado: true, simple: true }) });
  assert.match(previa, /comprobación previa \(CORS\)/,
    'si lo simple pasa y lo de la sesión no, ahí sí es la comprobación previa');
  assert.match(previa, /pi-instalar-hook\.sh/, 'y dice qué hacer, no qué pasó (R6)');

  const respuesta = await diagnosticarFalloDeRed({ url: URL_IA, fetchFn: falso({ estado: true, opaca: true }) });
  assert.match(respuesta, /sin el permiso de origen/,
    'si solo pasa en modo opaco, llega la petición y falta la cabecera en la RESPUESTA');

  const bloqueo = await diagnosticarFalloDeRed({ url: URL_IA, fetchFn: falso({ estado: true }) });
  assert.match(bloqueo, /incógnito|extensión/,
    'si el estado responde pero nada más sale, el sospechoso es el navegador, no la Pi');

  // Las cinco frases son DISTINTAS: si dos coincidieran, la sonda no serviría
  // para nada — que es exactamente el punto de partida de todo esto.
  const frases = new Set([sinRed, nada, error502, previa, respuesta, bloqueo]);
  assert.strictEqual(frases.size, 6, 'cada fallo distinto tiene que decir algo distinto');

  // CONTRA-PRUEBA: ninguna sonda puede gastar una generación. La que lleva
  // Authorization la lleva de MENTIRA — el extremo contesta 401 antes de llamar
  // a nadie — y en ningún caso viaja la sesión de verdad del profe.
  const sesiones = [];
  await diagnosticarFalloDeRed({ url: URL_IA, fetchFn: async (_u, o = {}) => {
    if ((o.method || 'GET') === 'GET') return { ok: true, status: 200 };  // llega al estado…
    if (o.headers?.Authorization) sesiones.push(o.headers.Authorization);
    throw new TypeError('Failed to fetch');                               // …y falla todo POST
  } });
  assert.deepStrictEqual(sesiones, ['sonda'],
    'la única cabecera de sesión que mandan las sondas es una falsa (401 seguro, sin generar)');
  ok('el fallo de red se DIAGNOSTICA con sondas (6 causas, 6 frases) en vez de suponerse');
}

console.log(`\naiContent.test: ${passed} checks passed`);
