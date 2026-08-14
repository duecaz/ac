// Sound pack player. Lazy-loads audio per-name. Uses HTMLAudio (simpler than
// Web Audio API for our needs). All playback is best-effort: browsers block
// audio until first user interaction, so silently swallow errors.
//
// Subscribes to gameEvents so callers don't need to know sound names. To
// disable sounds globally, call setMuted(true). To swap pack, setSoundPack().

import { GameEvents, onGame } from './gameEvents.js';
import { lsGet, lsSet } from './ls.js';
import { clock } from './clock.js';

let _pack = {};
const _cache = new Map();           // name -> HTMLAudioElement
let _muted = lsGet('ww.muted') === '1';

// Pack por defecto AUTOALOJADO: los 3 mp3 CC0 viven en `sounds/` DENTRO de este
// repo (los sirve GitHub Pages junto a la app). Antes venían de jsDelivr
// apuntando al repo duecaz/ww-assets — cuando ese repo se volvió PRIVADO, el CDN
// dejó de servirlos y TODA la app enmudeció en silencio (los 404 de Audio no
// avisan). Norma: los assets del juego van dentro del sistema, nunca en un CDN
// externo. Ruta relativa a la PÁGINA (teacher/student/embed.html viven en la raíz).
const ASSET_BASE = 'sounds';
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
  lsSet('ww.muted', _muted ? '1' : '0');
  if (_muted) stopAll();
}
export function isMuted() { return _muted; }

function get(name) {
  if (_cache.has(name)) return _cache.get(name);
  const url = _pack[name];
  if (!url) return null;
  // Sin `Audio` no hay sonido que dar: pasa en Node (este módulo entró en la
  // cadena de los tests al añadir el estado de sonido al reporte de un toque) y
  // en cualquier entorno sin DOM. Devolver null es lo correcto —el llamador ya
  // sabe tratarlo— y evita que un evento del bus reviente la suite entera.
  if (typeof Audio === 'undefined') return null;
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

// POR QUÉ FALLÓ EL SONIDO, ANOTADO. El `catch` vacío que había aquí estaba
// razonado —el navegador bloquea el audio hasta el primer toque y no se puede
// hacer nada— pero convertía «no se oye nada» en un misterio: sin el motivo no
// se distingue un bloqueo de autoplay (NotAllowedError) de un mp3 que ese
// aparato no sabe decodificar (NotSupportedError) de un volumen a cero, y el
// dueño lo reportó desde una pizarra a la que no tenemos acceso. No se le grita
// al profe con un toast por un sonido: se GUARDA, y el chip de versión ya se
// lleva el contexto al portapapeles (core/bugReport.js).
let _ultimoFalloSonido = null;
const anotarFallo = (name) => (e) => {
  _ultimoFalloSonido = `${name}: ${e?.name || 'Error'}${e?.message ? ' · ' + String(e.message).slice(0, 80) : ''}`;
};

/** Lo que hace falta para diagnosticar «no se escucha»: silenciado, si llegó a
 *  sonar algo y el último motivo real de fallo. */
export function estadoSonido() {
  return { silenciado: _muted, sonidosCargados: _cache.size, ultimoFallo: _ultimoFalloSonido };
}

export function play(name) {
  if (_muted) return;
  const a = get(name);
  if (!a) return;
  const cooldown = COOLDOWN_MS[name] ?? 1000;
  if (cooldown > 0) {
    const now = clock.now();
    const last = _lastPlayed.get(name) || 0;
    if (now - last < cooldown) return;
    _lastPlayed.set(name, now);
  }
  try { a.currentTime = 0; a.loop = false; a.play().catch(anotarFallo(name)); } catch (e) { anotarFallo(name)(e); }
}

export function loop(name) {
  if (_muted) return;
  const a = get(name);
  if (!a) return;
  try { a.loop = true; a.play().catch(anotarFallo(name)); } catch (e) { anotarFallo(name)(e); }
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
