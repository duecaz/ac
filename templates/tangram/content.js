// EL CONTENIDO DE TANGRAM — qué forma tiene y cómo se deja jugable.
//
// Vive aparte del editor porque lo necesita también el PLAYER: `ensureContent`
// estaba en `editor.js` y el player lo importaba de ahí, así que jugar
// arrastraba el formulario entero (y con él el chasis del editor).
//
// FORMATO v2 (§24): el ítem guarda `nombre` y las 7 `colocaciones` que el
// docente dejó en el tablero del editor — la silueta que juega la clase ES su
// unión (`poligonosDe`, game/geometria.js). El catálogo `SILUETAS` ya no es
// «qué figura se juega» sino las FIGURAS DE PARTIDA que se cargan al tablero.
// La v1 guardaba `{id, figura}` (nombre del catálogo): la sube `normalizarItem`
// —uno para `migrateContent` y para `ensureContent`, así los dos dicen lo mismo.
import { rid } from '../../core/ids.js';
import { esObjeto } from '../../core/frontera.js';
import { SILUETAS, ORDEN_SILUETAS } from './game/siluetas.js';
import { ORDEN_PIEZAS } from './game/piezas.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').TangramContent} TangramContent
 * @typedef {import('../../kernel/contracts/activity.js').TangramItem} TangramItem
 * @typedef {import('./game/geometria.js').Colocacion} Colocacion
 */

/** La actividad vista como la de ESTA plantilla: `ensureContent` es justamente
 *  quien la deja en esa forma, así que antes de él el contenido puede ser otro
 *  (o no estar).
 *  @param {Activity} a @returns {TangramContent} */
export function contenidoTangram(a) {
  return /** @type {TangramContent} */ (a.content);
}

/** Copia de las colocaciones de una figura de partida: el catálogo es de
 *  solo lectura y el tablero MUTA lo que le dan.
 *  @param {string} figura @returns {Colocacion[]} */
export function colocacionesDePreset(figura) {
  const f = SILUETAS[figura] ?? SILUETAS[ORDEN_SILUETAS[0]];
  return f.solucion.map(c => ({ pieza: c.pieza, x: c.x, y: c.y, rot: c.rot, flip: c.flip }));
}

/** Una colocación bien formada: pieza con nombre y números finitos. El flip
 *  se lee como booleano (un JSON tocado a mano puede traer 0/1).
 *  @param {unknown} c @returns {c is Colocacion} */
function esColocacion(c) {
  if (!esObjeto(c)) return false;
  const o = /** @type {Record<string, unknown>} */ (c);
  return typeof o.pieza === 'string' && Number.isFinite(o.x) && Number.isFinite(o.y) && Number.isFinite(o.rot);
}

/**
 * Deja UN ítem en forma v2, sea lo que sea lo que llega: un v1 `{id, figura}`
 * (figura del catálogo → sus colocaciones; desconocida → la primera), un v2
 * ya bueno (no se toca: idempotente) o un v2 roto (las colocaciones válidas se
 * conservan y las que faltan se rellenan desde la figura de partida). Siempre
 * salen 7, una por pieza, en el orden de `ORDEN_PIEZAS`.
 * @param {unknown} bruto
 * @returns {TangramItem}
 */
export function normalizarItem(bruto) {
  const o = esObjeto(bruto) ? /** @type {Partial<TangramItem>} */ (bruto) : {};
  const figura = typeof o.figura === 'string' && SILUETAS[o.figura] ? o.figura : ORDEN_SILUETAS[0];
  const base = colocacionesDePreset(figura);
  /** @type {Map<string, Colocacion>} */
  const validas = new Map();
  if (Array.isArray(o.colocaciones)) {
    for (const c of o.colocaciones) {
      if (esColocacion(c) && ORDEN_PIEZAS.includes(c.pieza) && !validas.has(c.pieza)) {
        validas.set(c.pieza, { pieza: c.pieza, x: c.x, y: c.y, rot: c.rot, flip: !!c.flip });
      }
    }
  }
  const colocaciones = ORDEN_PIEZAS.map(pieza => validas.get(pieza) ?? /** @type {Colocacion} */ (base.find(c => c.pieza === pieza)));
  const nombre = typeof o.nombre === 'string' && o.nombre.trim() ? o.nombre : SILUETAS[figura].nombre;
  return { id: typeof o.id === 'string' && o.id ? o.id : rid('it_'), nombre, colocaciones };
}

/** Contenido v2 → el mismo contenido (idempotente); cualquier otra cosa → v2.
 *  Un ítem que ya está en forma se devuelve TAL CUAL (misma referencia): así
 *  migrar no reescribe lo que el docente guardó (§24).
 *  @param {unknown} c @returns {TangramContent} */
export function normalizarContenido(c) {
  const items = esObjeto(c) && Array.isArray(/** @type {{items?: unknown}} */ (c).items)
    ? /** @type {unknown[]} */ (/** @type {{items: unknown[]}} */ (c).items) : [];
  if (items.length && items.every(esItemV2)) return /** @type {TangramContent} */ (c);
  const salida = items.map(it => (esItemV2(it) ? it : normalizarItem(it)));
  if (!salida.length) salida.push(normalizarItem(null));
  return { items: salida };
}

/** ¿Ya está en forma v2 (nombre + 7 colocaciones válidas, una por pieza)?
 *  @param {unknown} it @returns {it is TangramItem} */
function esItemV2(it) {
  if (!esObjeto(it)) return false;
  const o = /** @type {Partial<TangramItem>} */ (it);
  if (typeof o.id !== 'string' || typeof o.nombre !== 'string' || 'figura' in o) return false;
  if (!Array.isArray(o.colocaciones) || o.colocaciones.length !== ORDEN_PIEZAS.length) return false;
  const piezas = new Set();
  for (const c of o.colocaciones) {
    if (!esColocacion(c) || typeof c.flip !== 'boolean' || !ORDEN_PIEZAS.includes(c.pieza)) return false;
    piezas.add(c.pieza);
  }
  return piezas.size === ORDEN_PIEZAS.length;
}

/** La actividad SIEMPRE tiene un ítem jugable: nombre y 7 colocaciones válidas
 *  (nace así, y un JSON tocado a mano o un v1 sin migrar caen a forma v2).
 *  @param {Activity} a @returns {Activity} */
export function ensureContent(a) {
  a.content = normalizarContenido(a.content);
  return a;
}
