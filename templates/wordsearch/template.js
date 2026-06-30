import { BaseTemplate } from '../base.js';
import { renderWordsearchPlayer, renderWordsearchRound } from './player.js';
import { renderWordsearchEditor } from './editor.js';
import { scoreWordsearch } from './scorer.js';
import { generateGridAllWords, SIZE_MAP } from './generator.js';

export class WordsearchTemplate extends BaseTemplate {
  static meta = {
    name:            'wordsearch',
    label:           'Sopa de Letras',
    icon:            'bi-grid-3x3',
    color:           'success',
    contentModel:    'words',
    templateVersion: 1,
    instructions:    'Encuentra las palabras ocultas arrastrando sobre la sopa de letras.',
    modes:           { solo: true, live: false, async: true, practice: true },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules:   () => ({ gridSize: 'medium', directions: 'medium', timer: 0 }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 10 }),
    defaultContent: () => ({
      words: ['GATO', 'PERRO', 'PÁJARO', 'RATÓN', 'CONEJO',
              'PATO', 'CABALLO', 'VACA', 'OVEJA', 'CERDO'],
    }),
  };

  static renderPlayer = renderWordsearchPlayer;
  static renderEditor = renderWordsearchEditor;
  static scoreSubmission = scoreWordsearch;

  // VS: each side gets a DIFFERENT board with the SAME words (seeded by side, so
  // players can't copy positions). The whole board + word list is sent so the
  // round works like solo (free find), and `found` lets it mark what's done
  // across re-renders. Total items = number of words (each find advances one).
  static getRoundPayload(activity, ctx) {
    const words = (activity.content?.words || [])
      .map(w => String(w || '').trim()).filter(Boolean);
    if (!words.length) return null;
    const rules = activity.rules || {};
    const n = SIZE_MAP[rules.gridSize] || 15;
    const { grid, placed, rows, cols } = generateGridAllWords(words, {
      rows: n, cols: n, dirs: rules.directions || 'medium',
      seedSalt: ctx?.side || '',          // distinto tablero por lado
    });
    return { grid, rows, cols, placed, found: ctx?.found || [], side: ctx?.side || 'left' };
  }

  static renderRound(root, payload, opts) {
    renderWordsearchRound(root, payload, opts);
  }
}
