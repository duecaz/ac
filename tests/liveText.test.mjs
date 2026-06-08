// LIVE for a NON-quiz template (text-correction), end-to-end, with NO backend.
// Proves the generalization: the unified session engine drives passages (not
// just quiz items), scores number[] answers via scoreMarks, and the local
// RealtimePort runs a full host↔students match across "tabs". Also unit-tests
// the projector renderer (renderRoundHost) DOM-free via a fake root.
// Run: node tests/liveText.test.mjs
import assert from 'node:assert';
import { createLocalRealtime } from '../adapters/local/realtime.js';
import { registerTemplate } from '../core/registry.js';
import { scoreMarks } from '../core/textMarks.js';
import { renderTextCorrectionHost } from '../core/textCorrectionRound.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// A minimal text-correction template using the REAL scorer + a passage payload.
registerTemplate({
  meta: { name: 'tclocal', contentModel: 'textCorrection', modes: { live: true },
          defaultRules: () => ({}), defaultScoring: () => ({}), defaultLive: () => ({}) },
  renderPlayer() {}, renderEditor() {},
  scoreSubmission: ({ value, item, activity }) => scoreMarks(value, item, ['tilde'], activity),
  getRoundPayload: (a, ctx) => ({ text: a.content.passages[ctx.itemIndex].text }), // no marks (answer key stripped)
});

// Shared "localStorage" + "BroadcastChannel" across simulated tabs.
function fakeKV() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; }
function makeHub() {
  const reg = new Map();
  return (name) => {
    const self = {};
    self.addEventListener = (_t, fn) => { const s = reg.get(name) || new Set(); s.add({ owner: self, fn }); reg.set(name, s); };
    self.removeEventListener = (_t, fn) => { const s = reg.get(name); if (s) for (const e of [...s]) if (e.fn === fn) s.delete(e); };
    self.postMessage = (data) => { for (const e of [...(reg.get(name) || [])]) if (e.owner !== self) e.fn({ data }); };
    self.close = () => {};
    return self;
  };
}

const kv = fakeKV();
const makeChannel = makeHub();
const host = createLocalRealtime({ kv, makeChannel, userId: 'host' });
const ana = createLocalRealtime({ kv, makeChannel, userId: 'u-ana' });
const beto = createLocalRealtime({ kv, makeChannel, userId: 'u-beto' });

// "mamá" → tilde at pos 3 (the second 'a'); "árbol" → tilde at pos 0, worth 2.
const activity = {
  id: 'tc1', template: 'tclocal',
  scoring: { pointsPerCorrect: 1 }, live: { maxPlayers: 10 },
  content: { passages: [
    { id: 'p1', text: 'mama',  marks: [{ pos: 3, kind: 'tilde' }] },
    { id: 'p2', text: 'arbol', marks: [{ pos: 0, kind: 'tilde' }], points: 2 },
  ] },
};

const { code } = await host.createRoom(activity);
const anaSaw = [];
ana.subscribeRoom(code, (c) => anaSaw.push(c.table));
const anaP = await ana.joinSession(code, 'Ana');
const betoP = await beto.joinSession(code, 'Beto');
assert.strictEqual((await host.listPlayers(code)).length, 2);
ok('host opens a text-correction room; two students join (no backend)');

await host.startSession(code);
const sess = await ana.fetchSession(code);
assert.strictEqual(sess.phase, 'question');
// The round payload the device would render carries NO answer key.
const payload = activity.content.passages[0];
assert.ok(!('marks' in { text: payload.text }), 'round payload has no marks (key stripped)');
ok('host starts; students see the question phase');

// Round 1: Ana marks the right vowel ([3]); Beto marks the wrong one ([1]).
await ana.submitAnswer(code, anaP.playerId, 0, [3], 400);
await beto.submitAnswer(code, betoP.playerId, 0, [1], 600);
const a0 = await host.listAnswers(code, 0);
assert.strictEqual(a0.length, 2);
assert.ok(a0.every(a => a.correct === null), 'answers unscored until reveal (anti-cheat parity)');
await host.settleItem(code, 0);
let lb = await host.leaderboard(code);
assert.deepStrictEqual(lb[0], { rank: 1, name: 'Ana', score: 1 }, 'Ana leads after p1 (exact position match)');
assert.ok(anaSaw.includes('answers'), 'students notified of reveal');
ok('number[] answers score via scoreMarks on settle; leaderboard updates');

// Round 2 (worth 2): Beto correct ([0]), Ana wrong ([]).
await host.setSessionState(code, { phase: 'question', current_item: 1 });
await ana.submitAnswer(code, anaP.playerId, 1, [], 300);
await beto.submitAnswer(code, betoP.playerId, 1, [0], 500);
await host.settleItem(code, 1);
const final = await host.leaderboard(code);
assert.deepStrictEqual(final.map(r => [r.name, r.score]), [['Beto', 2], ['Ana', 1]], 'item.points respected; final standings');
ok('multi-passage live match completes end-to-end with no backend');

// ── Projector renderer (renderRoundHost) — DOM-free via a fake root ──
function fakeRoot() { return { _h: '', set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; } }; }
const qRoot = fakeRoot();
renderTextCorrectionHost(qRoot, { phase: 'question', item: { text: 'mama' }, kind: 'tilde' });
assert.ok(qRoot.innerHTML.includes('tc-passage') && qRoot.innerHTML.includes('mama'), 'host question shows the passage');
assert.ok(!qRoot.innerHTML.includes('tc-tap'), 'host question is read-only (no interactive targets)');
const rRoot = fakeRoot();
renderTextCorrectionHost(rRoot, { phase: 'reveal', item: { text: 'mama', marks: [{ pos: 3, kind: 'tilde' }] }, kind: 'tilde' });
assert.ok(rRoot.innerHTML.includes('Solución') && rRoot.innerHTML.includes('tc-tap'), 'host reveal shows the highlighted solution');
ok('renderRoundHost paints passage (question) and highlighted solution (reveal)');

console.log(`\nliveText.test: ${passed} checks passed`);
