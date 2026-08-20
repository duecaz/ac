// BIBLIOTECA DEL HOOK — todo lo que NO es el registro de rutas.
//
// ¿Por qué un fichero aparte? Porque los handlers de PocketBase se ejecutan en
// un runtime SEPARADO y **no ven el ámbito exterior**: constantes y funciones
// declaradas arriba de `aulareto.pb.js` sencillamente no existen dentro del
// callback. La primera versión las tenía ahí y el resultado fue un 400 seco
// («Something went wrong…») en cuanto se tocó la ruta — el handler reventaba
// con un ReferenceError antes de hacer nada.
//
// La vía documentada es esta: el código compartido vive en un módulo y cada
// handler hace `require(`${__hooks}/aulareto-lib.js`)` DENTRO de sí mismo.
// Los globales del JSVM (`$app`, `$os`, `$http`…) sí están disponibles cuando
// la función se EJECUTA, así que pueden usarse aquí dentro sin problema.

const TOPE_DIARIO = 30;          // generaciones por profe y día
const MAX_ELEMENTOS = 20;

// Qué se le pide al modelo para cada modelo de contenido. El JSON esperado se
// describe AQUÍ, en el servidor, y no lo manda el navegador: si el extremo
// aceptara instrucciones libres, cualquiera con una cuenta de profe tendría un
// modelo de lenguaje gratis pagado por el dueño.
//
// Tiene que cubrir los mismos modelos que `MODELOS_IA` en core/aiContent.js.
// No se confía en que alguien se acuerde: lo comprueba tests/aiContent.test.mjs
// leyendo este fichero.
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
// Cuál se pide por defecto. NO es una constante escondida en la URL: el catálogo
// de Google cambia y una clave nueva puede no tener este modelo — que es
// exactamente lo que pasó (Gemini contestaba 404 y desde el navegador solo se
// veía «no se pudo conectar»). Si este no está, se busca uno que sí (ver
// `modeloAlternativoGemini`), en vez de dejar al profe adivinando.
const MODELO_GEMINI = 'gemini-2.0-flash';

const PROVEEDORES = {
  gemini: {
    url: function (clave, modelo) {
      return 'https://generativelanguage.googleapis.com/v1beta/models/'
        + (modelo || MODELO_GEMINI) + ':generateContent?key=' + clave;
    },
    cuerpo: function (sistema, usuario) {
      return {
        systemInstruction: { parts: [{ text: sistema }] },
        contents: [{ role: 'user', parts: [{ text: usuario }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.8, maxOutputTokens: 4096 },
      };
    },
    texto: function (d) {
      return (d && d.candidates && d.candidates[0] && d.candidates[0].content
        && d.candidates[0].content.parts && d.candidates[0].content.parts[0])
        ? d.candidates[0].content.parts[0].text : '';
    },
    cabeceras: function () { return { 'Content-Type': 'application/json' }; },
  },
  grok: {
    url: function () { return 'https://api.x.ai/v1/chat/completions'; },
    cuerpo: function (sistema, usuario) {
      return {
        model: 'grok-2-latest',
        messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
        response_format: { type: 'json_object' },
        temperature: 0.8,
      };
    },
    texto: function (d) {
      return (d && d.choices && d.choices[0] && d.choices[0].message) ? d.choices[0].message.content : '';
    },
    cabeceras: function (clave) {
      return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + clave };
    },
  },
};

// LEER LA CONFIGURACIÓN — y DECIR por qué si no se puede.
//
// La primera versión envolvía esto en un `try {} catch {}` mudo: cuando el dueño
// guardó su clave de Gemini, el panel decía «guardada» y acto seguido «falta la
// clave», sin ninguna pista de cuál de las dos era mentira. Un catch vacío
// alrededor de algo que el usuario acaba de pedir es justo lo que la regla
// `fallo-mudo` prohíbe en el resto del proyecto.
//
// Dos caminos a propósito: `findFirstRecordByFilter` es lo natural, pero si esa
// firma o la sintaxis del filtro no son las de ESTA versión de PocketBase, el
// segundo (traer las filas y mirarlas en JavaScript) funciona igual. Esto no se
// puede probar desde el repo contra una Pi real, así que se prueban los dos y
// se informa de cuál valió.
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
  return out;
}

