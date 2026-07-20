// P1-2 / P1-3: robustez de save() ante cuota llena y flag _unsynced optimista.
// - save() NO debe fingir éxito si el write local falla (persisted:false).
// - save() marca _unsynced ANTES del remoto, para que un cierre de pestaña con el
//   PATCH en vuelo deje el registro flagueado y retryUnsynced lo recupere.
// Run: node tests/storage.test.mjs
import assert from 'node:assert';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Mock de localStorage con modo "lleno" conmutable.
function makeLS() {
  const m = new Map();
  return {
    full: false,
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { if (this.full) throw new DOMException('quota', 'QuotaExceededError'); m.set(k, v); },
    removeItem(k) { m.delete(k); },
    _raw() { return m; },
  };
}
const LS = makeLS();
global.localStorage = LS;
// backendName() → 'local' en Node (sin location) → driver offline, sin red.

const { save, remove, tombstoneSet } = await import('../core/storage.js');

const act = () => ({ id: 'act_test1', template: 'quiz', title: 'T', content: { items: [] } });

// ── save normal: persisted:true + _unsynced optimista en el mapa ─────────────
{
  const { persisted, remote } = save(act());
  remote.catch(() => {}); // el remoto local puede resolver/rechazar; no nos importa aquí
  assert.strictEqual(persisted, true, 'persisted:true cuando el write local funciona');
  const stored = JSON.parse(LS.getItem('ww.activities'))['act_test1'];
  assert.ok(stored, 'el registro quedó en localStorage');
  assert.strictEqual(stored._unsynced, true, '_unsynced:true marcado ANTES de confirmar el remoto (P1-3)');
  ok('save() persiste local y marca _unsynced optimista');
}

// ── save con cuota llena: persisted:false, no finge éxito ────────────────────
{
  LS.full = true;
  const before = LS.getItem('ww.activities');
  const { persisted, remote } = save({ id: 'act_test2', template: 'quiz', title: 'T2', content: { items: [] } });
  remote.catch(() => {});
  assert.strictEqual(persisted, false, 'persisted:false cuando la cuota está llena (P1-2)');
  assert.strictEqual(LS.getItem('ww.activities'), before, 'no se escribió nada nuevo (no finge éxito)');
  LS.full = false;
  ok('save() devuelve persisted:false con la cuota llena');
}

// ── remove() tumba el id SÍNCRONAMENTE (P1-1) ───────────────────────────────
{
  LS.full = false;
  // siembra un registro para borrar
  const { remote: r0 } = save({ id: 'act_del1', template: 'quiz', title: 'Del', content: { items: [] } });
  r0.catch(() => {});
  const p = remove('act_del1');
  // justo tras remove(), y ANTES de que resuelva el DELETE remoto, el id está tumbado
  assert.ok(tombstoneSet().has('act_del1'), 'remove() añade el tombstone de inmediato (bloquea la resurrección por sync)');
  const stored = JSON.parse(LS.getItem('ww.activities'))['act_del1'];
  assert.ok(!stored, 'el registro se borró del mapa local');
  p.catch(() => {});
  ok('remove() tumba el id síncronamente antes del DELETE remoto');
}

console.log(`\nstorage.test: ${passed} checks passed`);
