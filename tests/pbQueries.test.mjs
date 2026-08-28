// LAS TRES CONSULTAS DE PocketBase QUE NADIE PROBABA.
//
// Los 5 recorridos del preflight arrancan con `?backend=local` (prueban las
// COSTURAS de la app, no la red), y `race-e2e` —el único que va contra PB real—
// solo camina la carrera. Resultado: tres consultas por las que pasa toda clase
// no tenían ni test de unidad ni smoke (auditoría v1.51.401):
//
//   · findRoomByCode          → es literalmente el PIN que teclean 30 críos
//   · listPublicActivities    → es TODA la biblioteca pública
//   · listAssignmentsForActivity → la lista de tareas de una actividad
//
// Se prueban con `fetch` inyectado (mismo patrón que tests/liveJoin.test.mjs):
// sin servidor, pero ejercitando el filtro REAL, el escapado y el mapeo de la
// respuesta — que es donde viven los fallos de estas funciones.
//
// Run: node tests/pbQueries.test.mjs
import assert from 'node:assert';
import { createPocketbaseRealtime } from '../adapters/pocketbase/realtime.js';
import { createPocketbaseRemoteStore } from '../adapters/pocketbase/remoteStore.js';
import { createPocketbaseAssignments } from '../adapters/pocketbase/assignments.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const res = (status, obj) => ({
  status, ok: status >= 200 && status < 300,
  text: async () => JSON.stringify(obj ?? {}),
  json: async () => obj ?? {},
});

/** Captura las URLs pedidas y responde con lo que se le diga. */
function espia(responder) {
  const urls = [];
  const real = global.fetch;
  global.fetch = async (url, opts = {}) => { urls.push(String(url)); return responder(String(url), opts); };
  return { urls, restore: () => { global.fetch = real; } };
}

// ── 1. findRoomByCode — el PIN del alumno ──────────────────────────────────
// Lo que importa: que busque en MAYÚSCULAS (el alumno teclea como puede), que
// el código viaje ESCAPADO (§21: nunca encodeURIComponent a pelo) y que del
// blob de la sala salga la forma que espera la vista del alumno.
{
  const espión = espia((url) => {
    if (url.includes('/live_sessions/records')) {
      return res(200, { items: [{
        id: 'sess_1', code: 'LUNA42',
        state: { status: 'open', phase: 'question', currentItem: 2, deadline: '2026-08-07T10:00:00Z', loop: 'rounds' },
        activity: { id: 'a1', title: 'Tildes' },
      }] });
    }
    return res(200, {});
  });
  try {
    const rt = createPocketbaseRealtime({ userId: 'u1' });
    const sala = await rt.findRoomByCode('luna42');
    const url = espión.urls.find(u => u.includes('live_sessions')) || '';
    assert.match(decodeURIComponent(url), /code='LUNA42'/, 'el PIN se busca en MAYÚSCULAS (el alumno teclea como puede)');
    assert.match(espión.urls[0], /filter=code%3D/, 'la expresión del filtro viaja url-encodeada (pbFilterParam)');
    assert.strictEqual(sala.id, 'sess_1');
    assert.strictEqual(sala.current_item, 2, 'el índice de pregunta sale del blob de estado');
    assert.strictEqual(sala.loop, 'rounds', 'y el BUCLE guardado en la sala (de ahí lo leen settle y podio)');
    assert.strictEqual(sala.activity_snap.title, 'Tildes', 'con el snapshot de la actividad');
    ok('findRoomByCode: busca el PIN en mayúsculas, escapado, y devuelve la sala mapeada');
  } finally { espión.restore(); }
}

// ── 1b. Un PIN que no existe devuelve null, no un error ────────────────────
// El alumno se equivoca de dígito constantemente: eso NO puede ser una
// excepción, tiene que ser un "ese PIN no existe" que la vista sepa contar.
{
  const espión = espia(() => res(200, { items: [] }));
  try {
    const rt = createPocketbaseRealtime({ userId: 'u1' });
    assert.strictEqual(await rt.findRoomByCode('NOEXIS'), null, 'PIN inexistente ⇒ null');
    ok('findRoomByCode: un PIN que no existe devuelve null (no revienta la pantalla del alumno)');
  } finally { espión.restore(); }
}

