// Ball Sort levels. Copied from the standalone game (yu) — pure data, no deps.
const LEVELS = {
  easy: {
    id: 'easy',
    name: 'Fácil',
    colors: ['red', 'blue', 'green', 'orange'],
    tubeCapacity: 5,
    tubes: [
      ['red',    'blue',   'green',  'orange', 'red'],
      ['blue',   'green',  'orange', 'red',    'blue'],
      ['green',  'orange', 'red',    'blue',   'green'],
      ['orange', 'red',    'blue',   'green',  'orange'],
      []
    ]
  },
  classic: {
    id: 'classic',
    name: 'Clásico',
    colors: ['red', 'blue', 'green', 'orange', 'pink', 'white'],
    tubeCapacity: 7,
    tubes: [
      ['red', 'blue', 'green', 'orange', 'pink', 'white', 'blue'],
      ['green', 'pink', 'blue', 'orange', 'red', 'green', 'pink'],
      ['blue', 'green', 'pink', 'red', 'orange', 'blue', 'white'],
      ['pink', 'orange', 'blue', 'red', 'green', 'white', 'orange'],
      ['orange', 'red', 'white', 'pink', 'blue', 'red', 'white'],
      ['white', 'orange', 'red', 'green', 'pink', 'white', 'green'],
      []
    ]
  },
  hard: {
    id: 'hard',
    name: 'Difícil',
    colors: ['red', 'blue', 'green', 'orange', 'pink', 'white', 'yellow'],
    tubeCapacity: 7,
    tubes: [
      ['red',    'blue',   'green',  'orange', 'pink',   'white',  'yellow'],
      ['blue',   'green',  'orange', 'pink',   'white',  'yellow', 'red'],
      ['green',  'orange', 'pink',   'white',  'yellow', 'red',    'blue'],
      ['orange', 'pink',   'white',  'yellow', 'red',    'blue',   'green'],
      ['pink',   'white',  'yellow', 'red',    'blue',   'green',  'orange'],
      ['white',  'yellow', 'red',    'blue',   'green',  'orange', 'pink'],
      ['yellow', 'red',    'blue',   'green',  'orange', 'pink',   'white'],
      []
    ]
  }
};

export function getLevel(id = 'classic') {
  const level = LEVELS[id];
  if (!level) throw new Error(`Nivel desconocido: ${id}`);
  return level;
}

export function listLevels() {
  return Object.values(LEVELS).map(({ id, name }) => ({ id, name }));
}
