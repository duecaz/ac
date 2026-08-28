// Driver de la animación de progreso del modo SOLO. Monta la animación elegida
// (presentation.soloAnimation) en `container` y la maneja desde el bus de
// eventos del juego — sin tocar la plantilla. Solo se usa en modo Individual.
import { onGame, GameEvents } from './gameEvents.js';
import { getSoloAnimation } from './soloAnimations.js';
import { sessionItems } from '../kernel/content/sessionItems.js';

/**
 * @param {HTMLElement} container  el carril donde vive la animación
 * @param {object} activity        la actividad (lee presentation.soloAnimation)
 * @returns {{ dispose(): void } | null}
 */
export function mountSoloAnimator(container, activity) {
  if (!container) return null;
  const id = activity?.presentation?.soloAnimation;
  if (!id || id === 'none') { container.innerHTML = ''; container.hidden = true; return null; }
  const provider = getSoloAnimation(id);
  if (!provider) { container.hidden = true; return null; }

  const total = Math.max(1, sessionItems(activity).length);
  const scene = activity?.presentation?.frogScene || 'swamp';
  container.hidden = false;
  let inst;
  try { inst = provider.create(container, { total, scene }); }
  catch { container.hidden = true; return null; }

  // El bus ya transmite el progreso de CUALQUIER plantilla solo:
  //   ANSWER_CORRECT → salto · ANSWER_WRONG → tropiezo · PODIUM → meta.
  const offs = [
    onGame(GameEvents.ANSWER_CORRECT, (d) => { try { inst.hop({ streak: d?.streak || 0 }); } catch {} }),
    onGame(GameEvents.ANSWER_WRONG,   ()  => { try { inst.slip(); } catch {} }),
    onGame(GameEvents.PODIUM,         ()  => { try { inst.finish(); } catch {} }),
  ];

  return {
    dispose() {
      offs.forEach(o => { try { o && o(); } catch {} });
      try { inst.destroy(); } catch {}
      container.innerHTML = '';
      container.hidden = true;
    }
  };
}
