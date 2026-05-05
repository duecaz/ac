// Central game-event bus. Decouples gameplay from feedback systems
// (sounds, effects, analytics, future plugins). Templates and views emit;
// any module can subscribe.
//
// Naming convention: 'game:<verb>' to avoid collisions with other emit/listen
// users. Keep the catalog small and stable — adding here is API surface.

import { emit, listen } from './events.js';

export const GameEvents = Object.freeze({
  LOBBY_START:     'game:lobbyStart',     // { sessionId? }
  LOBBY_END:       'game:lobbyEnd',       // {}
  QUESTION_SHOWN:  'game:questionShown',  // { idx, total, item }
  PLAYER_ANSWERED: 'game:playerAnswered', // { idx } (own answer sent)
  REVEAL:          'game:reveal',         // { idx, item, ownCorrect?, ownPoints? }
  ANSWER_CORRECT:  'game:answerCorrect',  // { idx, points, streak }
  ANSWER_WRONG:    'game:answerWrong',    // { idx }
  STREAK:          'game:streak',         // { count }
  PODIUM:          'game:podium',         // { top: [{name,score}, ...] }
  TICK:            'game:tick'            // { remainSec }
});

export const emitGame = (name, detail) => emit(name, detail || {});
export const onGame = (name, fn) => listen(name, fn);
