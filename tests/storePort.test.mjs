// PARIDAD DEL PUERTO DE DATOS — los dos adaptadores (local y PocketBase)
// responden lo mismo a lo que el dominio les pide.
//
// Gemelo de `tests/realtimePort.test.mjs`, que ya hacía esto para el transporte
// en vivo. El almacén no lo tenía, y la auditoría del 2026-09-10 encontró por
// qué importa: `listResults()` tenía **firma y forma de retorno distintas** en
// cada backend —local ignoraba el `activityId` y devolvía el log entero en
// camelCase; PocketBase filtraba y devolvía filas en snake_case—. Hoy solo lo
// lee el diagnóstico (que cuenta cuántas hay), así que no rompía nada: es
// exactamente la clase de divergencia que espera a que alguien la use.
//
// Qué se comprueba y qué NO: aquí van la SUPERFICIE (qué métodos existen), la
// ARIDAD (cuántos argumentos declaran) y la FORMA de lo que devuelven en los
// casos que se pueden ejercitar sin red. Lo que NO se comprueba es la política
// del servidor (el tope de intentos, las reglas de PocketBase): eso es del
// backend y tiene sus propias suites.
//
// Run: node tests/storePort.test.mjs
import assert from 'node:assert';
import { createLocalRemoteStore } from '../adapters/local/remoteStore.js';
import { createPocketbaseRemoteStore } from '../adapters/pocketbase/remoteStore.js';
import { createLocalAssignments } from '../adapters/local/assignments.js';
import { createPocketbaseAssignments } from '../adapters/pocketbase/assignments.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const local = createLocalRemoteStore();
const pb = createPocketbaseRemoteStore();
const locA = createLocalAssignments();
const pbA = createPocketbaseAssignments();

// ── 1. La superficie del almacén: quién tiene qué ──────────────────────────
// No se exige que sean idénticas: hay métodos que SOLO tienen sentido contra un
// backend real (contar por dueño, sondear el payload). Lo que se exige es que
// esa asimetría esté DECLARADA aquí y que el consumidor la trate con un guard
// —`core/storage.js` lo hace con `typeof rs.x === 'function'`—, en vez de
// romperse en local el día que alguien la llame.
const SOLO_PB = ['countActivitiesByOwner', 'probeActivitiesPayload'];
{
  const mLocal = Object.keys(local).filter(k => typeof local[k] === 'function').sort();
  const mPb = Object.keys(pb).filter(k => typeof pb[k] === 'function').sort();
  const faltanEnLocal = mPb.filter(m => !mLocal.includes(m));
  const faltanEnPb = mLocal.filter(m => !mPb.includes(m));

  assert.deepStrictEqual(faltanEnPb, [],
    `el adaptador de PocketBase no implementa: ${faltanEnPb.join(' · ')} — en local "funciona" y en clase no`);
  assert.deepStrictEqual(faltanEnLocal, SOLO_PB,
    `asimetría NO declarada en el almacén: ${faltanEnLocal.join(' · ')}\n`
    + '   o la implementa el local, o se añade a SOLO_PB con su motivo (y el consumidor la llama con guard)');
  ok(`superficie del almacén: ${mPb.length} métodos, y la única asimetría es la declarada (${SOLO_PB.join(' · ')})`);
}

// ── 2. ARIDAD: el mismo método pide los mismos argumentos ──────────────────
// Aquí saltó la divergencia real: `listResults(activityId)` en PocketBase y
// `listResults()` en local, que ignoraba el filtro en silencio.
{
  const comunes = Object.keys(local).filter(k => typeof local[k] === 'function' && typeof pb[k] === 'function');
  const distintas = comunes
    .filter(m => local[m].length !== pb[m].length)
    .map(m => `${m}(local ${local[m].length} args ≠ pb ${pb[m].length})`);
  assert.deepStrictEqual(distintas, [],
    `mismo método, distinta aridad: ${distintas.join(' · ')} — el que ignora un argumento lo hace en SILENCIO`);
  ok(`aridad idéntica en los ${comunes.length} métodos comunes del almacén`);
}

// ── 3. Las tareas: misma superficie y misma aridad ─────────────────────────
{
  const mLoc = Object.keys(locA).filter(k => typeof locA[k] === 'function').sort();
  const mPb = Object.keys(pbA).filter(k => typeof pbA[k] === 'function').sort();
  assert.deepStrictEqual(mLoc, mPb, 'los dos adaptadores de tareas tienen que exponer los mismos métodos');
  const distintas = mLoc.filter(m => locA[m].length !== pbA[m].length)
    .map(m => `${m}(local ${locA[m].length} ≠ pb ${pbA[m].length})`);
  assert.deepStrictEqual(distintas, [], `tareas, aridad distinta: ${distintas.join(' · ')}`);
  ok(`las tareas: ${mLoc.length} métodos con la misma firma en los dos adaptadores`);
}

// ── 4. `listResults` FILTRA en los dos (se ejercita el local de verdad) ────
{
  await local.saveResult({ _qid: 'q1', activityId: 'act-A', scoreAuto: 3 });
  await local.saveResult({ _qid: 'q2', activityId: 'act-B', scoreAuto: 5 });
  const todos = await local.listResults();
  const soloA = await local.listResults('act-A');
  assert.strictEqual(todos.length, 2, 'sin filtro devuelve todo');
  assert.strictEqual(soloA.length, 1, 'con actividad, el local también FILTRA (antes se comía el argumento)');
  assert.strictEqual(soloA[0].activityId, 'act-A');
  ok('listResults(activityId) filtra en el adaptador local, como en PocketBase');
}

// ── 5. CONTRA-PRUEBA: la red distingue una divergencia de verdad ───────────
// Sin esto, los asserts de arriba pasarían igual con dos objetos vacíos.
{
  const falsoLocal = { listResults: () => [] };                 // 0 args
  const falsoPb = { listResults: (activityId) => [] };          // 1 arg
  const distintas = Object.keys(falsoLocal)
    .filter(m => falsoLocal[m].length !== falsoPb[m].length);
  assert.deepStrictEqual(distintas, ['listResults'],
    'la comprobación de aridad tiene que ver una diferencia plantada a propósito');

  const sinMetodo = {};
  assert.ok(typeof sinMetodo.saveResult !== 'function',
    'y la de superficie, un método ausente');
  ok('CONTRA-PRUEBA: la red ve una aridad distinta y un método ausente plantados a propósito');
}

console.log(`\n  ${passed} storePort checks passed`);