// ── 2. listPublicActivities — TODA la biblioteca ───────────────────────────
// Solo lo PÚBLICO (una actividad en borrador no puede asomar), el idioma como
// filtro opcional, y ordenado por fecha para que lo nuevo se vea primero.
{
  const espión = espia((url) => {
    if (url.includes('/activities/records')) {
      return res(200, { items: [
        { id: 'r1', language: 'es', tags: ['mates'], data: { id: 'a1', title: 'Vieja', updatedAt: '2026-01-01T00:00:00Z' } },
        { id: 'r2', language: 'es', tags: [], data: { id: 'a2', title: 'Nueva', updatedAt: '2026-08-01T00:00:00Z' } },
      ] });
    }
    return res(200, {});
  });
  try {
    const rs = createPocketbaseRemoteStore();
    const filas = await rs.listPublicActivities({ language: 'es', limit: 50 });
    const url = decodeURIComponent(espión.urls.find(u => u.includes('activities')) || '');
    assert.match(url, /visibility='public'/, 'solo lo PÚBLICO: un borrador no puede asomar en la biblioteca');
    assert.match(url, /language='es'/, 'el idioma filtra cuando se pide');
    assert.match(url, /perPage=50/, 'y el tope viaja (la Pi es compartida, §25)');
    assert.deepStrictEqual(filas.map(f => f.data.title), ['Nueva', 'Vieja'], 'lo más reciente, primero');
    assert.deepStrictEqual(filas[1].tags, ['mates'], 'los tags viven en la FILA, no en el blob');
    ok('listPublicActivities: solo público, filtra por idioma, tope y orden por fecha');
  } finally { espión.restore(); }
}

// ── 3. listAssignmentsForActivity — las tareas de una actividad ────────────
{
  const espión = espia((url) => {
    if (url.includes('/assignments/records')) return res(200, {
      items: [{ id: 't1', code: 'ABC123', author_id: 'u1' }, { id: 't2', code: 'ZZZ999', author_id: 'otro-profe' }],
    });
    return res(200, {});
  });
  try {
    const as = createPocketbaseAssignments({ userId: 'u1' });
    const tareas = await as.listAssignmentsForActivity("a'1");
    const url = decodeURIComponent(espión.urls.find(u => u.includes('assignments')) || '');
    assert.match(url, /activity_id='a\\'1'/, 'la comilla del id se ESCAPA con barra (pbEscape), no rompe el filtro');
    assert.match(url, /sort=-created_at/, 'la más reciente arriba');
    assert.match(url, /author_id='u1'/, 'y se piden solo LAS MÍAS (la colección tiene list abierto: el alumno lee la suya)');
    // Y aunque el servidor devolviera de más —list está abierto a propósito—, el
    // predicado compartido las descarta aquí: la tarea de otro profe traía su PIN
    // y sus botones de «Cerrar»/«Rotar PIN», que además funcionan (updateRule=AUTH).
    assert.deepStrictEqual(tareas.map(t => t.code), ['ABC123']);
    ok('listAssignmentsForActivity: filtro escapado, orden por fecha y SOLO mis tareas');
  } finally { espión.restore(); }
}

// ── 4. CONTRA-PRUEBA: sin red, ninguna de las tres se traga el fallo ───────
// R6: si el servidor no responde, la vista tiene que poder DECIRLO. Una
// consulta que devolviera [] en vez de fallar pintaría "no hay nada" — el peor
// mensaje posible cuando lo que pasa es que no hay conexión.
{
  const espión = espia(() => { throw new Error('offline'); });
  try {
    const rt = createPocketbaseRealtime({ userId: 'u1' });
    const rs = createPocketbaseRemoteStore();
    const as = createPocketbaseAssignments({ userId: 'u1' });
    await assert.rejects(() => rt.findRoomByCode('LUNA42'), 'el PIN sin red debe fallar, no decir "no existe"');
    await assert.rejects(() => rs.listPublicActivities({}), 'la biblioteca sin red debe fallar, no salir vacía');
    await assert.rejects(() => as.listAssignmentsForActivity('a1'), 'las tareas sin red, igual');
    ok('CONTRA-PRUEBA (R6): sin red las tres FALLAN en vez de fingir que no hay datos');
  } finally { espión.restore(); }
}

console.log(`\n  ${passed} pbQueries checks passed`);
