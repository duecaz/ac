// BUSCAR IMÁGENES LIBRES — el núcleo, sin DOM y sin red propia (F6 del plan del
// editor, 2026-08-13).
//
// POR QUÉ ESTAS FUENTES Y NO GOOGLE. La antigua API de imágenes de Google está
// retirada; lo que queda (Programmable Search) exige una clave que no puede
// vivir en el navegador, se paga pasadas 100 consultas al día y —lo que decide—
// devuelve imágenes de CUALQUIER web, con derechos desconocidos. Como los profes
// PUBLICAN sus actividades en la biblioteca, eso trasladaría un problema legal
// al proyecto por cada imagen que alguien meta. Se busca en catálogos con la
// licencia resuelta:
//   · Wikimedia Commons — donde están los diagramas escolares de verdad
//     (anatomía, mapas, ciclos, geometría). Sin clave.
//   · Openverse — fotos y dibujos con licencia Creative Commons. Sin clave.
//
// LA ATRIBUCIÓN NO ES OPCIONAL. Con Creative Commons hay que decir de dónde
// salió cada imagen y bajo qué licencia, así que cada resultado la trae y quien
// la use la guarda con ella. Un buscador que devuelve solo el pixel deja al
// profe incumpliendo sin saberlo.
//
// Este módulo NO llama a la red: recibe un `fetch` y devuelve resultados ya
// NORMALIZADOS, así que se puede probar entero con respuestas de mentira. La
// llamada real vive en quien lo usa.

/** Lo que devuelve una búsqueda, venga de donde venga. */
/** @typedef {{id:string, miniatura:string, imagen:string, titulo:string,
 *             autor:string, licencia:string, pagina:string, fuente:string}} Imagen */

const LIMPIA = (s) => String(s ?? '').replace(/<[^>]*>/g, '').trim();

/** Lee la respuesta de imageinfo de Commons — la MISMA para buscar por texto y
 *  para pedir archivos por nombre, que es lo que hace la fuente «Wikipedia». */
function parseCommons(json) {
  const pages = json?.query?.pages;
  if (!pages) return [];
  return Object.values(pages).map((p) => {
    const info = p.imageinfo?.[0] || {};
    const meta = info.extmetadata || {};
    return {
      id: `wm_${p.pageid || p.title}`,
      miniatura: info.thumburl || info.url || '',
      imagen: info.url || '',
      titulo: LIMPIA(p.title).replace(/^File:/, ''),
      autor: LIMPIA(meta.Artist?.value) || 'Wikimedia Commons',
      licencia: LIMPIA(meta.LicenseShortName?.value) || 'ver en Commons',
      pagina: info.descriptionurl || '',
      fuente: 'Wikimedia Commons',
    };
  }).filter(r => r.miniatura && r.imagen);
}

/** Pide a Commons UNOS ARCHIVOS CONCRETOS por nombre (con su licencia). */
const urlCommonsPorTitulos = (files) =>
  'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*'
  + '&titles=' + files.map(f => encodeURIComponent('File:' + f)).join('%7C')
  + '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=320';

