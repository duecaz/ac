// Deuda A — joinSession contra la colección live_players. Verifica que el
// adaptador PocketBase, con la colección presente, CREA una fila por jugador y
// reintenta con sufijo cuando el índice único (session,name) rechaza un apodo
// repetido. Sin server: se inyecta `global.fetch` con un guion mínimo.
// Run: node tests/liveJoin.test.mjs
import assert from 'node:assert';
import { createPocketbaseRealtime } from '../adapters/pocketbase/realtime.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Respuesta fetch falsa con la forma que consume pbFetch/playersReady.
function res(status, obj) {
  const body = JSON.stringify(obj ?? {});
  return { status, ok: status >= 200 && status < 300, text: async () => body, json: async () => obj ?? {} };
}

// Guion: colección presente; sala en lobby; sin fila previa; el PRIMER POST
// colisiona (apodo ocupado → 400), el segundo entra.
function makeFetch({ postsFail = 1 } = {}) {
  const posts = [];
  let postCount = 0;
  const fetch = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    if (method === 'POST' && url.includes(`/live_players/records`)) {
      const body = JSON.parse(opts.body);
      posts.push(body.name);
      postCount++;
      if (postCount <= postsFail) return res(400, { message: 'validation_not_unique' });
      return res(200, { id: 'row_' + postCount, name: body.name, user_id: body.user_id });
    }
    if (url.includes('/live_players/records') && !url.includes('filter=')) return res(200, { items: [], totalItems: 0 }); // playersReady probe
    if (url.includes('/live_players/records') && url.includes('user_id')) return res(200, { items: [] });                  // reconexión: sin fila
    if (url.includes('/live_players/records')) return res(200, { items: [], totalItems: 0 });                             // conteo de aforo
    if (url.includes('/live_sessions/records')) return res(200, { items: [{ id: 'sess1', code: 'ABCDE', state: { status: 'lobby' }, activity: { live: {} } }] });
    return res(200, {});
  };
  return { fetch, posts };
}

// ── apodo libre a la primera ─────────────────────────────────────────────────
{
  const { fetch, posts } = makeFetch({ postsFail: 0 });
  global.fetch = fetch;
  const rt = createPocketbaseRealtime({ userId: 'u1' });
  const r = await rt.joinSession('abcde', 'Ana');
  assert.strictEqual(r.playerId, 'row_1', 'playerId = id de la fila');
  assert.strictEqual(r.name, 'Ana');
  assert.deepStrictEqual(posts, ['Ana'], 'un solo POST');
  ok('joinSession crea una fila live_players (playerId = id de fila)');
}

// ── colisión de apodo → reintenta "Ana 2" ────────────────────────────────────
{
  const { fetch, posts } = makeFetch({ postsFail: 1 });
  global.fetch = fetch;
  const rt = createPocketbaseRealtime({ userId: 'u2' });
  const r = await rt.joinSession('abcde', 'Ana');
  assert.strictEqual(r.name, 'Ana 2', 'el índice único fuerza el sufijo');
  assert.deepStrictEqual(posts, ['Ana', 'Ana 2'], 'reintenta con sufijo tras el 400');
  ok('joinSession sufija el apodo ante colisión del índice único (atómico)');
}

// ── reconexión: si ya hay fila para este user_id, la conserva ─────────────────
{
  global.fetch = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    if (url.includes('/live_players/records') && !url.includes('filter=')) return res(200, { items: [], totalItems: 0 });
    if (url.includes('/live_players/records') && url.includes('user_id')) return res(200, { items: [{ id: 'row_prev', name: 'Beto', user_id: 'u3' }] });
    if (url.includes('/live_sessions/records')) return res(200, { items: [{ id: 'sess1', state: { status: 'running' }, activity: { live: { allowLateJoin: true } } }] });
    if (method === 'POST') throw new Error('no debería crear fila nueva en reconexión');
    return res(200, {});
  };
  const rt = createPocketbaseRealtime({ userId: 'u3' });
  const r = await rt.joinSession('abcde', 'Beto');
  assert.strictEqual(r.playerId, 'row_prev', 'reconexión conserva la fila existente');
  ok('joinSession reconecta a la fila del mismo user_id (no duplica)');
}

delete global.fetch;
console.log(`\nliveJoin.test: ${passed} checks passed`);
