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
export function createOfflineQueue({ load, save, send, idOf }) {
  let flushing = null;

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

  return { enqueue, flush, pending: () => load().length };
}