// EL PERMISO DEL NAVEGADOR (CORS). El navegador, ANTES de un POST con cabeceras
// propias (Authorization, Content-Type), manda un OPTIONS preguntando si puede.
// Si eso no responde bien, el `fetch` LANZA —no devuelve error, lanza— y en la
// app se veía «No se pudo conectar. Comprueba la conexión a internet» con la
// conexión perfecta. Desde la Pi no se notaba porque `curl` en localhost no
// hace preflight ni tiene origen.
function permitirNavegador(e) {
  try {
    const h = e.response.header();
    h.set('Access-Control-Allow-Origin', '*');
    h.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    h.set('Access-Control-Max-Age', '86400');
  } catch (err) {
    // Si esta versión de PocketBase nombra la respuesta de otra forma, no se
    // rompe la petición por ello: puede que las suyas basten. Al log (R6).
    $app.logger().warn('IA: no se pudieron poner las cabeceras CORS', 'error', String(err));
  }
}

// RESPONDER PONIENDO EL PERMISO OTRA VEZ, JUSTO ANTES.
//
// La consola del navegador enseñó lo que ninguna prueba con `curl` podía: la
// petición de verdad llegaba y volvía un 502 **sin** cabecera de permiso, así
// que el navegador escondía el cuerpo — el motivo, precisamente. Con `curl` no
// se veía porque `curl` no aplica esa política y lee la respuesta igual.
//
// Se ponen al empezar el handler, pero si en el camino algo las pisa, el error
// se vuelve INVISIBLE justo cuando más falta hace leerlo. Volver a ponerlas
// aquí es barato y convierte «no se pudo conectar» en una frase que se entiende.
// SI EL MODELO NO EXISTE, PREGUNTAR CUÁLES SÍ.
//
// Gemini contestaba 404 al modelo cableado en la URL. Un 404 de Google no
// significa «clave mala» sino «esa clave no tiene ESE modelo»: el catálogo va
// cambiando y una clave recién sacada puede traer otra generación. Pedirle al
// dueño que adivine el nombre correcto sería trasladarle un problema que el
// servidor puede resolver solo — la API tiene una lista y basta con leerla.
//
// Devuelve el nombre de un modelo que sirva para generar texto, o '' si no hay.
// Se prefiere un «flash»: es el barato y el rápido, y esto se usa con la clase
// delante.
function modeloAlternativoGemini(clave) {
  let res;
  try {
    res = $http.send({ url: 'https://generativelanguage.googleapis.com/v1beta/models?key=' + clave
      + '&pageSize=100', method: 'GET', timeout: 20 });
  } catch (err) {
    $app.logger().warn('IA: no se pudo listar los modelos', 'error', sinSecretos(err));
    return '';
  }
  if (res.statusCode >= 400) return '';
  const lista = (res.json && res.json.models) || [];
  const sirven = [];
  for (let i = 0; i < lista.length; i++) {
    const m = lista[i];
    const metodos = m.supportedGenerationMethods || [];
    if (metodos.indexOf('generateContent') === -1) continue;
    const nombre = String(m.name || '').replace(/^models\//, '');
    if (!nombre || /embedding|vision|image|tts|audio/i.test(nombre)) continue;
    sirven.push(nombre);
  }
  if (!sirven.length) return '';
  for (let i = 0; i < sirven.length; i++) if (/flash/i.test(sirven[i]) && !/lite/i.test(sirven[i])) return sirven[i];
  for (let i = 0; i < sirven.length; i++) if (/flash/i.test(sirven[i])) return sirven[i];
  return sirven[0];
}

// QUITARLE LOS SECRETOS A UN TEXTO ANTES DE ENSEÑARLO.
//
// Para que un error se pueda leer hay que enviarlo, y ahí está la trampa: el
// error de una llamada HTTP suele traer la URL entera, y la de Gemini lleva la
// clave EN la URL (`?key=…`). Enseñar el motivo no puede costar la clave — que
// es la razón de que exista este hook. Se tapa el patrón, no una clave concreta:
// así también cubre la de mañana.
function sinSecretos(txt) {
  return String(txt)
    .replace(/([?&]key=)[^&\s"']+/gi, '$1…')
    .replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, '$1…')
    .replace(/\b(AIza|xai-|sk-)[A-Za-z0-9._\-]{8,}/g, '$1…');
}

function responder(e, status, cuerpo) {
  permitirNavegador(e);
  return e.json(status, cuerpo);
}

module.exports = { TOPE_DIARIO, MAX_ELEMENTOS, ESQUEMAS, PROVEEDORES, leerConfigIA, permitirNavegador, responder, sinSecretos, modeloAlternativoGemini, MODELO_GEMINI };
