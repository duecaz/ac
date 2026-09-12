// Pure, injectable offline-queue core. The flush/enqueue concurrency logic that
// protects student answers and results under flaky wifi lives here ONCE, with
// storage + sender + identity injected so it is unit-testable without a browser.
//
// Guarantees:
//  - enqueue(item) de-dupes by idOf(item) (a resend of the same logical item
//    replaces, never duplicates).
//  - flush() is single-flight: concurrent calls share one in-flight run, so the
//    'online' event racing a manual/piggyback flush can't double-send or lose
//    items.
//  - flush() removes ONLY confirmed-sent ids, re-reading the queue at write time
//    so an item enqueued WHILE a flush is in flight is never clobbered.
//
// Contract:
//  load()        -> array of items (must already be quota/parse safe)
//  save(arr)     -> persist the array (may cap/evict; quota-aware)
//  send(item)    -> Promise; resolve = delivered, throw = keep for next flush
//  idOf(item)    -> stable string identity for de-dupe and removal
import { lsSet, lsGetJsonArray } from './ls.js';
import { mensajeDe, estadoDe } from './frontera.js';
/**
 * @template T
 * @param {{load: () => T[], save: (q: T[]) => void, send: (it: T) => Promise<unknown>,
 *   idOf: (it: T) => string, flushOnOnline?: boolean}} o
 * @returns {{enqueue: (item: T) => void, flush: () => Promise<number>, pending: () => number}}
 */
export function createOfflineQueue({ load, save, send, idOf, flushOnOnline = true }) {
  /** @type {Promise<number>|null} */
  let flushing = null;

  /** @param {T} item */
  function enqueue(item) {
    const id = idOf(item);
    const q = load().filter(x => idOf(x) !== id);
    q.push(item);
    save(q);
  }

  function flush() {
    if (flushing) return flushing;
    flushing = (async () => {
      const q = load();
      if (!q.length) return 0;
      let ok = 0;
      const sent = new Set();
      for (const item of q) {
        try {
          await send(item);
          ok++;
          sent.add(idOf(item));
        } catch { /* keep for next flush */ }
      }
      // Re-read so items enqueued during the awaits survive; drop only confirmed.
      save(load().filter(it => !sent.has(idOf(it))));
      return ok;
    })();
    return flushing.finally(() => { flushing = null; });
  }

  // El wiring del evento 'online' vive AQUÍ, una vez (§23): las tres colas
  // (respuestas en vivo, resultados, intentos de tarea) lo copiaban cada una.
  // Guardado para Node/tests (sin window). `flushOnOnline: false` lo desactiva
  // para colas de test o de vida corta.
  if (flushOnOnline && typeof window !== 'undefined') {
    window.addEventListener('online', () => { flush().catch(() => {}); });
  }

  return { enqueue, flush, pending: () => load().length };
}

/**
 * EL VEREDICTO DE UNA ENTREGA, tal y como lo leen las vistas del alumno.
 * `queued:false` sin `rejected` = entregado · `queued:true` = sin red, se
 * reenviará · `rejected:true` = el SERVIDOR lo rechazó y no se reintenta.
 * @typedef {{queued: boolean, rejected?: boolean, error?: string}} Entrega
 */

/**
 * UNA COLA DE ENTREGA DEL ALUMNO, entera: el almacén, el intento directo y la
 * REGLA DEL 403.
 *
 * `core/submitQueue.js` (respuestas en vivo) y `core/attemptQueue.js` (intentos
 * de tarea) eran gemelos y tenían esa regla tecleada dos veces: 403 = VEREDICTO
 * del servidor (§22: sin credencial del dispositivo, fuera de fase, tope
 * agotado, tarea cerrada), y eso no lo arregla reintentar — encolarlo dejaría al
 * alumno con un «se enviará al reconectar» que nunca ocurre. Escrita una vez,
 * los dos ficheros quedan declarativos.
 *
 * @template T
 * @param {{clave: string, send: (it: T) => Promise<unknown>, idOf: (it: T) => string,
 *   esItem: (x: unknown) => boolean}} o
 *   `clave` = la del almacén (su dueño está declarado en LS_OWNERS, §21);
 *   `esItem` estrecha lo releído (es FRONTERA: una entrada a medias de una
 *   versión anterior no debe tumbar el reenvío).
 * @returns {{entregar: (item: T) => Promise<Entrega>, enqueue: (item: T) => void,
 *   flush: () => Promise<number>, pending: () => number}}
 */
export function colaDeEntrega({ clave, send, idOf, esItem }) {
  const cola = createOfflineQueue({
    load: () => /** @type {T[]} */ (lsGetJsonArray(clave).filter(esItem)),
    save: (q) => { lsSet(clave, JSON.stringify(q)); },
    send, idOf,
  });

  /** Intenta entregar YA; si la red falla, encola; si el servidor RECHAZA, no.
   *  @param {T} item @returns {Promise<Entrega>} */
  async function entregar(item) {
    try {
      await send(item);
      return { queued: false };
    } catch (e) {
      if (estadoDe(e) === 403) return { queued: false, rejected: true, error: mensajeDe(e) };
      cola.enqueue(item);
      return { queued: true, error: mensajeDe(e) };
    }
  }

  return { ...cola, entregar };
}
