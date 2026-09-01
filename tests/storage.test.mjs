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

const { save, remove, removeMany, tombstoneSet, setStorageUser, currentStorageUser, list, claimGuestActivities, hasClaimed, sync } = await import('../core/storage.js');

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

// ── BORRAR EN LOTE CUENTA LO QUE DE VERDAD PASÓ ─────────────────────────────
// El admin limpia la biblioteca de OTROS (moderación). Si el servidor rechaza un
// borrado —sin rol admin, reglas sin aplicar, sin red— y la pantalla dice
// «N borradas», la actividad sigue publicada para la clase siguiente y nadie la
// está mirando. Por eso `removeMany` cuenta, y el borrador se inyecta: así el
// rechazo se prueba SIN servidor.
{
  const caidas = new Set(['b', 'd']);
  const falso = async (id) => (caidas.has(id) ? { ok: false, error: 'prohibido (403)' } : { ok: true });
  const r = await removeMany(['a', 'b', 'c', 'd'], { borrar: falso });
  assert.strictEqual(r.hechas, 2, 'cuenta SOLO las que el servidor aceptó');
  assert.deepStrictEqual(r.fallos.map(f => f.id), ['b', 'd'], 'y nombra las que no, para poder decirlo');
  assert.strictEqual(r.fallos[0].error, 'prohibido (403)', 'con el motivo que dio el servidor, no uno inventado');
  ok('removeMany cuenta los borrados de verdad y nombra los rechazados');
}
{
  // CONTRA-PRUEBA: cuando todo va bien no inventa fallos (una regla demasiado
  // desconfiada haría que el camino bueno pareciera roto).
  const r = await removeMany(['x', 'y'], { borrar: async () => ({ ok: true }) });
  assert.strictEqual(r.hechas, 2);
  assert.deepStrictEqual(r.fallos, [], 'CONTRA-PRUEBA: sin fallos cuando el servidor acepta');
  ok('CONTRA-PRUEBA: el camino bueno no inventa rechazos');
}

// ── S1.2: almacén POR USUARIO — dos profes no se mezclan ────────────────────
{
  LS.full = false;
  setStorageUser('guest');            // vuelve al estado base
  // profe u1 guarda
  setStorageUser('u1');
  save({ id: 'act_u1a', template: 'quiz', title: 'de u1', content: { items: [] } }).remote.catch(()=>{});
  const u1list = list().map(a => a.id);
  // profe u2 no ve nada de u1
  setStorageUser('u2');
  const u2list = list().map(a => a.id);
  assert.ok(u1list.includes('act_u1a'), 'u1 ve su actividad');
  assert.ok(!u2list.includes('act_u1a'), 'u2 NO ve la actividad de u1 (aislado por usuario)');
  // guest tampoco (usa la clave legacy)
  setStorageUser('guest');
  assert.ok(!list().some(a => a.id === 'act_u1a'), 'guest tampoco ve las de u1');
  ok('almacén por usuario: dos profes aislados, guest en legacy');
}

// ── S1.3: claim al primer login (idempotente) ───────────────────────────────
{
  LS.full = false;
  // Reset: limpia flag y siembra 2 actividades ANÓNIMAS en la clave legacy.
  LS.removeItem('ww.activities.claimed');
  LS.setItem('ww.activities', JSON.stringify({
    act_leg1: { id: 'act_leg1', template: 'quiz', title: 'Legacy 1', updatedAt: '2026-01-01', content: {} },
    act_leg2: { id: 'act_leg2', template: 'quiz', title: 'Legacy 2', updatedAt: '2026-01-02', content: {} },
  }));
  setStorageUser('prof_A');
  const r1 = claimGuestActivities('prof_A');
  assert.strictEqual(r1.claimed, 2, 'reclama las 2 actividades anónimas');
  assert.ok(hasClaimed(), 'marca el flag global de reclamado');
  const mine = list().map(a => a.id);
  assert.ok(mine.includes('act_leg1') && mine.includes('act_leg2'), 'ahora son de prof_A');
  const stored = JSON.parse(LS.getItem('ww.activities.prof_A'));
  assert.strictEqual(stored.act_leg1._unsynced, true, 'quedan _unsynced para re-subir con owner');
  assert.strictEqual(LS.getItem('ww.activities'), '{}', 'la clave legacy queda vacía tras el claim');
  // Idempotente: segunda llamada no duplica ni re-clama
  const r2 = claimGuestActivities('prof_A');
  assert.strictEqual(r2.claimed, 0, 'segundo claim = 0 (idempotente)');
  // Otro profe en el mismo navegador NO re-clama (ya se hizo globalmente)
  setStorageUser('prof_B');
  assert.strictEqual(claimGuestActivities('prof_B').claimed, 0, 'otro profe no re-clama las mismas');
  ok('claim: adopta anónimas una vez, idempotente, no re-clama entre profes');
}

// ── S1.4: sync() guest = solo local (no toca remoto) ────────────────────────
{
  setStorageUser('guest');
  const out = await sync();  // no debe lanzar ni requerir red
  assert.ok(Array.isArray(out), 'sync() en guest devuelve la lista local sin ir al remoto');
  ok('sync() guest no sincroniza remoto');
}

console.log(`\nstorage.test: ${passed} checks passed`);
