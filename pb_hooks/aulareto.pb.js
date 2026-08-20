/// <reference path="../pb_data/types.d.ts" />
//
// EL ÚNICO TROZO DE SERVIDOR DEL PROYECTO — la Pi llama a la IA para que la
// CLAVE no tenga que viajar al navegador.
//
// Por qué existe: AulaReto es una web estática (GitHub Pages). Todo lo que
// llega al navegador se puede leer, así que una clave de Gemini o de Grok
// —que cuesta dinero y se puede usar fuera de aquí— no puede vivir en el
// código ni en una colección que el navegador consulte. Este hook la guarda y
// hace la llamada; al navegador solo vuelve el contenido.
//
// INSTALACIÓN (una vez, en la Pi):
//   1. Copiar este fichero a  pb_hooks/aulareto.pb.js  junto al binario de PB.
//      En Docker, montar la carpeta:   ./pb_hooks:/pb_hooks   y reiniciar.
//   2. En #/admin → «Crear colecciones» (crea `ia_config` e `ia_usos`).
//   3. En #/admin → «IA que escribe contenido»: proveedor + clave.
//   Sin clave, el extremo responde 503 y la app lo DICE («la IA todavía no está
//   configurada») en vez de fallar de forma rara.
//
// DÓNDE ESTÁ LA CLAVE Y POR QUÉ AHÍ: en la colección `ia_config`, con sus CINCO
// reglas a `null` (core/pbRules.js) — ni un profe con sesión puede leerla. Este
// hook sí, porque el código de servidor se salta las reglas. Se admite también
// `WW_IA_CLAVE` por entorno para quien prefiera no tenerla en la base.
//
// LO QUE ESTE FICHERO **NO** HACE, a propósito:
//   · No acepta un prompt del navegador. Recibe DATOS (modelo, tema, cantidad,
//     curso) y arma él las instrucciones. Si aceptara texto libre, cualquiera
//     con una cuenta de profe tendría un modelo de lenguaje gratis pagado por
//     el dueño.
//   · No revisa el contenido. Eso lo hace `core/aiContent.js` en el navegador,
//     que es donde se puede probar sin red y donde ya viven las reglas de cada
//     modelo. Aquí solo se traslada.
//
// El cuadro de ESQUEMAS de abajo tiene que cubrir los mismos modelos que
// `MODELOS_IA` en core/aiContent.js. No se confía en que alguien se acuerde:
// lo comprueba `tests/aiContent.test.mjs` leyendo este fichero.

const TOPE_DIARIO = 30;          // generaciones por profe y día
const MAX_ELEMENTOS = 20;

// LEER LA CONFIGURACIÓN — y DECIR por qué si no se puede.
//
// La primera versión envolvía esto en un `try {} catch {}` mudo: cuando el dueño
// guardó su clave de Gemini, el panel decía «guardada» y acto seguido «falta la
// clave», sin ninguna pista de cuál de los dos era mentira. Un catch vacío
// alrededor de algo que el usuario acaba de pedir es justo lo que la regla
// `fallo-mudo` prohíbe en el resto del proyecto, y aquí faltó aplicarla.
//
// Dos caminos a propósito: `findFirstRecordByFilter` es lo natural, pero si esa
// firma o la sintaxis del filtro no son las de ESTA versión de PocketBase, el
// segundo camino (traer las filas y mirarlas en JavaScript) funciona igual. No
// se puede probar desde el repo contra una Pi real, así que se prueban las dos
// y se informa de cuál valió.
function leerConfigIA() {
  const out = {
    proveedor: ($os.getenv('WW_IA_PROVEEDOR') || '').toLowerCase(),
    clave: $os.getenv('WW_IA_CLAVE') || '',
    origen: '',
    via: '',
    error: '',
  };
  if (out.clave) { out.origen = 'entorno'; out.via = 'env'; }

  let fila = null;
  try {
    fila = $app.findFirstRecordByFilter('ia_config', 'clave != ""');
    if (fila) out.via = 'findFirstRecordByFilter';
  } catch (e) {
    out.error = 'filtro: ' + String(e && e.message ? e.message : e);
  }
  if (!fila) {
    try {
      const todas = $app.findAllRecords('ia_config');
      for (let i = 0; i < todas.length; i++) {
        if (todas[i].getString('clave')) { fila = todas[i]; out.via = 'findAllRecords'; break; }
      }
      if (!fila && todas.length) out.error = 'hay ' + todas.length + ' fila(s) en ia_config pero ninguna con clave';
      if (!fila && !todas.length) out.error = out.error || 'ia_config está vacía';
    } catch (e2) {
      out.error = (out.error ? out.error + ' · ' : '') + 'lectura: ' + String(e2 && e2.message ? e2.message : e2);
    }
  }
  if (fila) {
    out.clave = fila.getString('clave') || out.clave;
    out.proveedor = (fila.getString('proveedor') || out.proveedor).toLowerCase();
    out.origen = 'ia_config';
    out.error = '';
  }
  if (!out.proveedor) out.proveedor = 'gemini';
  if (!out.clave && !out.origen) out.origen = 'ninguno';
  if (out.error) $app.logger().warn('IA: no se pudo leer ia_config', 'motivo', out.error);
  return out;
}

