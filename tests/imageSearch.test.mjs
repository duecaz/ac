// BUSCAR IMÁGENES LIBRES — el núcleo, con respuestas de mentira.
//
// Se prueba TODO menos la red: la petición se construye aquí y la respuesta se
// normaliza aquí, así que con un `fetch` de juguete se cubre lo que de verdad
// puede romperse — que la consulta viaje escapada, que las dos fuentes devuelvan
// la MISMA forma, y que la atribución no se pierda por el camino (con Creative
// Commons no es un adorno: es lo que la licencia exige).
//
// Lo que NO cubre, y se dice: que las dos APIs respondan de verdad sin clave y
// con CORS. El entorno de desarrollo no sale a internet; se comprueba desde la
// Pi con los dos curl de docs/handoff-editor-general.md.
// Run: node tests/imageSearch.test.mjs
import assert from 'node:assert';
import {
  FUENTES, FUENTE_POR_DEFECTO, fuentesDisponibles, buscarImagenes, atribucionDe, creditoTexto,
} from '../core/imageSearch.js';
import { PIXABAY_KEY } from '../core/imageKeys.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const respuesta = (json, okFlag = true, status = 200) => ({
  ok: okFlag, status, json: async () => json,
});

// ── La consulta viaja bien ───────────────────────────────────────────────────
{
  const wm = FUENTES.wikimedia.url('corazón humano');
  assert.ok(wm.includes('origin=*'), 'Wikimedia necesita origin=* o el navegador descarta la respuesta (CORS)');
  assert.ok(wm.includes('cora'), 'la consulta viaja');
  assert.ok(!wm.includes('corazón humano'), 'la consulta va ESCAPADA, no cruda');
  assert.ok(wm.includes('filetype%3Abitmap'), 'se piden mapas de bits: un SVG no entra como data-URL (§seguridad de fondo)');

  const ov = FUENTES.openverse.url('sistema solar');
  assert.ok(ov.includes('q=sistema%20solar') || ov.includes('q=sistema+solar'), 'Openverse recibe la consulta escapada');
  ok('las dos fuentes construyen su petición con la consulta escapada');
}

// ── Las dos devuelven la MISMA forma ─────────────────────────────────────────
{
  const wm = FUENTES.wikimedia.parse({
    query: { pages: { 42: {
      pageid: 42, title: 'File:Corazon.jpg',
      imageinfo: [{
        url: 'https://upload.wikimedia.org/Corazon.jpg',
        thumburl: 'https://upload.wikimedia.org/320px-Corazon.jpg',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Corazon.jpg',
        extmetadata: {
          Artist: { value: '<a href="/x">Ana Pérez</a>' },
          LicenseShortName: { value: 'CC BY-SA 4.0' },
        },
      }],
    } } },
  });
  assert.strictEqual(wm.length, 1);
  assert.strictEqual(wm[0].titulo, 'Corazon.jpg', 'el prefijo File: no se le enseña al profe');
  assert.strictEqual(wm[0].autor, 'Ana Pérez', 'el autor viene con HTML dentro y se limpia');
  assert.strictEqual(wm[0].licencia, 'CC BY-SA 4.0');

  const ov = FUENTES.openverse.parse({
    results: [{ id: 'abc', url: 'https://x/foto.jpg', thumbnail: 'https://x/mini.jpg',
                title: 'Sistema solar', creator: 'Luis', license: 'by', license_version: '4.0',
                foreign_landing_url: 'https://x/pagina' }],
  });
  assert.strictEqual(ov.length, 1);
  assert.strictEqual(ov[0].licencia, 'BY 4.0');

  // La MISMA forma: quien pinta la rejilla no puede saber de dónde vino.
  assert.deepStrictEqual(Object.keys(wm[0]).sort(), Object.keys(ov[0]).sort(),
    'las dos fuentes devuelven los mismos campos');
  ok('Wikimedia y Openverse se normalizan a la misma forma (título limpio, autor sin HTML, licencia)');
}

// ── Lo inservible se descarta, no se pinta roto ──────────────────────────────
{
  const wm = FUENTES.wikimedia.parse({ query: { pages: { 1: { pageid: 1, title: 'File:X', imageinfo: [{}] } } } });
  assert.deepStrictEqual(wm, [], 'un resultado sin imagen no llega a la rejilla');
  assert.deepStrictEqual(FUENTES.wikimedia.parse({}), [], 'una respuesta vacía no revienta');
  assert.deepStrictEqual(FUENTES.openverse.parse({}), [], 'ídem en la otra fuente');
  ok('resultados sin imagen o respuestas vacías se descartan sin romper');
}

