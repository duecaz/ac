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
// ⚠️ CADA HANDLER CORRE EN UN RUNTIME APARTE Y NO VE EL ÁMBITO EXTERIOR.
// Es la trampa nº1 de los hooks de PocketBase, y este fichero cayó en ella: con
// las constantes declaradas aquí arriba, la ruta devolvía un 400 seco («Something
// went wrong…») porque el callback reventaba con un ReferenceError antes de
// hacer nada. Por eso TODO lo compartido vive en `aulareto-lib.js` y cada
// handler hace su propio `require()` DENTRO. No mover nada fuera de un handler.
//
// INSTALACIÓN (una vez, en la Pi):
//   curl -fsSL https://raw.githubusercontent.com/duecaz/ac/main/tools/pi-instalar-hook.sh | bash
//   Luego, en #/admin: «Crear colecciones» y pegar la clave.
//   Sin clave, el extremo responde 503 y la app lo DICE en vez de fallar raro.
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

// ── EL PERMISO DEL NAVEGADOR (CORS) ──────────────────────────────────────────
// El navegador, ANTES de un POST con cabeceras propias (Authorization y
// Content-Type), manda una petición OPTIONS preguntando si puede. Si esa no
// responde bien, el `fetch` LANZA —no devuelve un error, lanza— y en la app se
// veía como «No se pudo conectar. Comprueba la conexión a internet», con la
// conexión perfectamente. Desde la Pi funcionaba porque `curl` en localhost no
// hace ninguna de estas dos cosas.
//
// PocketBase pone sus propias cabeceras CORS, pero solo para las rutas que
// conoce; una ruta añadida a mano solo para POST puede dejar el OPTIONS sin
// respuesta. Se contesta explícitamente, que es barato y quita la duda.
routerAdd('OPTIONS', '/api/ia/contenido', (e) => {
  const lib = require(`${__hooks}/aulareto-lib.js`);
  lib.permitirNavegador(e);
  return e.noContent(204);
});
routerAdd('OPTIONS', '/api/ia/estado', (e) => {
  const lib = require(`${__hooks}/aulareto-lib.js`);
  lib.permitirNavegador(e);
  return e.noContent(204);
});

// ── ¿ESTÁ ESTO PUESTO? ───────────────────────────────────────────────────────
// Un extremo que NO gasta una generación. Sin él, la única forma de saber si el
// hook está instalado era pedirle contenido de verdad a Gemini — y si algo
// fallaba, no se distinguía «no está el hook» de «la clave está mal». Como la
// ruta solo existe si el fichero está cargado, un 404 aquí YA es la respuesta.
// No devuelve la clave ni un trozo de ella: solo si hay una y de dónde salió.
routerAdd('GET', '/api/ia/estado', (e) => {
  const lib = require(`${__hooks}/aulareto-lib.js`);
  lib.permitirNavegador(e);
  const cfg = lib.leerConfigIA();
  return e.json(200, {
    instalado: true,
    configurado: !!cfg.clave,
    proveedor: cfg.proveedor || null,
    origen: cfg.origen,
    // De DÓNDE salió y, si no salió, POR QUÉ. Sin esto, «configurado:false» era
    // indistinguible de «la clave está mal guardada» y de «esta versión de
    // PocketBase no entiende la llamada».
    via: cfg.via || null,
    motivo: cfg.error || null,
    topeDiario: lib.TOPE_DIARIO,
  });
});