// Qué se le pide al modelo para cada modelo de contenido. El JSON que se espera
// va descrito aquí porque el prompt es cosa del servidor (ver arriba).
const ESQUEMAS = {
  qa: 'Cada elemento: {"pregunta": string, "respuesta": string, "opciones": [string, string, string, string]}. '
    + '"opciones" incluye la respuesta correcta y TRES opciones falsas. Ninguna opción falsa puede ser '
    + 'también correcta ni una forma distinta de escribir la respuesta.',
  pairs: 'Cada elemento: {"izquierda": string, "derecha": string}. Cada lado aparece UNA sola vez en toda '
    + 'la lista: ningún término puede emparejar con dos cosas.',
  items: 'Cada elemento: {"pregunta": string}. Son preguntas abiertas para responder en voz alta, sin clave.',
  words: 'Cada elemento: {"palabra": string, "pista": string}. La palabra es UNA sola, solo letras, sin '
    + 'espacios ni signos ni números. La pista la define SIN nombrarla ni contenerla.',
  textCorrection: 'Cada elemento: {"frase": string}. La frase va escrita CORRECTAMENTE, con todas sus '
    + 'tildes y sus comas. No incluyas posiciones ni marcas: solo la frase bien escrita. '
    + 'Cada frase debe llevar al menos una tilde o una coma.',
};

// ── Proveedores. Se añade uno tocando SOLO este cuadro. ──────────────────────
const PROVEEDORES = {
  gemini: {
    url: (clave) => 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + clave,
    cuerpo: (sistema, usuario) => ({
      systemInstruction: { parts: [{ text: sistema }] },
      contents: [{ role: 'user', parts: [{ text: usuario }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.8, maxOutputTokens: 4096 },
    }),
    texto: (d) => (d && d.candidates && d.candidates[0] && d.candidates[0].content
      && d.candidates[0].content.parts && d.candidates[0].content.parts[0]
      ? d.candidates[0].content.parts[0].text : ''),
    cabeceras: () => ({ 'Content-Type': 'application/json' }),
  },
  grok: {
    url: () => 'https://api.x.ai/v1/chat/completions',
    cuerpo: (sistema, usuario) => ({
      model: 'grok-2-latest',
      messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    }),
    texto: (d) => (d && d.choices && d.choices[0] && d.choices[0].message ? d.choices[0].message.content : ''),
    cabeceras: (clave) => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + clave }),
  },
};

