// EL CONTRATO DE LA SALA EN VIVO tal y como la ven sus pantallas: `HostRt` (lo
// que el ensamblador `views/hostLive.js` inyecta en cada `views/live/host*.js`)
// y `StudentRt` (lo mismo desde `views/studentLive.js` hacia los
// `views/live/student*.js`).
//
// Vive aquí y no en los ensambladores porque es una DECLARACIÓN que leen doce
// módulos: los hijos importaban su tipo del padre que los monta, así que el
// mapa de dependencias decía que cada bucle depende del ensamblador entero
// cuando lo único que necesita es la forma de `rt` (§0: el contrato es del
// contrato, no del que ensambla).
//
// Módulo SOLO de tipos: no exporta nada en tiempo de ejecución.

/**
 * @typedef {import('./activity.js').Activity} Activity
 * @typedef {import('./activity.js').LiveSettings} LiveSettings
 * @typedef {import('./activity.js').SessionItem} SessionItem
 * @typedef {import('./dataPort.js').AnswerView} AnswerView
 * @typedef {import('./session.js').EngineAnswer} EngineAnswer
 * @typedef {import('./session.js').LiveLoop} LiveLoop
 * @typedef {import('./session.js').LiveRoom} LiveRoom
 * @typedef {import('./session.js').Player} Player
 * @typedef {import('./session.js').SnapshotActivity} SnapshotActivity
 * @typedef {import('../../core/registry.js').PlantillaRegistrada} PlantillaRegistrada
 * @typedef {ReturnType<typeof import('../../core/lifecycle.js').acquire>} CicloDeVida
 */

/**
 * EL ESTADO COMPARTIDO DE LA SALA que el ensamblador inyecta en cada fábrica de
 * `views/live/host*.js` (§26: un módulo por bucle, una sola `rt`). Lo que solo
 * lee UN bucle vive dentro de su módulo; aquí está lo que cruza bucles.
 * @typedef {Object} HostRt
 * @property {CicloDeVida} ctx
 * @property {string} rootSel
 * @property {string} code
 * @property {string} sessionId
 * @property {Activity} activity
 * @property {PlantillaRegistrada|null} tpl
 * @property {SessionItem[]} items
 * @property {LiveSettings} live
 * @property {number} timerSec
 * @property {string} advanceMode
 * @property {LiveLoop[]} loops
 * @property {boolean} isBoard
 * @property {string} driverKind
 * @property {(game: boolean) => void} scene
 * @property {LiveRoom} session
 * @property {Player[]} players
 * @property {Array<AnswerView|EngineAnswer>} answers
 * @property {boolean} disposed
 * @property {LiveLoop} loop
 * @property {boolean} autoAdvance
 * @property {number} readSecs
 * @property {(finished: number) => Promise<boolean>} maybeAutoEnd
 * @property {(idx: number) => Promise<void>} openQuestion
 * @property {(repaint: (phaseChanged?: boolean) => void, everyMs: number) => void} startRaceLoop
 * @property {() => string} raceClock
 * @property {() => string} endBadge
 */

/**
 * Lo que `joinSession` devolvió y quedó guardado en sessionStorage: la
 * credencial de ESTE dispositivo en la sala (§22-4).
 * @typedef {{ sessionId: string, playerId: string, name: string }} LivePlayer
 */

/**
 * EL ESTADO COMPARTIDO DE LA SALA que el ensamblador inyecta en cada fábrica de
 * `views/live/student*.js` (§26: un módulo por bucle, una sola `rt`). Lo que
 * solo lee UN bucle vive dentro de su módulo; aquí está lo que cruza bucles.
 *
 * `items` y `tpl` son GETTERS (no campos): la actividad del alumno CAMBIA a
 * mitad de partida —al arrancar la carrera la sala pasa del snapshot saneado a
 * la actividad completa (§22-2)—, así que una copia tomada al montar se queda
 * vieja. Cada bucle los pide cuando los necesita y siempre mira la de ahora.
 * @typedef {Object} StudentRt
 * @property {CicloDeVida} ctx
 * @property {string} rootSel
 * @property {string} code
 * @property {LivePlayer} player
 * @property {LiveRoom} session
 * @property {SnapshotActivity} activity
 * @property {SessionItem[]} items
 * @property {PlantillaRegistrada|null} tpl
 * @property {number} lastQuestionShownAt
 * @property {string|null} lastPhaseKey
 * @property {(() => void)|null} autoFlushQuestion
 * @property {number} myScore
 * @property {number[]|null} raceQueue
 * @property {number} raceCorrectCount
 * @property {number|null} raceFinishMs
 * @property {boolean} qlSpinning
 * @property {() => Promise<void>} refreshSession
 * @property {(msg: string) => void} paintWaiting
 * @property {() => void} paint
 */

export {};
