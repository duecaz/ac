// Reloj inyectable. Centraliza el acceso al tiempo "ahora" para que la lógica
// de dominio (timers, colas, anti-spam, antigüedad de errores) sea testeable:
// en producción `clock.now()` === `Date.now()`; en un test se reemplaza con
//   import { clock } from '../core/clock.js';
//   clock.now = () => 1_000_000;   // tiempo congelado/avanzable
// y se restaura al terminar. No cambia ninguna API de producción.
export const clock = {
  now: () => Date.now(),
};
