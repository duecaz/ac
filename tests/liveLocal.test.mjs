// Simulates the local RealtimePort driver across "tabs": separate driver
// instances sharing one KV (like localStorage) and one channel hub (like
// BroadcastChannel). Proves a LIVE match works in-browser with NO Supabase.
// Run: node tests/liveLocal.test.mjs
import assert from 'node:assert';
import { createLocalRealtime } from '../adapters/local/realtime.js';
import { registerTemplate } from '../core/registry.js';
import { scoreQuizSubmission } from '../templates/quiz/scorer.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

registerTemplate({
  meta: { name: 'qlocal', contentModel: 'qa', modes: { live: true },
          defaultRules: () => ({}), defaultScoring: () => ({}), defaultLive: () => ({}) },
  renderPlayer() {}, renderEditor() {},
  scoreSubmission: scoreQuizSubmission,
  getRoundPayload: (a, ctx) => ({ question: a.content.items[ctx.itemIndex].question }),
});

// Shared "localStorage" across tabs.
function fakeKV() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; }
// Shared "BroadcastChannel" hub with self-exclusion (a poster doesn't hear itself).
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

const activity = {
  id: 'a1', template: 'qlocal',
  scoring: { mode: 'flat', pointsPerCorrect: 1 }, live: { maxPlayers: 10 },
  content: { items: [
    { id: 'q1', question: '2+2', answer: '4', options: ['3', '4'], points: 1 },
    { id: 'q2', question: 'Capital de Perú', answer: 'Lima', options: ['Lima', 'Quito'], points: 2 },
  ] },
};

// host creates the room; everyone subscribes
const { code } = await host.createRoom(activity);
const hostSaw = [];
host.subscribeRoom(code, (c) => hostSaw.push(c.table));
const anaSaw = [];
ana.subscribeRoom(code, (c) => anaSaw.push(c.table));
ok('host creates a room (PIN) and tabs subscribe');

// students join — host gets notified across the channel
const anaP = await ana.joinSession(code, 'Ana');
const betoP = await beto.joinSession(code, 'Beto');
assert.ok(hostSaw.includes('players'), 'host notified of joins via channel');
const players = await host.listPlayers(code);
assert.strictEqual(players.length, 2, 'both joins visible in shared state');
ok('students join from other tabs; host sees them (shared state + channel notify)');

// host starts; students get the phase change
await host.startSession(code);
assert.ok(anaSaw.includes('sessions'), 'student notified of phase change');
const sess = await ana.fetchSession(code);
assert.strictEqual(sess.phase, 'question');
assert.strictEqual(sess.current_item, 0);
ok('host starts the game; students see question phase');

// students answer (not scored yet)
await ana.submitAnswer(code, anaP.playerId, 0, '4', 400);
await beto.submitAnswer(code, betoP.playerId, 0, '3', 700);
const answers = await host.listAnswers(code, 0);
assert.strictEqual(answers.length, 2);
assert.ok(answers.every(a => a.correct === null), 'answers unscored until settle (anti-cheat)');
ok('students submit answers from their tabs; unscored until reveal');

// host reveals → server-side scoring in the engine
await host.settleItem(code, 0);
const lb = await host.leaderboard(code);
assert.deepStrictEqual(lb[0], { rank: 1, name: 'Ana', score: 1 }, 'Ana leads after q1');
assert.ok(anaSaw.includes('answers'), 'students notified of reveal');
ok('host reveals; scoring happens server-side; leaderboard updates across tabs');

// round 2 via setSessionState (as the host view drives it), Beto wins big
await host.setSessionState(code, { phase: 'question', current_item: 1 });
await ana.submitAnswer(code, anaP.playerId, 1, 'Quito', 300);
await beto.submitAnswer(code, betoP.playerId, 1, 'Lima', 500);
await host.settleItem(code, 1);
const final = await host.leaderboard(code);
assert.deepStrictEqual(final.map(r => [r.name, r.score]), [['Beto', 2], ['Ana', 1]], 'final standings across tabs');
ok('multi-round match completes end-to-end with no backend');

console.log(`\nliveLocal.test: ${passed} checks passed`);
