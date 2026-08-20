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
//   Sin clave, el extremo responde 424 y la app lo DICE en vez de fallar raro.
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
// Se responde con `e.json`, NO con `e.noContent`: es el único método de
// respuesta que sabemos que funciona en ESTA versión (lo usa la ruta de estado,
// que responde bien desde la Pi). Un método que no exista revienta el handler y
// entonces el preflight falla igual — que es justo lo que se está intentando
// arreglar. Un 200 con cuerpo vale como respuesta al preflight: lo que el
// navegador mira son las cabeceras.
routerAdd('OPTIONS', '/api/ia/contenido', (e) => {
  const lib = require(`${__hooks}/aulareto-lib.js`);
  lib.permitirNavegador(e);
  return e.json(200, { ok: true });
});
routerAdd('OPTIONS', '/api/ia/estado', (e) => {
  const lib = require(`${__hooks}/aulareto-lib.js`);
  lib.permitirNavegador(e);
  return e.json(200, { ok: true });
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
//
// AQUÍ NINGÚN ERROR LLEVA ESTADO 5xx, Y NO ES UN CAPRICHO. La prueba desde la
// Pi lo enseñó de golpe: el hook contestaba `502 {"message":"La IA no pudo
// responder (404)"}` por 127.0.0.1 —correcto y legible— y por pb.lanube.uno
// llegaba `error code: 502` a secas. Cloudflare SUSTITUYE las respuestas de
// error del origen por su propia página: sin cuerpo, sin cabeceras y, por
// tanto, invisible para el navegador. Todo el rato que se pasó buscando un
// problema de permisos era esto.
//
// Un 4xx pasa intacto. Así que los fallos que no son culpa del navegador salen
// como 424 («falló algo de lo que dependo»), que es además lo que de verdad
// ocurre: el que falla es el proveedor, no la petición del profe.
routerAdd('POST', '/api/ia/contenido', (e) => {
  const lib = require(`${__hooks}/aulareto-lib.js`);
  lib.permitirNavegador(e);
  try {
    const cfg = lib.leerConfigIA();
    const proveedor = lib.PROVEEDORES[cfg.proveedor];
    if (!cfg.clave || !proveedor) {
      // El motivo VIAJA: «no está configurada» a secas dejaba al dueño mirando la
      // clave sin saber si el problema era ella, la fila o la lectura (R6).
      return lib.responder(e, 424, { message: 'La IA no está configurada en el servidor.'
        + (cfg.error ? ' Motivo: ' + cfg.error : '')
        + (!proveedor && cfg.proveedor ? ' Proveedor desconocido: ' + cfg.proveedor : '') });
    }

    // SESIÓN OBLIGATORIA: escribir contenido es acto de profe (§22), y sin esto
    // el extremo sería un modelo de lenguaje abierto a internet.
    const auth = e.auth;
    if (!auth || !auth.id) return lib.responder(e, 401, { message: 'Entra con tu cuenta para usar la IA.' });

    const datos = new DynamicModel({ modelo: '', tema: '', cantidad: 0, curso: '' });
    e.bindBody(datos);

    const esquema = lib.ESQUEMAS[datos.modelo];
    if (!esquema) return lib.responder(e, 400, { message: 'Tipo de contenido desconocido.' });
    const tema = String(datos.tema || '').trim().slice(0, 300);
    if (!tema) return lib.responder(e, 400, { message: 'Falta el tema.' });
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
      return lib.responder(e, 429, { message: 'Has llegado a ' + lib.TOPE_DIARIO + ' generaciones hoy. Mañana se renueva.' });
    }

    const sistema = 'Eres un maestro de primaria y secundaria que prepara material para el aula, en español. '
      + 'Respondes SIEMPRE con un array JSON y nada más: sin explicaciones y sin envolverlo en ```. '
      + 'El contenido es para proyectar en clase: enunciados cortos, claros y correctos. '
      + esquema;
    const usuario = 'Tema: ' + tema + '\n'
      + (curso ? 'Para: ' + curso + '\n' : '')
      + 'Escribe exactamente ' + cantidad + ' elementos.';

    const pedir = function (modelo) {
      return $http.send({
        url: proveedor.url(cfg.clave, modelo),
        method: 'POST',
        headers: proveedor.cabeceras(cfg.clave),
        body: JSON.stringify(proveedor.cuerpo(sistema, usuario)),
        timeout: 60,
      });
    };

    let res;
    try {
      res = pedir('');
    } catch (err) {
      // El motivo VIAJA, ya limpio de la clave: «inténtalo otra vez» a secas
      // dejaba al dueño sin saber si la Pi no llega a internet, si el nombre no
      // resuelve o si la clave no vale. Cada uno se arregla en un sitio distinto.
      $app.logger().error('IA: no se pudo llamar al proveedor', 'error', lib.sinSecretos(err));
      return lib.responder(e, 424, { message: 'La Pi no pudo hablar con la IA: ' + lib.sinSecretos(err) });
    }

    // 404 DE GOOGLE NO ES «CLAVE MALA»: es «esa clave no tiene ESE modelo». Es lo
    // que estaba pasando, y desde el navegador se veía como un fallo de conexión.
    // El catálogo cambia, así que en vez de cablear otro nombre —y volver aquí
    // dentro de un año— se le pregunta a la propia API cuáles tiene esta clave.
    if (res.statusCode === 404 && cfg.proveedor === 'gemini') {
      const alterno = lib.modeloAlternativoGemini(cfg.clave);
      if (alterno) {
        $app.logger().warn('IA: ' + lib.MODELO_GEMINI + ' no está en esta clave; se usa ' + alterno);
        try { res = pedir(alterno); } catch (err) {
          return lib.responder(e, 424, { message: 'La Pi no pudo hablar con la IA: ' + lib.sinSecretos(err) });
        }
      } else {
        return lib.responder(e, 424, { message: 'Esta clave de Gemini no tiene el modelo «' + lib.MODELO_GEMINI
          + '» y tampoco ofrece ninguno que sirva para escribir texto. Revisa en Google AI Studio que la '
          + 'clave esté activa y que su proyecto tenga habilitada la API de Gemini.' });
      }
    }

    if (res.statusCode >= 400) {
      // El cuerpo del proveedor NO se reenvía: puede traer la clave o detalles de
      // la cuenta. Se registra en el servidor y al profe le llega lo accionable.
      $app.logger().error('IA: el proveedor respondió ' + res.statusCode, 'proveedor', cfg.proveedor);
      return lib.responder(e, 424, { message: 'La IA rechazó la petición (' + res.statusCode + '). '
        + (res.statusCode === 400 || res.statusCode === 403
          ? 'Suele ser la clave: revísala en el panel.'
          : 'Inténtalo otra vez en un momento.') });
    }

    const texto = proveedor.texto(res.json);
    if (!texto) return lib.responder(e, 424, { message: 'La IA devolvió una respuesta vacía.' });

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

    return lib.responder(e, 200, { contenido: texto });
  } catch (err) {
    // NADA PUEDE MORIR EN SILENCIO AQUÍ. Si el handler revienta, PocketBase
    // devuelve su propia respuesta —y esa NO lleva la cabecera de permiso—, así
    // que el navegador se queda con «no se pudo conectar» y el motivo se pierde.
    // Es exactamente lo que pasó: un 502 que el navegador no dejaba leer. Con
    // esto, cualquier fallo sale como frase, y sin la clave dentro (R6).
    $app.logger().error('IA: el handler falló', 'error', lib.sinSecretos(err));
    return lib.responder(e, 424, { message: 'El servidor falló al preparar el contenido: ' + lib.sinSecretos(err) });
  }
});
