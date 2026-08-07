// FICHA DE OCUPACIÓN DEL ESCENARIO (§23) — el repintado zombi no vuelve.
//
// Bug real (cazado por la matriz al JUGAR las rondas, v1.51.389): el giro de la
// Ruleta programa un setTimeout de varios segundos; si el profe navegaba a otra
// actividad antes de que disparara, el timer pintaba la Ruleta ENCIMA del juego
// nuevo — su guard miraba un selector GENÉRICO que también existe en la página
// siguiente. El mismo agujero vivía en el shell secuencial (setTimeout(next) y
// el countdown por ítem sobreviven al cambio de ruta/modo).
//
// La norma: quien monta RECLAMA el escenario (claimStage); un callback tardío
// pregunta alive() antes de tocar el DOM. Y la contra-prueba importa igual:
// el flujo legítimo (avanzar, terminar, guardar) sigue funcionando intacto.
//
// Run: node tests/stageClaim.test.mjs
import assert from 'node:assert';
import { claimStage } from '../core/stageClaim.js';
import { runSequentialPlayer, runFreeformPlayer } from '../core/soloPlayer.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const makeRoot = () => ({ innerHTML: '', querySelector: () => null, querySelectorAll: () => [] });

// Timers falsos en cola (mismo patrón que soloPlayer.test): el orden async real
// se conserva y el zombi se dispara CUANDO queremos, no inline.
const realSetTimeout = global.setTimeout;
const timerQueue = [];
global.setTimeout = (fn) => { timerQueue.push(fn); return timerQueue.length; };
const drain = () => { while (timerQueue.length) timerQueue.shift()(); };

try {
  // ── 1. El primitivo: reclamar otra vez invalida la ficha anterior ─────────
  {
    const el = makeRoot();
    const alive1 = claimStage(el);
    assert.strictEqual(alive1(), true, 'recién reclamado, vivo');
    const alive2 = claimStage(el);
    assert.strictEqual(alive1(), false, 'el dueño anterior deja de estarlo');
    assert.strictEqual(alive2(), true, 'el nuevo dueño sí');
    ok('claimStage: reclamar el mismo nodo invalida al dueño anterior');
  }

  // ── 2. Un nodo desconectado (cambio de ruta) tampoco está vivo ────────────
  {
    const el = { ...makeRoot(), isConnected: true };
    const alive = claimStage(el);
    assert.strictEqual(alive(), true);
    el.isConnected = false;   // el router reemplazó #app: el nodo viejo quedó suelto
    assert.strictEqual(alive(), false, 'nodo desconectado ⇒ muerto');
    assert.strictEqual(claimStage(null)(), false, 'sin nodo no hay escenario');
    ok('claimStage: un nodo desconectado por el router está muerto');
  }

  // ── 3. EL BUG DE LA RULETA, en el shell: el avance zombi no repinta ───────
  // submit() deja un setTimeout(next) pendiente; si ANTES de que dispare otro
  // modo reclama el escenario, ese next() debe descartarse (ni idx++, ni mount).
  {
    const root = makeRoot();
    const activity = { id: 'z1', template: 'math', rules: {}, scoring: {},
      content: { items: [{ id: 'a', answer: '1' }, { id: 'b', answer: '2' }] } };
    const vistos = [];
    runSequentialPlayer(root, activity, { mode: 'zombi-test' }, {
      renderItem(ctx) { vistos.push(ctx.idx); ctx.submit({ itemId: ctx.item.id, correct: true, points: 1 }); },
      maxScore: () => 2,
    });
    assert.deepStrictEqual(vistos, [0], 'el ítem 0 se pintó y su avance quedó en cola');
    claimStage(root);          // ← otro modo monta encima (runMode hace esto)
    root.innerHTML = 'VS';     // …y pinta lo suyo
    drain();                   // el setTimeout(next) zombi dispara AHORA
    assert.deepStrictEqual(vistos, [0], 'el avance zombi NO pintó el ítem 1');
    assert.strictEqual(root.innerHTML, 'VS', 'y el DOM del modo nuevo quedó intacto');
    ok('secuencial: un avance pendiente tras reclamar el escenario se descarta');
  }

  // ── 4. Y el final zombi del shell libre ni guarda ni repinta ──────────────
  {
    const root = makeRoot();
    let onFinishLlamado = false;
    const ctx = runFreeformPlayer(root, { id: 'z2', template: 'wheel', content: {} },
      { mode: 'zombi-test', onFinish: () => { onFinishLlamado = true; } });
    claimStage(root);
    root.innerHTML = 'OTRA VISTA';
    const r = ctx.finish({ score: 3, maxScore: 3 });
    assert.strictEqual(r, undefined, 'el finish zombi no devuelve resultado');
    assert.strictEqual(root.innerHTML, 'OTRA VISTA', 'ni pisa el DOM ajeno');
    assert.strictEqual(onFinishLlamado, false, 'ni dispara onFinish');
    ok('libre: un finish zombi ni guarda ni repinta ni notifica');
  }

  // ── 5. CONTRA-PRUEBA: el flujo legítimo sigue entero ──────────────────────
  // Endurecer no puede romper el camino normal: sin nadie que reclame encima,
  // la partida avanza los 2 ítems y termina con su resultado.
  {
    const root = makeRoot();
    const activity = { id: 'z3', template: 'math', rules: {}, scoring: {},
      content: { items: [{ id: 'a', answer: '1' }, { id: 'b', answer: '2' }] } };
    let fin = null;
    const vistos = [];
    runSequentialPlayer(root, activity, { mode: 'zombi-test', onFinish: (s) => { fin = s; } }, {
      renderItem(ctx) { vistos.push(ctx.idx); ctx.submit({ itemId: ctx.item.id, correct: true, points: 1 }); },
      maxScore: () => 2,
    });
    drain(); drain();
    assert.deepStrictEqual(vistos, [0, 1], 'los dos ítems se jugaron');
    assert.ok(fin, 'y la partida terminó con onFinish');
    assert.strictEqual(fin.score, 2);
    ok('CONTRA-PRUEBA: sin reclamo ajeno, la partida avanza y termina igual que siempre');
  }
} finally {
  global.setTimeout = realSetTimeout;
}

console.log(`\n  ${passed} stageClaim checks passed`);
