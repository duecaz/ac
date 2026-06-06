// Pure MEMORY game core for the shared-screen TEAMS format — a different loop
// from the question→reveal→next flow, so it lives apart from the session engine:
// teams take turns flipping two cards; a match scores a point and KEEPS the turn,
// a miss passes the turn to the next team. No DOM, no network, JSON-serializable
// state → fully simulatable and testable in Node.
//
// A `pairs` activity becomes a deck: each pair → two cards (left + right) sharing
// a pairId; a match is two face-up cards with the same pairId.

function rid(p) { return p + Math.random().toString(36).slice(2, 8); }

export function createMemoryGame(activity, opts = {}) {
  const pairs = (activity?.content?.pairs || []).filter(p => p?.left && p?.right);

  const seedTeams = () => {
    const names = Array.isArray(opts.teams) ? opts.teams
      : (typeof opts.teams === 'number' ? Array.from({ length: opts.teams }, (_, i) => `Equipo ${i + 1}`)
        : ['Equipo 1', 'Equipo 2']);
    return names.map((name, i) => ({ id: 't' + (i + 1), name, score: 0 }));
  };

  const buildDeck = () => {
    const cards = [];
    for (const p of pairs) {
      cards.push({ id: rid('c_'), pairId: p.id, text: String(p.left), matched: false, flipped: false });
      cards.push({ id: rid('c_'), pairId: p.id, text: String(p.right), matched: false, flipped: false });
    }
    // Deterministic shuffle unless a seedOrder is supplied (tests pass one).
    if (Array.isArray(opts.order)) return opts.order.map(i => cards[i]);
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    return cards;
  };

  const state = opts.state ? { ...opts.state } : {
    format: 'memory',
    status: pairs.length ? 'playing' : 'ended',
    teams: seedTeams(),
    turn: 0,            // index into teams[]
    cards: buildDeck(),
    flipped: [],        // ids of the (≤2) currently face-up, unresolved cards
    moves: 0,
  };

  const activeTeam = () => state.teams[state.turn] || null;
  const card = (id) => state.cards.find(c => c.id === id) || null;
  const remaining = () => state.cards.filter(c => !c.matched).length;

  // Flip one card. Returns what happened so the view can animate + time the
  // cover step. A second flip that forms a pair resolves the match immediately;
  // a miss leaves both face-up until cover() is called.
  function flip(cardId) {
    if (state.status !== 'playing') return { ok: false, reason: 'no en juego' };
    if (state.flipped.length >= 2) return { ok: false, reason: 'resuelve el par primero' };
    const c = card(cardId);
    if (!c || c.matched || c.flipped) return { ok: false, reason: 'carta no disponible' };
    c.flipped = true;
    state.flipped.push(c.id);
    if (state.flipped.length < 2) return { ok: true, pair: false };

    state.moves++;
    const [a, b] = state.flipped.map(card);
    if (a.pairId === b.pairId) {
      a.matched = b.matched = true;
      const t = activeTeam();
      if (t) t.score += 1;
      state.flipped = [];
      if (remaining() === 0) state.status = 'ended';
      // Match → same team plays again.
      return { ok: true, pair: true, matched: true, keepsTurn: true, ended: state.status === 'ended' };
    }
    // Miss → cards stay up until cover(); turn will pass then.
    return { ok: true, pair: true, matched: false, keepsTurn: false };
  }

  // Flip the two missed cards back down and pass the turn. No-op unless exactly
  // two unmatched cards are face-up.
  function cover() {
    if (state.flipped.length !== 2) return { ok: false };
    for (const id of state.flipped) { const c = card(id); if (c && !c.matched) c.flipped = false; }
    state.flipped = [];
    state.turn = (state.turn + 1) % state.teams.length;
    return { ok: true };
  }

  function leaderboard() {
    return [...state.teams].sort((x, y) => y.score - x.score)
      .map((t, i) => ({ rank: i + 1, name: t.name, score: t.score, id: t.id }));
  }

  return {
    state, flip, cover, leaderboard, activeTeam,
    get status() { return state.status; },
    get totalPairs() { return pairs.length; },
  };
}