// ── La búsqueda, de punta a punta con un fetch de juguete ────────────────────
{
  let pedida = null;
  const fetchFn = async (u) => { pedida = u; return respuesta({ results: [
    { id: 'a', url: 'https://x/1.jpg', thumbnail: 'https://x/1m.jpg', title: 'Uno', creator: 'C', license: 'by' },
  ] }); };
  const r = await buscarImagenes('luna', { fuente: 'openverse', fetchFn });
  assert.strictEqual(r.length, 1);
  assert.ok(pedida.includes('luna'), 'se pidió lo que se buscó');

  assert.deepStrictEqual(await buscarImagenes('   ', { fetchFn }), [],
    'una búsqueda vacía no gasta una petición');

  // R6 · un fallo del proveedor se LANZA para que quien llama lo diga; nunca
  // se devuelve una lista vacía haciendo pasar «no hay red» por «no hay fotos».
  await assert.rejects(
    () => buscarImagenes('luna', { fuente: 'openverse', fetchFn: async () => respuesta({}, false, 503) }),
    /no respondió \(error 503\)/, 'un 503 se cuenta, no se disfraza de «sin resultados»');
  await assert.rejects(() => buscarImagenes('x', { fuente: 'inventada', fetchFn }), /desconocida/);
  ok('busca, no gasta petición en vano, y un fallo del proveedor se LANZA (no se disfraza de «sin resultados»)');
}

// ── La atribución sobrevive ──────────────────────────────────────────────────
{
  const img = { autor: 'Ana', licencia: 'CC BY-SA 4.0', fuente: 'Wikimedia Commons',
                pagina: 'https://commons/x', miniatura: 'm', imagen: 'i', titulo: 't', id: 'x' };
  const at = atribucionDe(img);
  assert.deepStrictEqual(at, { autor: 'Ana', licencia: 'CC BY-SA 4.0', fuente: 'Wikimedia Commons', pagina: 'https://commons/x' });
  // Dato MÍNIMO (R7): no se arrastra la miniatura ni el id interno del proveedor.
  assert.ok(!('miniatura' in at) && !('id' in at), 'la atribución guarda el crédito, no el rastro');
  assert.strictEqual(creditoTexto(at), 'Ana · CC BY-SA 4.0 · Wikimedia Commons');
  assert.strictEqual(creditoTexto(null), '', 'sin atribución no se inventa una línea');
  ok('la atribución guarda autor/licencia/fuente/página — el crédito que la licencia exige, y nada más');
}

