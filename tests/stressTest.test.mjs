// Blinda core/stressTest.js con un PocketBase FALSO en memoria (modela el índice
// único de live_players → 400 en apodo repetido). Verifica que el test de carga
// no se cae, cuenta bien y da veredicto PASA cuando el "servidor" no pierde filas.
// Run: node tests/stressTest.test.mjs
import assert from 'node:assert';
import { runStressTest } from '../core/stressTest.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── PocketBase falso: colecciones en memoria + índice único (session,name) ────
function fakePB() {
  const db = new Map();  // coll -> Map(id -> row)
  let seq = 0;
  const col = (c) => { if (!db.has(c)) db.set(c, new Map()); return db.get(c); };
  const res = (status, obj) => ({ status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(obj ?? {}), json: async () => obj ?? {} });

  return async (url, opts = {}) => {
    const method = opts.method || 'GET';
    const m = url.match(/\/api\/collections\/([^/?]+)\/records(\/([^/?]+))?/);
    if (!m) return res(404, {});
    const coll = m[1], id = m[3];
    const rows = col(coll);

    if (method === 'POST') {
      const body = JSON.parse(opts.body);
      // Índice único de live_players (session,name): rechaza repetido con 400.
      if (coll === 'live_players') {
        for (const r of rows.values()) if (r.session === body.session && r.name === body.name) return res(400, { message: 'validation_not_unique' });
      }
      const row = { id: `r${++seq}`, ...body };
      rows.set(row.id, row);
      return res(200, row);
    }
    if (method === 'DELETE') { rows.delete(id); return res(204); }
    // GET: probe (perPage=1 sin filter) o listado (filtramos por session/assignment).
    const items = [...rows.values()].filter(r => {
      const mm = /filter=([^&]+)/.exec(url);
      if (!mm) return true;
      const f = decodeURIComponent(mm[1]);
      const sid = /session='([^']+)'/.exec(f)?.[1];
      const aid = /assignment_id='([^']+)'/.exec(f)?.[1];
      return (!sid || r.session === sid) && (!aid || r.assignment_id === aid);
    });
    return res(200, { items, totalItems: items.length });
  };
}

// ── servidor sano: 30 alumnos, 0 filas perdidas → PASA ────────────────────────
{
  global.fetch = fakePB();
  const r = await runStressTest({ pbUrl: 'http://fake', n: 30 });
  assert.strictEqual(r.live.playerRows, 30, '30 filas de jugador (ninguna perdida)');
  assert.strictEqual(r.live.uniqueNames, 30, 'apodos todos únicos (el índice sufijó los repetidos)');
  assert.strictEqual(r.live.answerRows, 60, '2 respuestas por jugador');
  assert.strictEqual(r.tasks.attemptRows, 30, '30 intentos de tarea');
  assert.ok(r.ok, 'veredicto PASA con servidor sano');
  ok('runStressTest: 30 concurrentes sin pérdida → PASA (live + tareas)');
}

// ── colecciones ausentes → aborta con nota, sin crashear ──────────────────────
{
  global.fetch = async (url) => ({ status: 404, ok: false, text: async () => '{}', json: async () => ({ message: 'Missing collection' }) });
  const r = await runStressTest({ pbUrl: 'http://fake', n: 10 });
  assert.strictEqual(r.ok, false, 'sin colecciones no pasa');
  assert.ok(r.notes.some(x => x.includes('Falta la colección')), 'avisa qué colección falta');
  ok('runStressTest: aborta limpio si faltan colecciones (guía a "Crear colecciones")');
}

delete global.fetch;
console.log(`\nstressTest.test: ${passed} checks passed`);
