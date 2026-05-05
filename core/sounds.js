// Sound pack player. Lazy-loads audio per-name. Uses HTMLAudio (simpler than
// Web Audio API for our needs). All playback is best-effort: browsers block
// audio until first user interaction, so silently swallow errors.
//
// Sound URLs come from the active skin OR a default CDN pack (CC0). Set via
// setSoundPack({lobby, tick, reveal, correct, wrong, podium}).

let _pack = {};
const _cache = new Map();           // name -> HTMLAudioElement
let _muted = localStorage.getItem('ww.muted') === '1';

// Default CC0 pack on jsdelivr (mirror of public sound libraries).
// These are short, royalty-free game sounds.
const DEFAULT_PACK = {
  lobby:   'https://cdn.jsdelivr.net/gh/duecaz/ww-assets@main/sounds/lobby.mp3',
  tick:    'https://cdn.jsdelivr.net/gh/duecaz/ww-assets@main/sounds/tick.mp3',
  reveal:  'https://cdn.jsdelivr.net/gh/duecaz/ww-assets@main/sounds/reveal.mp3',
  correct: 'https://cdn.jsdelivr.net/gh/duecaz/ww-assets@main/sounds/correct.mp3',
  wrong:   'https://cdn.jsdelivr.net/gh/duecaz/ww-assets@main/sounds/wrong.mp3',
  podium:  'https://cdn.jsdelivr.net/gh/duecaz/ww-assets@main/sounds/podium.mp3'
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

export function play(name) {
  if (_muted) return;
  const a = get(name);
  if (!a) return;
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
