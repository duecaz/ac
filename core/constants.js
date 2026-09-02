import { DEFAULT_POLICY, DEFAULT_FIRST_N, DEFAULT_MINUTES } from './liveEnd.js';

export const VERSION = '1.51.656';
export const SCHEMA_VERSION = 4;

// PIN alphabet: no O/I/0/1 to avoid ambiguity. 6 chars => 32^6 ≈ 1.07B combos.
export const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const PIN_LENGTH = 6;

export const FEEDBACK_DELAY = 900;

export const DEFAULT_RULES = {
  timer: 0,                // seconds per item, 0 = no timer
  randomize: false,        // shuffle items order
  shuffleOptions: true,    // shuffle options per item
  templateOptions: {}
};

// `penaltyRatio`: prometido sin mecánica; retirado por el dueño (barrido B1,
// 2026-09-02) — pointsPerWrong ya resta por fallo.
export const DEFAULT_SCORING = {
  mode: 'flat',            // 'flat' (puntos planos) | 'velocidad' (bonus por rapidez)
  pointsPerCorrect: 1,
  pointsPerWrong: 0,
  maxScore: 0              // 0 = sum of pointsPerCorrect * items
};

// `showCorrectAnswer`, `autoAdvanceToSummary`, `skipReview` se quitaron del
// esquema (barrido B1 2026-09-02): sin escritor ni lector — nadie los leía.
export const DEFAULT_REVIEW = {
  allowOverride: true,
  alFinal: true            // la corrección sale al terminar, no entre hojas
};

/** ¿SE CORRIGE AL FINAL? Con UN dueño, porque lo preguntan DOS sitios: el runner
 *  (para saltarse la corrección entre frases) y el editor (para marcar la
 *  casilla). Escrito dos veces, un `!== false` aquí y un `=== true` allí darían
 *  defectos OPUESTOS y nadie lo notaría hasta tener la clase delante — que es
 *  exactamente la forma de fallo que se repitió tres veces esta semana.
 *  Vive aquí, junto al defecto que lee, y no en la ronda: el editor no tiene por
 *  qué cargarse el módulo del lienzo para responder a una pregunta de una línea. */
export const corrigeAlFinal = (activity) => activity?.review?.alFinal !== false;

// `layout`, `showScore`, `showTimer` se quitaron del esquema (barrido B1
// 2026-09-02): sin escritor ni lector — nadie los leía.
export const DEFAULT_PRESENTATION = {
  skin: 'default',
  background: 'none',
  sound: true,
  teams: false
};

export const DEFAULT_LIVE = {
  enabled: true,
  advanceMode: 'manual',           // manual | autoOnAllAnswered | autoOnTimer
  questionTimer: 20,
  lockAnswersOn: 'allAnswered',    // firstOf | timer | allAnswered
  showAnswerAfterEach: true,
  showLeaderboardBetween: true,
  pointsModel: 'velocidad',        // 'velocidad' (bonus por rapidez) | 'flat'
  speedBonusMax: 1000,
  allowLateJoin: true,
  maxPlayers: 60,
  nicknameFilter: true,
  streakBonus: false,              // opt-in
  streakBonusPerStep: 50,
  // POLÍTICA DE FIN de carrera/tablero (core/liveEnd.js, §21b UN DUEÑO): los
  // números salen de allí, no se copian aquí — dos copias del mismo "3" acaban
  // diciendo cosas distintas el día que uno cambia y el otro no.
  endPolicy: DEFAULT_POLICY,       // all | firstN | time
  endN: DEFAULT_FIRST_N,
  endMinutes: DEFAULT_MINUTES
};

export const DEFAULT_AUTHOR = { id: null, name: null, signedAt: null };