routerAdd('POST', '/api/ia/contenido', (c) => {
  const cfg = leerConfigIA();
  const proveedor = PROVEEDORES[cfg.proveedor];
  if (!cfg.clave || !proveedor) {
    // El motivo VIAJA: «no está configurada» a secas dejaba al dueño mirando la
    // clave sin saber si el problema era ella, la fila o la lectura (R6).
    return c.json(503, { message: 'La IA no está configurada en el servidor.'
      + (cfg.error ? ' Motivo: ' + cfg.error : '')
      + (!proveedor && cfg.proveedor ? ' Proveedor desconocido: ' + cfg.proveedor : '') });
  }
  const proveedorId = cfg.proveedor;
  const clave = cfg.clave;

  // SESIÓN OBLIGATORIA: escribir contenido es acto de profe (§22), y sin esto
  // el extremo sería un modelo de lenguaje abierto a internet.
  const auth = c.auth;
  if (!auth || !auth.id) return c.json(401, { message: 'Entra con tu cuenta para usar la IA.' });

  const datos = new DynamicModel({ modelo: '', tema: '', cantidad: 0, curso: '' });
  c.bindBody(datos);

  const esquema = ESQUEMAS[datos.modelo];
  if (!esquema) return c.json(400, { message: 'Tipo de contenido desconocido.' });
  const tema = String(datos.tema || '').trim().slice(0, 300);
  if (!tema) return c.json(400, { message: 'Falta el tema.' });
  const cantidad = Math.max(1, Math.min(MAX_ELEMENTOS, parseInt(datos.cantidad, 10) || 8));
  const curso = String(datos.curso || '').trim().slice(0, 120);

  // TOPE POR PROFE Y DÍA. El coste lo paga el dueño, así que una clase entera
  // no puede vaciarle la cuota. Se cuenta en una colección propia (`ia_usos`).
  const hoy = new Date().toISOString().slice(0, 10);
  let usos = 0;
  try {
    usos = $app.countRecords('ia_usos', $dbx.exp('profe = {:p} AND dia = {:d}', { p: auth.id, d: hoy }));
  } catch (e) {
    // best-effort: si la colección aún no existe, se deja pasar en vez de
    // bloquear la función entera. El motivo, escrito (R6).
    usos = 0;
  }
  if (usos >= TOPE_DIARIO) {
    return c.json(429, { message: 'Has llegado a ' + TOPE_DIARIO + ' generaciones hoy. Mañana se renueva.' });
  }

  const sistema = 'Eres un maestro de primaria y secundaria que prepara material para el aula, en español. '
    + 'Respondes SIEMPRE con un array JSON y nada más: sin explicaciones y sin envolverlo en ```. '
    + 'El contenido es para proyectar en clase: enunciados cortos, claros y correctos. '
    + esquema;
  const usuario = 'Tema: ' + tema + '\n'
    + (curso ? 'Para: ' + curso + '\n' : '')
    + 'Escribe exactamente ' + cantidad + ' elementos.';

  let res;
  try {
    res = $http.send({
      url: proveedor.url(clave),
      method: 'POST',
      headers: proveedor.cabeceras(clave),
      body: JSON.stringify(proveedor.cuerpo(sistema, usuario)),
      timeout: 60,
    });
  } catch (e) {
    return c.json(502, { message: 'No se pudo hablar con la IA. Inténtalo otra vez.' });
  }
  if (res.statusCode >= 400) {
    // El cuerpo del proveedor NO se reenvía: puede traer la clave o detalles de
    // la cuenta. Se registra en el servidor y al profe le llega lo accionable.
    $app.logger().error('IA: el proveedor respondió ' + res.statusCode, 'proveedor', proveedorId);
    return c.json(502, { message: 'La IA no pudo responder ahora mismo. Inténtalo otra vez.' });
  }

  const texto = proveedor.texto(res.json);
  if (!texto) return c.json(502, { message: 'La IA devolvió una respuesta vacía.' });

  // Se apunta el uso DESPUÉS de que haya salido bien: un fallo del proveedor no
  // debe gastarle una generación al profe.
  try {
    const coll = $app.findCollectionByNameOrId('ia_usos');
    const rec = new Record(coll);
    rec.set('profe', auth.id);
    rec.set('dia', hoy);
    rec.set('modelo', datos.modelo);
    $app.save(rec);
  } catch (e) {
    // best-effort: no contar un uso es preferible a perder el contenido ya
    // generado y cobrado al proveedor. Queda en el log.
    $app.logger().warn('IA: no se pudo apuntar el uso', 'error', String(e));
  }

  return c.json(200, { contenido: texto });
});

// ── ¿ESTÁ ESTO PUESTO? ───────────────────────────────────────────────────────
// Un extremo que NO gasta una generación. Sin él, la única forma de saber si el
// hook está instalado era pedirle contenido de verdad a Gemini — y si algo
// fallaba, no se distinguía «no está el hook» de «la clave está mal». Como la
// ruta solo existe si el fichero está cargado, un 404 aquí YA es la respuesta.
// No devuelve la clave ni un trozo de ella: solo si hay una.
routerAdd('GET', '/api/ia/estado', (c) => {
  const cfg = leerConfigIA();
  return c.json(200, {
    instalado: true,
    configurado: !!cfg.clave,
    proveedor: cfg.proveedor || null,
    origen: cfg.origen,
    // De DÓNDE salió y, si no salió, POR QUÉ. Sin esto, «configurado:false» era
    // indistinguible de «la clave está mal guardada» y de «esta versión de
    // PocketBase no entiende la llamada». Nunca la clave ni un trozo de ella.
    via: cfg.via || null,
    motivo: cfg.error || null,
    topeDiario: TOPE_DIARIO,
  });
});
