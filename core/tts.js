// Text-to-speech using Web Speech API. Free, native, works on most modern
// browsers (Chrome/Edge/Safari/Firefox). No external service.
//
// Pick voices by language — falls back to the platform default for the lang.
// Browsers may load voices async; getVoices() can be empty on first call.

const READY = new Promise(resolve => {
  if (typeof speechSynthesis === 'undefined') return resolve(false);
  const voices = speechSynthesis.getVoices();
  if (voices.length) return resolve(true);
  speechSynthesis.addEventListener('voiceschanged', () => resolve(true), { once: true });
  // Fallback timer in case voiceschanged never fires.
  setTimeout(() => resolve(true), 1500);
});

export async function speak(text, { lang = 'es-ES', rate = 1.0, pitch = 1.0, volume = 1.0 } = {}) {
  if (typeof speechSynthesis === 'undefined') return false;
  await READY;
  // Cancel any in-flight utterance so taps replace, not queue.
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text || ''));
  u.lang = lang;
  u.rate = rate;
  u.pitch = pitch;
  u.volume = volume;
  // Pick a voice that matches the lang prefix.
  const voices = speechSynthesis.getVoices();
  const m = voices.find(v => v.lang === lang) || voices.find(v => v.lang?.startsWith(lang.split('-')[0]));
  if (m) u.voice = m;
  speechSynthesis.speak(u);
  return true;
}

export function stop() {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

export function isAvailable() { return typeof speechSynthesis !== 'undefined'; }