// ── ESCRIBIR CONTENIDO ───────────────────────────────────────────────────────
routerAdd('POST', '/api/ia/contenido', (e) => {
  const lib = require(`${__hooks}/aulareto-lib.js`);
  lib.permitirNavegador(e);

  const cfg = lib.leerConfigIA();
  const proveedor = lib.PROVEEDORES[cfg.proveedor];
  if (!cfg.clave || !proveedor) {
    // El motivo VIAJA: «no está configurada» a secas dejaba al dueño mirando la
    // clave sin saber si el problema era ella, la fila o la lectura (R6).
    return e.json(503, { message: 'La IA no está configurada en el servidor.'
      + (cfg.error ? ' Motivo: ' + cfg.error : '')
      + (!proveedor && cfg.proveedor ? ' Proveedor desconocido: ' + cfg.proveedor : '') });
  }

  // SESIÓN OBLIGATORIA: escribir contenido es acto de profe (§22), y sin esto
  // el extremo sería un modelo de lenguaje abierto a internet.
  const auth = e.auth;
  if (!auth || !auth.id) return e.json(401, { message: 'Entra con tu cuenta para usar la IA.' });

  const datos = new DynamicModel({ modelo: '', tema: '', cantidad: 0, curso: '' });
  e.bindBody(datos);

  const esquema = lib.ESQUEMAS[datos.modelo];
  if (!esquema) return e.json(400, { message: 'Tipo de contenido desconocido.' });
  const tema = String(datos.tema || '').trim().slice(0, 300);
  if (!tema) return e.json(400, { message: 'Falta el tema.' });
  const cantidad = Math.max(1, Math.min(lib.MAX_ELEMENTOS, parseInt(datos.cantidad, 10) || 8));
  const curso = String(datos.curso || '').trim().slice(0, 120);

  // TOPE POR PROFE Y DÍA. El coste lo paga el dueño, así que una clase entera
  // no puede vaciarle la cuota. Se cuenta en una colección propia (`ia_usos`).
  const hoy = new Date().toISOString().slice(0, 10);
  let usos = 0;
  try {
    usos = $app.countRecords('ia_usos', $dbx.exp('profe = {:p} AND dia = {:d}', { p: auth.id, d: hoy }));
  } catch (err) {
    // best-effort: si la colección aún no existe, se deja pasar en vez de
    // bloquear la función entera. Queda en el log, no en silencio (R6).
    $app.logger().warn('IA: no se pudo contar ia_usos', 'error', String(err));
    usos = 0;
  }
  if (usos >= lib.TOPE_DIARIO) {
    return e.json(429, { message: 'Has llegado a ' + lib.TOPE_DIARIO + ' generaciones hoy. Mañana se renueva.' });
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
      url: proveedor.url(cfg.clave),
      method: 'POST',
      headers: proveedor.cabeceras(cfg.clave),
      body: JSON.stringify(proveedor.cuerpo(sistema, usuario)),
      timeout: 60,
    });
  } catch (err) {
    $app.logger().error('IA: no se pudo llamar al proveedor', 'error', String(err));
    return e.json(502, { message: 'No se pudo hablar con la IA. Inténtalo otra vez.' });
  }
  if (res.statusCode >= 400) {
    // El cuerpo del proveedor NO se reenvía: puede traer la clave o detalles de
    // la cuenta. Se registra en el servidor y al profe le llega lo accionable.
    $app.logger().error('IA: el proveedor respondió ' + res.statusCode, 'proveedor', cfg.proveedor);
    return e.json(502, { message: 'La IA no pudo responder (' + res.statusCode + '). '
      + 'Si se repite, revisa la clave en el panel.' });
  }

  const texto = proveedor.texto(res.json);
  if (!texto) return e.json(502, { message: 'La IA devolvió una respuesta vacía.' });

  // Se apunta el uso DESPUÉS de que haya salido bien: un fallo del proveedor no
  // debe gastarle una generación al profe.
  try {
    const coll = $app.findCollectionByNameOrId('ia_usos');
    const rec = new Record(coll);
    rec.set('profe', auth.id);
    rec.set('dia', hoy);
    rec.set('modelo', datos.modelo);
    $app.save(rec);
  } catch (err) {
    // best-effort: no contar un uso es preferible a perder el contenido ya
    // generado y cobrado al proveedor. Queda en el log.
    $app.logger().warn('IA: no se pudo apuntar el uso', 'error', String(err));
  }

  return e.json(200, { contenido: texto });
});
