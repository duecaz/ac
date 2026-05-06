export const VERSION = '1.9.3';
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

export const DEFAULT_SCORING = {
  mode: 'flat',            // 'flat' | 'kahoot'
  pointsPerCorrect: 1,
  pointsPerWrong: 0,
  penaltyRatio: 0,
  maxScore: 0              // 0 = sum of pointsPerCorrect * items
};

export const DEFAULT_REVIEW = {
  allowOverride: true,
  showCorrectAnswer: true,
  autoAdvanceToSummary: false,
  skipReview: false
};

export const DEFAULT_PRESENTATION = {
  skin: 'default',
  background: 'none',
  layout: 'auto',
  sound: true,
  showTimer: true,
  showScore: true,
  teams: false
};

export const DEFAULT_LIVE = {
  enabled: true,
  advanceMode: 'manual',           // manual | autoOnAllAnswered | autoOnTimer
  questionTimer: 20,
  lockAnswersOn: 'allAnswered',    // firstOf | timer | allAnswered
  showAnswerAfterEach: true,
  showLeaderboardBetween: true,
  pointsModel: 'kahoot',           // kahoot | flat
  speedBonusMax: 1000,
  allowLateJoin: true,
  maxPlayers: 60,
  nicknameFilter: true,
  streakBonus: false,              // opt-in
  streakBonusPerStep: 50
};

export const DEFAULT_AUTHOR = { id: null, name: null, signedAt: null };