export const FUENTES = {
  // ── Wikipedia en español ───────────────────────────────────────────────────
  // LA FUENTE POR DEFECTO, y la que arregla el hallazgo del dueño: buscar
  // «Partes de la planta» en Commons devuelve archivos que se LLAMAN así
  // («Corazon Aquino» al buscar corazón), porque Commons busca por nombre de
  // archivo y sus descripciones están en inglés. Wikipedia busca por TEMA: se
  // le pregunta qué artículos hablan de eso y se cogen SUS ilustraciones, que
  // son exactamente los dibujos escolares que uno espera.
  //
  // Son DOS peticiones porque cada una sabe una cosa: Wikipedia sabe qué imagen
  // ilustra el tema, y Commons sabe de quién es y bajo qué licencia. Sin la
  // segunda tendríamos el píxel sin el crédito, que con Creative Commons es
  // justo lo que no se puede hacer.
  wikipedia: {
    etiqueta: 'Wikipedia (español)',
    nota: 'Las ilustraciones de los artículos: partes de la planta, el ciclo del agua, el aparato digestivo…',
    buscar: async (q, { fetchFn, limite = 24 }) => {
      const u1 = 'https://es.wikipedia.org/w/api.php?action=query&format=json&origin=*'
        + '&generator=search&gsrlimit=' + limite
        + '&gsrsearch=' + encodeURIComponent(q)
        + '&prop=pageimages&piprop=name&pilimit=' + limite;
      const r1 = await fetchFn(u1);
      if (!r1.ok) throw new Error(`Wikipedia no respondió (error ${r1.status}).`);
      const paginas = Object.values((await r1.json())?.query?.pages || {});
      // Orden de RELEVANCIA: la API numera los resultados en `index`; el objeto
      // de páginas no conserva ese orden y sin esto el mejor artículo caía a
      // media rejilla.
      const files = [...new Set(paginas
        .sort((x, y) => (x.index ?? 99) - (y.index ?? 99))
        .map(p => p.pageimage).filter(Boolean))];
      if (!files.length) return [];
      const r2 = await fetchFn(urlCommonsPorTitulos(files.slice(0, limite)));
      if (!r2.ok) throw new Error(`Wikimedia Commons no respondió (error ${r2.status}).`);
      const encontradas = parseCommons(await r2.json());
      const orden = new Map(files.map((f, i) => [f.replace(/_/g, ' '), i]));
      return encontradas.sort((x, y) => (orden.get(x.titulo) ?? 99) - (orden.get(y.titulo) ?? 99));
    },
  },

  // ── Wikimedia Commons ──────────────────────────────────────────────────────
  // `origin=*` es lo que hace que responda a una petición anónima desde el
  // navegador con CORS; sin él, el navegador descarta la respuesta.
  wikimedia: {
    etiqueta: 'Wikimedia Commons',
    nota: 'Diagramas y mapas escolares. Dominio público o Creative Commons.',
    url: (q, { limite = 24 } = {}) =>
      'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*'
      + '&generator=search&gsrnamespace=6&gsrlimit=' + limite
      + '&gsrsearch=' + encodeURIComponent(`filetype:bitmap ${q}`)
      + '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=320',
    parse: parseCommons,
  },

  // ── Openverse ──────────────────────────────────────────────────────────────
  // Responde sin clave a un `curl` (comprobado desde la Pi) pero devuelve 401
  // al pedírselo el NAVEGADOR: pide cuenta para el uso desde una web. Se queda
  // como tercera opción —por si lo reabren o se registra la app— y el diálogo
  // dice el motivo real y manda a cambiar de fuente, en vez de sugerir que se
  // revise una conexión que está perfectamente.
  openverse: {
    etiqueta: 'Openverse (pide cuenta)',
    nota: 'Fotos con licencia Creative Commons. Hoy responde 401 desde el navegador: usa las otras dos.',
    url: (q, { limite = 24 } = {}) =>
      'https://api.openverse.org/v1/images/?page_size=' + limite
      + '&q=' + encodeURIComponent(q),
    parse: (json) => (json?.results || []).map((r) => ({
      id: `ov_${r.id}`,
      miniatura: r.thumbnail || r.url || '',
      imagen: r.url || '',
      titulo: LIMPIA(r.title) || 'Sin título',
      autor: LIMPIA(r.creator) || 'Autor desconocido',
      licencia: [r.license, r.license_version].filter(Boolean).join(' ').toUpperCase() || 'CC',
      pagina: r.foreign_landing_url || '',
      fuente: 'Openverse',
    })).filter(r => r.miniatura && r.imagen),
  },
};

// Por defecto se busca por TEMA (Wikipedia), no por nombre de archivo: es lo
// que un profe escribe («partes de la planta»), y buscarlo en Commons devolvía
// resultados irrelevantes que hacían parecer vacío un catálogo de 100 millones.
export const FUENTE_POR_DEFECTO = 'wikipedia';

/**
 * Busca en una fuente. No conoce la red: se le PASA el `fetch`.
 * @returns {Promise<Imagen[]>}
 * @throws si la fuente no responde — quien llama lo DICE (R6), nunca en silencio.
 */
export async function buscarImagenes(consulta, { fuente = FUENTE_POR_DEFECTO, limite = 24, fetchFn = fetch } = {}) {
  const q = String(consulta || '').trim();
  if (!q) return [];
  const f = FUENTES[fuente];
  if (!f) throw new Error(`Fuente de imágenes desconocida: ${fuente}`);
  // Una fuente puede traer su propio recorrido (Wikipedia son dos peticiones:
  // el tema y luego la licencia). Las de una sola petición declaran url+parse.
  if (f.buscar) return f.buscar(q, { fetchFn, limite });
  const r = await fetchFn(f.url(q, { limite }));
  if (!r.ok) throw new Error(fallo(f, r.status));
  return f.parse(await r.json());
}

/** El motivo, con la salida al lado. Un 401/403 no es «no hay internet»: la
 *  fuente pide credenciales que esta app no tiene, y decirle al profe que
 *  compruebe su conexión lo manda a mirar donde no es. */
function fallo(f, status) {
  return (status === 401 || status === 403)
    ? `${f.etiqueta} ya no permite buscar sin cuenta (error ${status}). Cambia de fuente arriba.`
    : `${f.etiqueta} no respondió (error ${status}).`;
}

/**
 * La ATRIBUCIÓN que se guarda junto a la imagen. Se queda con lo mínimo — no es
 * telemetría, es el crédito que la licencia exige (R7: dato mínimo).
 */
export function atribucionDe(img) {
  if (!img) return null;
  return {
    autor: img.autor || '',
    licencia: img.licencia || '',
    fuente: img.fuente || '',
    pagina: img.pagina || '',
  };
}

/** Una línea legible para pintarla debajo de la imagen. */
export function creditoTexto(atrib) {
  if (!atrib) return '';
  return [atrib.autor, atrib.licencia, atrib.fuente].filter(Boolean).join(' · ');
}
