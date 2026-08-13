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
  FUENTES, FUENTE_POR_DEFECTO, buscarImagenes, atribucionDe, creditoTexto,
} from '../core/imageSearch.js';

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

// ── La fuente por defecto existe y es la de los diagramas escolares ──────────
assert.ok(FUENTES[FUENTE_POR_DEFECTO], 'la fuente por defecto está registrada');
assert.strictEqual(FUENTE_POR_DEFECTO, 'wikimedia',
  'por defecto se busca donde están los diagramas escolares, no fotos de banco');
ok(`fuente por defecto «${FUENTE_POR_DEFECTO}» · registradas: ${Object.keys(FUENTES).join(', ')}`);

console.log(`\n  ${passed} imageSearch checks passed`);
