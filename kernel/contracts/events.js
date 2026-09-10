// EL BUS DE EVENTOS DE JUEGO, tipado con moderación.
//
// `core/gameEvents.js` es el dueño del catálogo (`GameEvents`) y de las dos
// bocas (`emitGame`/`onGame`); esto solo pone NOMBRE → PAYLOAD para que quien
// escucha sepa qué le llega sin ir a leer los 25 emisores.
//
// MODERACIÓN a propósito: el bus desacopla el juego de la retroalimentación
// (sonidos, efectos, futuras analíticas), así que un oyente que ignore campos
// es NORMAL y los payloads son irregulares — hay emisores que mandan
// `{ idx, points, streak }` y otros `{}` para el mismo evento (Equipos y
// Memoria emiten `ANSWER_CORRECT` pelado). Por eso casi todo campo es opcional:
// declararlos obligatorios haría fallar CI en emisores que están BIEN.
//
//   /** @typedef {import('../kernel/contracts/events.js').GameEventMap} GameEventMap */

/**
 * Nombre de evento → payload. Los nombres son los VALORES de `GameEvents`
 * (`core/gameEvents.js`), no sus claves: 'game:<verbo>' para no chocar con
 * otros usuarios del bus.
 *
 * Va como objeto literal con las claves ENTRECOMILLADAS: un `@property` cuyo
 * nombre lleva dos puntos no se parsea (la clave queda fuera del tipo y quien
 * la indexe recibe un TS7053).
 *
 * `item` es el ítem de la plantilla: cada una tiene el suyo, y ningún oyente de
 * este bus lo interpreta (los sonidos y los efectos solo miran el índice).
 *
 * @typedef {{
 *   'game:lobbyStart': { sessionId?: string },
 *   'game:lobbyEnd': Record<string, never>,
 *   'game:questionShown': { idx: number, total: number, item?: unknown },
 *   'game:reveal': { idx?: number, item?: unknown, ownCorrect?: boolean|null, ownPoints?: number },
 *   'game:answerCorrect': { idx?: number, points?: number, streak?: number },
 *   'game:answerWrong': { idx?: number },
 *   'game:streak': { count: number },
 *   'game:podium': { top: Array<{ name: string, score: number }> },
 *   'game:tick': { remainSec: number },
 * }} GameEventMap
 */

/**
 * Los nombres que el bus admite.
 * @typedef {keyof GameEventMap} GameEventName
 */

/**
 * Emitir. La firma ATA el payload a su nombre: `emitGame('game:streak', {})`
 * deja de compilar, que es justo lo que se quiere de un catálogo estable.
 * @typedef {<K extends GameEventName>(name: K, detail?: GameEventMap[K]) => void} EmitGame
 */

/**
 * Escuchar. Devuelve el desuscriptor (lo trae `listen` de `core/events.js`).
 * @typedef {<K extends GameEventName>(name: K, fn: (detail: GameEventMap[K]) => void) => (() => void)} OnGame
 */

export {};
