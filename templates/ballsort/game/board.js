// Ball Sort board factory. Pure; depends only on levels.js.
import { getLevel } from './levels.js';
import { shuffle, azar } from '../../../core/azar.js';

/**
 * @typedef {import('../../../kernel/contracts/activity.js').BallsortBoard} BallsortBoard
 */

/** @param {string} [levelId] @returns {BallsortBoard} */
export function createBoard(levelId = 'classic') {
  const level = getLevel(levelId);
  return {
    levelId: level.id,
    colors: [...level.colors],
    tubeCapacity: level.tubeCapacity,
    tubes: level.tubes.map(tube => [...tube])
  };
}

/** @param {BallsortBoard} board @returns {BallsortBoard} */
export function cloneBoard(board) {
  return {
    levelId: board.levelId,
    colors: [...board.colors],
    tubeCapacity: board.tubeCapacity,
    tubes: board.tubes.map(tube => [...tube])
  };
}

// rand: optional () => [0,1) generator (inject a seeded one for reproducible
// boards shared across devices). Por defecto va por el PRIMITIVO (core/azar.js):
// con `Math.random` de defecto nadie inyectaba nunca —ni la plantilla ni el
// editor— y sembrar el azar no llegaba al tablero.
/** @param {string} [levelId] @param {() => number} [rand] @returns {BallsortBoard} */
export function randomBoard(levelId = 'classic', rand = azar.random) {
  const level = getLevel(levelId);
  const numFilled = level.colors.length;
  const totalTubes = level.tubes.length;
  const cap = level.tubeCapacity;

  // Build the full ball pool: cap copies of each color
  /** @type {string[]} */
  const balls = [];
  for (const color of level.colors) {
    for (let i = 0; i < cap; i++) balls.push(color);
  }

  shuffle(balls, rand);

  // Distribute into filled tubes; remaining tubes stay empty
  /** @type {string[][]} */
  const tubes = [];
  for (let t = 0; t < numFilled; t++) {
    tubes.push(balls.slice(t * cap, (t + 1) * cap));
  }
  for (let t = numFilled; t < totalTubes; t++) {
    tubes.push([]);
  }

  return {
    levelId: level.id,
    colors: [...level.colors],
    tubeCapacity: cap,
    tubes
  };
}
