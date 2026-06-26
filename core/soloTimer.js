// Cuenta regresiva única para los players SOLO (Quiz, Froggy, Wordsearch tenían
// cada uno su propio setInterval casi idéntico). Mantiene la lógica de tiempo en
// UN solo sitio para que un bug se arregle una vez.
//
// Es PURO: no toca el DOM ni emite eventos. El player decide qué hacer en cada
// tick (pintar su badge, emitir GameEvents.TICK, etc.) vía los callbacks. Las
// funciones de scheduling son inyectables para poder testear el conteo sin
// esperar segundos reales.
//
//   const t = createCountdown(20, {
//     onTick: (remaining) => { badge.textContent = `⏱ ${remaining}`; },
//     onTimeout: () => advance(),
//   });
//   t.start();   // arranca el conteo
//   t.stop();    // detiene (idempotente)
//
// Contrato de ticks: con N segundos emite onTick(N-1), onTick(N-2), …, onTick(0)
// y en ese último tick (remaining<=0) llama onTimeout() UNA vez y se detiene.
// Con seconds<=0 no hace nada (no hay límite de tiempo).
export function createCountdown(seconds, {
  onTick,
  onTimeout,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  let remaining = seconds;
  let handle = null;
  let done = false;

  function tick() {
    remaining--;
    try { onTick?.(remaining); } catch (e) { console.warn('[soloTimer] onTick lanzó:', e); }
    if (remaining <= 0) {
      stop();
      if (!done) { done = true; try { onTimeout?.(); } catch (e) { console.warn('[soloTimer] onTimeout lanzó:', e); } }
    }
  }

  function start() {
    if (handle || done || !(seconds > 0)) return;
    remaining = seconds;
    handle = setIntervalFn(tick, 1000);
  }

  function stop() {
    if (handle) { clearIntervalFn(handle); handle = null; }
  }

  return {
    start,
    stop,
    get remaining() { return remaining; },
    get running() { return handle !== null; },
  };
}
