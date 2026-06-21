import { BaseTemplate } from '../base.js';
import { renderWordsearchPlayer, renderWordsearchRound } from './player.js';
import { renderWordsearchEditor } from './editor.js';
import { scoreWordsearch } from './scorer.js';
import { generateGrid, SIZE_MAP } from './generator.js';

export class WordsearchTemplate extends BaseTemplate {
  static meta = {
    name:            'wordsearch',
    label:           'Sopa de Letras',
    icon:            'bi-grid-3x3',
    color:           'success',
    contentModel:    'words',
    templateVersion: 1,
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

  // Each "item" for VS is one word from content.words.
  // Both players call generateGrid with the same inputs → same board → fair race.
  static getRoundPayload(activity, ctx) {
    const words = (activity.content?.words || [])
      .map(w => String(w || '').trim()).filter(Boolean);
    const rules = activity.rules || {};
    const n = SIZE_MAP[rules.gridSize] || 15;
    const { grid, placed, rows, cols } = generateGrid(words, {
      rows: n, cols: n, dirs: rules.directions || 'medium',
    });
    const p = placed[ctx.itemIndex];
    if (!p) return null;
    return { grid, rows, cols, word: p.word, wordIndex: ctx.itemIndex };
  }

  static renderRound(root, payload, opts) {
    renderWordsearchRound(root, payload, opts);
  }
}
