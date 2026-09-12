// EL ALMACÉN DE LOS DRIVERS LOCALES — dueño único.
//
// Los tres drivers offline (salas, actividades, tareas) tenían el MISMO
// `defaultKV()` + `read`/`write` tecleados por separado, con el mismo respaldo a
// un `Map` para poder correr en Node sin DOM. Y encima el de salas enumeraba sus
// claves de tres maneras distintas (dos con `length`/`key`, una con
// `Object.keys`, que sobre un doble de test devuelve `getItem`/`setItem`).
//
// Esto NO es `core/ls.js`: aquel habla SIEMPRE con el storage global real y por
// eso es el dueño de las claves `ww.*` de la app. Aquí el almacén se INYECTA
// (los tests sustituyen el storage entero por un objeto falso, y sin KV se cae a
// memoria), que es justo lo que un driver de dev necesita. Es la excepción
// declarada en `ALLOW_ALMACEN_CRUDO` (§21) y ahora vive en un solo sitio.

/**
 * Lo mínimo de `Storage` que usan los drivers. `removeItem`/`length`/`key` son
 * opcionales porque los dobles de test solo implementan lo que usan.
 * @typedef {Object} KV
 * @property {(k: string) => string|null} getItem
 * @property {(k: string, v: string) => void} setItem
 * @property {(k: string) => void} [removeItem]
 * @property {number} [length]
 * @property {(i: number) => string|null} [key]
 */

/** El `localStorage` del navegador, o `null` en Node (o si está bloqueado).
 *  @returns {KV|null} */
function almacenLocal() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

/**
 * UN ALMACÉN CON PREFIJO: `read`/`write` en JSON, `claves()` para enumerar lo
 * que hay bajo el prefijo y `borrar()` para la retención (§25). Sin KV, todo
 * ocurre en un `Map` de la instancia.
 * @param {string} prefijo
 * @param {KV|null|undefined} [kv]  El almacén; `undefined` = localStorage, `null` = memoria.
 */
export function crearKV(prefijo, kv = almacenLocal()) {
  /** @type {Map<string, unknown>} */
  const mem = new Map();
  /** @param {string} sub */
  const clave = (sub) => prefijo + sub;

  /** Lo guardado bajo `sub`, o null. FRONTERA: lo que sale de `JSON.parse` es
   *  `unknown` y lo estrecha quien lo pide.
   *  @param {string} sub @returns {unknown} */
  const read = (sub) => {
    const k = clave(sub);
    if (kv) { try { return JSON.parse(kv.getItem(k) || 'null'); } catch { return null; } }
    return mem.has(k) ? mem.get(k) : null;
  };

  /** @param {string} sub @param {unknown} val */
  const write = (sub, val) => {
    const k = clave(sub);
    if (kv) kv.setItem(k, JSON.stringify(val));
    else mem.set(k, val);
  };

  /** Las claves (ya SIN el prefijo) que hay guardadas.
   *  @returns {string[]} */
  const claves = () => {
    if (!kv) return [...mem.keys()].map(k => k.slice(prefijo.length));
    /** @type {string[]} */
    const out = [];
    // `length`/`key` es la superficie de `Storage`; si el doble de test no la
    // trae, se enumeran las propiedades propias (nunca al revés: sobre un
    // `Storage` real, `Object.keys` funciona, pero sobre un doble devolvería
    // también sus métodos).
    if (typeof kv.key === 'function' && typeof kv.length === 'number') {
      for (let i = 0; i < kv.length; i++) {
        const k = kv.key(i);
        if (k?.startsWith(prefijo)) out.push(k.slice(prefijo.length));
      }
      return out;
    }
    for (const k of Object.keys(kv)) if (k.startsWith(prefijo)) out.push(k.slice(prefijo.length));
    return out;
  };

  /** Borra lo guardado bajo `sub`. R6 · no en silencio: si el almacén no sabe
   *  borrar, se dice (lo escucha la purga de §25).
   *  @param {string} sub */
  const borrar = (sub) => {
    const k = clave(sub);
    if (!kv) { mem.delete(k); return; }
    if (!kv.removeItem) throw new Error('el almacén no sabe borrar');
    kv.removeItem(k);
  };

  return { read, write, claves, borrar, tieneKV: !!kv };
}
