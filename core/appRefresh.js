// RECARGA DURA DEL GRAFO DE MÓDULOS — el F5 que sí refresca los ES modules.
//
// El bug real (partidas de v1.51.333/335 en producción): GitHub Pages sirve
// todos los archivos con `max-age=600`, así que durante ~10 minutos tras cada
// deploy un móvil que ya visitó la web corre un grafo MEZCLADO (unos módulos
// nuevos, otros cacheados de la versión anterior) — y esa mezcla muere en
// silencio al pasar de lobby a pregunta. Ni el F5 ni un `location.replace` con
// cache-buster lo arreglan: solo revalidan el HTML; los módulos "frescos" por
// max-age se sirven de la caché HTTP sin tocar la red.
//
// Lo que SÍ la refresca: `fetch(url, { cache: 'reload' })` fuerza ir a la red
// Y actualiza la entrada de la caché HTTP. La página puede enumerar todos los
// recursos MISMO-ORIGEN que cargó (performance resource timing) y re-pedirlos
// así; la recarga siguiente arranca con un grafo COHERENTE (aunque el CDN aún
// sirva la versión anterior entera, coherente-viejo funciona; mezclado no).
export async function refreshAppGraph() {
  try {
    // El propio HTML + todo .js/.css del mismo origen que esta página cargó
    // (los módulos nuevos de la versión siguiente no están → se pedirán
    // frescos solos, no hay nada que invalidar).
    // El propio HTML se añade explícito; del resto solo js/css (los ES modules
    // y estilos del grafo — es lo único que se mezcla entre versiones).
    const urls = new Set([location.origin + location.pathname]);
    for (const e of performance.getEntriesByType?.('resource') || []) {
      const u = String(e.name || '');
      if (u.startsWith(location.origin) && /\.(js|css)(\?|$)/.test(u)) urls.add(u.split('?')[0]);
    }
    await Promise.allSettled([...urls].map(u => fetch(u, { cache: 'reload' })));
  } catch { /* mejor recargar con lo que haya que no recargar */ }
}
