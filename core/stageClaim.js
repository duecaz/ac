// FICHA DE OCUPACIÓN DEL ESCENARIO (ley §23) — quién puede repintar el stage.
//
// El bug real que cierra esto (cazado por la matriz al JUGAR las rondas): la
// Ruleta girada en Individual programa un setTimeout de varios segundos para
// pintar el ganador; si antes de que dispare el profe navega a OTRA actividad
// (o cambia de modo), el timer zombi seguía vivo y su guard —"¿existe
// `#ww-player-widget`?"— miraba un SELECTOR GENÉRICO que también existe en la
// página nueva → la Ruleta se pintaba ENCIMA del VS de Emparejar montado
// después. El mismo agujero vivía en el shell secuencial (`setTimeout(next)` y
// el countdown por ítem sobreviven al cambio de ruta).
//
// El primitivo es el mismo patrón que el guard `while` de deadlineTicker: un
// callback tardío comprueba que SIGUE siendo el dueño antes de tocar el DOM.
// `claimStage(root)` sella el nodo con un número de época y devuelve `alive()`:
//   - otra vista/route → el nodo viejo queda desconectado → alive() false;
//   - otro modo/shell sobre el MISMO nodo → reclama y sube la época → false.
// Quien monta, reclama; quien repinta tarde, pregunta. Sin excepciones.
//
// Acepta selector o elemento (los tests de los shells pasan un objeto plano sin
// document): en un fake sin `isConnected` la época sola decide.
export function claimStage(root) {
  const el = typeof root === 'string' ? (globalThis.document?.querySelector(root) ?? null) : root;
  if (!el) return () => false;
  const epoch = (el.__wwEpoch = (el.__wwEpoch || 0) + 1);
  return () => el.isConnected !== false && el.__wwEpoch === epoch;
}

// `observeStage()` VIVIÓ AQUÍ y se fue con su único llamante (§30). Era para el
// cronómetro del HUD, que pintaba sobre un escenario con dueño y no podía
// reclamarlo —al hacerlo mataba el `alive()` del shell y congelaba el reloj de
// Tildes en 0:00—. Desde que el reloj es UNO y lo monta el propio shell
// (core/reloj.js), quien pinta ya es el dueño y le basta con su `alive()`.
