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

export const FUENTES = {
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
    parse: (json) => {
      const pages = json?.query?.pages;
      if (!pages) return [];
      return Object.values(pages).map((p) => {
        const info = p.imageinfo?.[0] || {};
        const meta = info.extmetadata || {};
        return {
          id: `wm_${p.pageid}`,
          miniatura: info.thumburl || info.url || '',
          imagen: info.url || '',
          titulo: LIMPIA(p.title).replace(/^File:/, ''),
          autor: LIMPIA(meta.Artist?.value) || 'Wikimedia Commons',
          licencia: LIMPIA(meta.LicenseShortName?.value) || 'ver en Commons',
          pagina: info.descriptionurl || '',
          fuente: 'Wikimedia Commons',
        };
      }).filter(r => r.miniatura && r.imagen);
    },
  },

  // ── Openverse ──────────────────────────────────────────────────────────────
  openverse: {
    etiqueta: 'Openverse',
    nota: 'Fotos y dibujos con licencia Creative Commons.',
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

export const FUENTE_POR_DEFECTO = 'wikimedia';

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
  const r = await fetchFn(f.url(q, { limite }));
  if (!r.ok) throw new Error(`${f.etiqueta} no respondió (error ${r.status}).`);
  return f.parse(await r.json());
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
