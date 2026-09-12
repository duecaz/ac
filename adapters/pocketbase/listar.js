// LISTAR CON ORDEN, Y SI EL ORDEN NO EXISTE, SIN ÉL.
//
// Una colección creada por API en PocketBase ≥0.23 puede NO tener el campo
// autodate (`created`/`updated`), y entonces `sort=-created` no ordena: rompe la
// consulta entera y la vista se queda vacía. El respaldo —reintentar sin orden—
// estaba escrito dos veces (los resultados de `remoteStore` y las salas de
// `realtimeRooms`), que es como se consigue que un día solo lo tenga una.
import { filas } from '../frontera.js';

/**
 * @param {import('../frontera.js').PbFetch} pbFetch
 * @param {string} path  Ruta con su query ya montada (sin `sort`).
 * @param {{sort?: string}} [opts]
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function pbListar(pbFetch, path, { sort = '' } = {}) {
  if (sort) {
    try { return filas(await pbFetch(`${path}&sort=${encodeURIComponent(sort)}`)); }
    catch { /* la colección no tiene ese campo: se lee sin orden, no se deja vacío */ }
  }
  return filas(await pbFetch(path));
}
