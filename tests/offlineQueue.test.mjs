// Offline-queue core (core/offlineQueue.js). Locks the data-loss guarantees:
// de-dupe on enqueue, single-flight flush, partial-failure retention, and the
// critical race — an item enqueued WHILE a flush is mid-await must survive.
// Run: node tests/offlineQueue.test.mjs
import assert from 'node:assert';
import { createOfflineQueue } from '../core/offlineQueue.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// In-memory store standing in for localStorage (already-parsed arrays).
function makeStore(initial = []) {
  let arr = initial.slice();
  return {
    load: () => arr.slice(),
    save: (a) => { arr = a.slice(); },
    peek: () => arr.slice(),
  };
}
const deferred = () => { let resolve, reject; const p = new Promise((res, rej) => { resolve = res; reject = rej; }); return { p, resolve, reject }; };

// ── de-dupe on enqueue ──────────────────────────────────────────────────────
{
  const store = makeStore();
  const q = createOfflineQueue({ ...store, idOf: (it) => it.id, send: async () => {} });
  q.enqueue({ id: 'a', v: 1 });
  q.enqueue({ id: 'a', v: 2 });   // same id → replace, not duplicate
  q.enqueue({ id: 'b', v: 9 });
  assert.deepStrictEqual(store.peek().map(x => x.id), ['a', 'b'], 'no duplica por id');
  assert.strictEqual(store.peek().find(x => x.id === 'a').v, 2, 'el reenvío reemplaza el valor');
  ok('enqueue: de-dupe por idOf');
}

// ── partial failure: failed items stay, sent items go ───────────────────────
{
  const store = makeStore([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  const q = createOfflineQueue({ ...store, idOf: (it) => it.id,
    send: async (it) => { if (it.id === 'b') throw new Error('net'); } });
  const ok1 = await q.flush();
  assert.strictEqual(ok1, 2, 'dos enviados');
  assert.deepStrictEqual(store.peek().map(x => x.id), ['b'], 'solo el fallido permanece');
  ok('flush: retiene fallidos, elimina enviados');
}

// ── single-flight: two concurrent flushes share one run (no double-send) ────
{
  const store = makeStore([{ id: 'a' }, { id: 'b' }]);
  const sends = [];
  const q = createOfflineQueue({ ...store, idOf: (it) => it.id,
    send: async (it) => { sends.push(it.id); } });
  const [r1, r2] = await Promise.all([q.flush(), q.flush()]);
  assert.deepStrictEqual(sends.sort(), ['a', 'b'], 'cada item se envía UNA vez pese a 2 flush()');
  // One flush did the work; the other shared it (same promise) → same count.
  assert.ok(r1 === 2 || r2 === 2, 'el flush activo reporta 2 enviados');
  ok('flush: single-flight (sin doble envío)');
}

// ── THE race: enqueue during an in-flight flush must not be clobbered ────────
{
  const store = makeStore([{ id: 'a' }]);
  const d = deferred();
  const q = createOfflineQueue({ ...store, idOf: (it) => it.id,
    send: async (it) => { if (it.id === 'a') await d.p; } });   // 'a' hangs until we resolve

  const flushP = q.flush();          // loads [a], awaits send(a)
  await Promise.resolve();           // let the flush reach the await
  q.enqueue({ id: 'b', v: 1 });      // student answers another question mid-flush
  d.resolve();                        // a delivered
  const sent = await flushP;

  assert.strictEqual(sent, 1, 'se confirmó el envío de a');
  assert.deepStrictEqual(store.peek().map(x => x.id), ['b'], 'b (encolado durante el flush) SOBREVIVE');
  ok('flush: item encolado durante el flush no se pierde (re-lectura por id)');
}

// ── §23 (R2): el wiring 'online' vive en la factory, no copiado en cada cola ──
{
  const { readFileSync } = await import('node:fs');
  const factory = readFileSync(new URL('../core/offlineQueue.js', import.meta.url), 'utf8');
  if (!/addEventListener\('online'/.test(factory)) throw new Error("la factory debe cablear el flush en 'online'");
  for (const f of ['core/submitQueue.js', 'core/results.js', 'core/attemptQueue.js']) {
    const src = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    if (/addEventListener\('online'/.test(src)) throw new Error(`${f} re-cablea 'online' — eso vive en la factory (una vez)`);
  }
  ok("el flush en 'online' está en la factory; las tres colas ya no lo copian");
}

// vsView (§23): sus setTimeout de ritmo van por ctx (no repintan sobre la vista siguiente).
{
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../views/vsView.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const bare = (src.match(/(?<!life\.)setTimeout\(/g) || []).length;
  if (bare) throw new Error(`views/vsView.js tiene ${bare} setTimeout sin lifecycle — repintan tras cambiar de modo/ruta`);
  if (!/release\('vsView'\)/.test(src)) throw new Error('vsView.dispose debe drenar su ctx (release)');
  ok('vsView: timeouts de ritmo por lifecycle y drenados en dispose');
}

console.log(`\nofflineQueue.test: ${passed} checks passed`);
