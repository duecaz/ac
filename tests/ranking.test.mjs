// S2 — ranking de destacadas (core/ranking.js), puro.
// Run: node tests/ranking.test.mjs
import assert from 'node:assert';
import { computeFeatured, tallyLikes } from '../core/ranking.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const A = { id: 'a', updatedAt: '2026-01-01' };
const B = { id: 'b', updatedAt: '2026-05-01' };
const C = { id: 'c', updatedAt: '2026-03-01' };

// ── ordena por likes desc ────────────────────────────────────────────────────
{
  const out = computeFeatured([A, B, C], { a: 1, b: 5, c: 3 });
  assert.deepStrictEqual(out.map(x => x.id), ['b', 'c', 'a'], 'más likes primero');
  ok('ordena por likes descendente');
}

// ── empate de likes → desempata por plays ────────────────────────────────────
{
  const out = computeFeatured([A, B, C], { a: 2, b: 2, c: 2 }, { a: 0, b: 9, c: 4 });
  assert.deepStrictEqual(out.map(x => x.id), ['b', 'c', 'a'], 'a igual likes, más plays primero');
  ok('desempata por número de partidas');
}

// ── empate total → desempata por updatedAt (más nuevo primero) ───────────────
{
  const out = computeFeatured([A, B, C]); // sin likes ni plays
  assert.deepStrictEqual(out.map(x => x.id), ['b', 'c', 'a'], 'sin señales, más nuevo primero');
  ok('desempata por frescura (updatedAt)');
}

// ── respeta el límite ────────────────────────────────────────────────────────
{
  const out = computeFeatured([A, B, C], { a: 1, b: 5, c: 3 }, {}, 2);
  assert.strictEqual(out.length, 2, 'recorta a limit');
  assert.strictEqual(out[0].id, 'b', 'el mejor va primero');
  ok('respeta el límite de destacadas');
}

// ── tallyLikes cuenta filas {activity,user} ──────────────────────────────────
{
  const by = tallyLikes([{ activity: 'a', user: 'u1' }, { activity: 'a', user: 'u2' }, { activity: 'b', user: 'u1' }]);
  assert.strictEqual(by.a, 2, 'a tiene 2 likes');
  assert.strictEqual(by.b, 1, 'b tiene 1 like');
  ok('tallyLikes agrega por actividad');
}

console.log(`\nranking.test: ${passed} checks passed`);
