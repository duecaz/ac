// Sound pack player. Lazy-loads audio per-name. Uses HTMLAudio (simpler than
// Web Audio API for our needs). All playback is best-effort: browsers block
// audio until first user interaction, so silently swallow errors.
//
// Subscribes to gameEvents so callers don't need to know sound names. To
// disable sounds globally, call setMuted(true). To swap pack, setSoundPack().

import { GameEvents, onGame } from './gameEvents.js';

let _pack = {};
const _cache = new Map();           // name -> HTMLAudioElement
let _muted = localStorage.getItem('ww.muted') === '1';

// Default pack on jsDelivr serving from the public repo duecaz/ww-assets.
// Three CC0 files are mapped onto the six game events (some events share).
const ASSET_BASE = 'https://cdn.jsdelivr.net/gh/duecaz/ww-assets@main/sounds';
const DEFAULT_PACK = {
  lobby:   null,                          // intentionally silent
  tick:    `${ASSET_BASE}/click.mp3`,     // soft click for ticks/UI
  reveal:  `${ASSET_BASE}/click.mp3`,
  correct: `${ASSET_BASE}/win.mp3`,
  wrong:   `${ASSET_BASE}/fail.mp3`,
  podium:  `${ASSET_BASE}/win.mp3`
};

export function setSoundPack(pack) {
  _pack = { ...DEFAULT_PACK, ...(pack || {}) };
  _cache.clear();
}
setSoundPack(null); // initialize default

export function setMuted(m) {
  _muted = !!m;
  localStorage.setItem('ww.muted', _muted ? '1' : '0');
  if (_muted) stopAll();
}
export function isMuted() { return _muted; }

function get(name) {
  if (_cache.has(name)) return _cache.get(name);
  const url = _pack[name];
  if (!url) return null;
  const a = new Audio(url);
  a.preload = 'auto';
  _cache.set(name, a);
  return a;
}

// Per-sound cooldown (ms). Prevents duplicate fires when the same event
// gets emitted multiple times in quick succession (e.g. realtime UPDATE
// coalescing or any stray re-render). Lobby has no cooldown — it loops.
const COOLDOWN_MS = { tick: 800, reveal: 1500, correct: 1500, wrong: 1500, podium: 5000, lobby: 0 };
const _lastPlayed = new Map();

export function play(name) {
  if (_muted) return;
  const a = get(name);
  if (!a) return;
  const cooldown = COOLDOWN_MS[name] ?? 1000;
  if (cooldown > 0) {
    const now = Date.now();
    const last = _lastPlayed.get(name) || 0;
    if (now - last < cooldown) return;
    _lastPlayed.set(name, now);
  }
  try { a.currentTime = 0; a.loop = false; a.play().catch(() => {}); } catch {}
}

export function loop(name) {
  if (_muted) return;
  const a = get(name);
  if (!a) return;
  try { a.loop = true; a.play().catch(() => {}); } catch {}
}

export function stop(name) {
  const a = _cache.get(name);
  if (!a) return;
  try { a.pause(); a.currentTime = 0; } catch {}
}

export function stopAll() {
  for (const a of _cache.values()) { try { a.pause(); } catch {} }
}

// Wire game events to sound effects. Subscriptions live for the page lifetime.
onGame(GameEvents.LOBBY_START,    () => loop('lobby'));
onGame(GameEvents.LOBBY_END,      () => stop('lobby'));
onGame(GameEvents.QUESTION_SHOWN, () => stop('lobby'));
onGame(GameEvents.TICK,           () => play('tick'));
onGame(GameEvents.REVEAL,         () => play('reveal'));
onGame(GameEvents.ANSWER_CORRECT, () => play('correct'));
onGame(GameEvents.ANSWER_WRONG,   () => play('wrong'));
onGame(GameEvents.PODIUM,         () => { stopAll(); play('podium'); });