// ── Wikipedia: busca por TEMA y trae el crédito de Commons ───────────────────
// El hallazgo que la creó: «Partes de la planta» en Commons devuelve archivos
// que se LLAMAN así (buscando «corazón» salía «Corazon Aquino»), porque busca
// por nombre de archivo. Wikipedia responde qué artículos hablan del tema y se
// cogen SUS ilustraciones — que son los dibujos escolares que uno esperaba.
{
  const pedidas = [];
  const fetchFn = async (u) => {
    pedidas.push(u);
    if (u.includes('es.wikipedia.org')) {
      return respuesta({ query: { pages: {
        7: { pageid: 7, index: 2, title: 'Raíz',  pageimage: 'Raiz.jpg' },
        3: { pageid: 3, index: 1, title: 'Hoja',  pageimage: 'Hoja_planta.jpg' },
        9: { pageid: 9, index: 3, title: 'Tallo' },              // artículo sin imagen
      } } });
    }
    return respuesta({ query: { pages: {
      21: { pageid: 21, title: 'File:Raiz.jpg', imageinfo: [{
        url: 'https://upload/Raiz.jpg', thumburl: 'https://upload/320px-Raiz.jpg',
        extmetadata: { Artist: { value: 'Ana' }, LicenseShortName: { value: 'CC BY 4.0' } } }] },
      22: { pageid: 22, title: 'File:Hoja planta.jpg', imageinfo: [{
        url: 'https://upload/Hoja.jpg', thumburl: 'https://upload/320px-Hoja.jpg',
        extmetadata: { Artist: { value: 'Luis' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] },
    } } });
  };
  const r = await buscarImagenes('partes de la planta', { fuente: 'wikipedia', fetchFn });

  assert.strictEqual(pedidas.length, 2, 'son DOS peticiones: el tema y luego la licencia');
  assert.ok(pedidas[0].includes('es.wikipedia.org') && pedidas[0].includes('origin=*'),
    'primero se le pregunta a Wikipedia en español, con CORS');
  assert.ok(pedidas[1].includes('commons.wikimedia.org') && pedidas[1].includes('extmetadata'),
    'y después a Commons por el píxel Y su licencia — sin este paso habría imagen sin crédito');
  assert.strictEqual(r.length, 2, 'el artículo sin ilustración no aporta nada y no rompe');
  assert.strictEqual(r[0].titulo, 'Hoja planta.jpg',
    'manda el orden de RELEVANCIA de Wikipedia (index 1), no el del objeto de páginas');
  assert.strictEqual(r[0].licencia, 'CC BY-SA 4.0', 'y la licencia llega de verdad');
  assert.strictEqual(r[0].fuente, 'Wikimedia Commons', 'el crédito nombra a quien aloja el archivo');

  // Sin artículos con imagen no se gasta la segunda petición.
  const vacio = [];
  assert.deepStrictEqual(await buscarImagenes('xyzzy', { fuente: 'wikipedia', fetchFn: async (u) => {
    vacio.push(u); return respuesta({ query: { pages: { 1: { pageid: 1, title: 'X' } } } });
  } }), []);
  assert.strictEqual(vacio.length, 1, 'sin ninguna ilustración, no se pregunta por licencias que no hacen falta');
  ok('Wikipedia busca por TEMA, ordena por relevancia y trae el crédito de Commons');
}

// ── Un 401/403 no es «no hay internet» ───────────────────────────────────────
// Openverse responde a un curl pero devuelve 401 al navegador: pide cuenta.
// Decirle al profe «comprueba tu conexión» lo manda a mirar donde no es.
{
  const f503 = async () => respuesta({}, false, 503);
  const f401 = async () => respuesta({}, false, 401);
  await assert.rejects(() => buscarImagenes('x', { fuente: 'openverse', fetchFn: f401 }),
    /no permite buscar sin cuenta \(error 401\).*Cambia de fuente/s, 'el 401 dice el motivo REAL y la salida');
  await assert.rejects(() => buscarImagenes('x', { fuente: 'openverse', fetchFn: f503 }),
    /no respondió \(error 503\)/, 'CONTRA-PRUEBA: un fallo del servidor sigue contándose como tal');
  ok('un 401/403 se explica como «pide cuenta» y manda a cambiar de fuente, no a revisar la conexión');
}

// ── Pixabay: gratis, y solo se OFRECE si puede funcionar ─────────────────────
{
  const px = FUENTES.pixabay.parse({ hits: [
    { id: 7, webformatURL: 'https://px/640.jpg', largeImageURL: 'https://px/1280.jpg',
      previewURL: 'https://px/150.jpg', tags: 'planta, hoja', user: 'Ana', pageURL: 'https://px/foto' },
    { id: 8, tags: 'sin imagen' },
  ] });
  assert.strictEqual(px.length, 1, 'un resultado sin imagen no llega a la rejilla');
  assert.deepStrictEqual(Object.keys(px[0]).sort(), Object.keys(FUENTES.wikimedia.parse({
    query: { pages: { 1: { pageid: 1, title: 'File:X.jpg', imageinfo: [{ url: 'u', thumburl: 't' }] } } },
  })[0]).sort(), 'misma forma que las demás: la rejilla no sabe de dónde vino');
  // Se descarga el tamaño WEB (≤640 px), no el grande: §25 lo reescalaría igual
  // y bajar 3 MB con la clase esperando no se recupera.
  assert.strictEqual(px[0].imagen, 'https://px/640.jpg');
  assert.strictEqual(px[0].licencia, 'Uso libre (Pixabay)');

  // UNA FUENTE QUE NO PUEDE FUNCIONAR NO SE OFRECE. Un desplegable con una
  // opción que falla al tocarla es peor que uno con una opción menos: el profe
  // no puede saber que faltaba una clave, solo ve que la app no encuentra nada.
  const ofrecidas = fuentesDisponibles().map(([k]) => k);
  assert.strictEqual(ofrecidas.includes('pixabay'), !!PIXABAY_KEY,
    'Pixabay aparece si y solo si hay clave puesta en core/imageKeys.js');
  assert.ok(ofrecidas.includes('wikipedia') && ofrecidas.includes('wikimedia'),
    'CONTRA-PRUEBA: las que no necesitan clave se ofrecen siempre');
  assert.ok(FUENTES.pixabay.url('flor').includes('image_type=all'),
    'se piden también DIBUJOS: para «partes de la planta» sirven más que las fotos');
  ok(`Pixabay se normaliza igual, baja el tamaño web, y se ofrece solo con clave (hoy: ${PIXABAY_KEY ? 'puesta' : 'sin poner'})`);
}

// ── La fuente por defecto existe y es la de los diagramas escolares ──────────
assert.ok(FUENTES[FUENTE_POR_DEFECTO], 'la fuente por defecto está registrada');
assert.strictEqual(FUENTE_POR_DEFECTO, 'wikipedia',
  'por defecto se busca por TEMA (lo que el profe escribe), no por nombre de archivo');
ok(`fuente por defecto «${FUENTE_POR_DEFECTO}» · registradas: ${Object.keys(FUENTES).join(', ')}`);

console.log(`\n  ${passed} imageSearch checks passed`);
