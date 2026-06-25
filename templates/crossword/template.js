import { BaseTemplate } from '../base.js';
import { renderCrosswordPlayer } from './player.js';
import { renderCrosswordEditor } from './editor.js';
import { buildGrid } from './generator.js';

function scoreCrossword({ value, item, msTaken, activity }) {
  // value = { solvedIds: [...], totalWords: N }
  // Simple flat scoring: 1 point per solved word
  const total = value?.totalWords ?? (activity?.content?.words?.length || 1);
  const solved = value?.solvedIds?.length ?? 0;
  return { score: solved, maxScore: total };
}

export class CrosswordTemplate extends BaseTemplate {
  static meta = {
    name:            'crossword',
    label:           'Crucigrama',
    icon:            'bi-grid',
    color:           'warning',
    contentModel:    'words',
    templateVersion: 1,
    modes:           { solo: true, live: false, async: true, practice: true },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules:   () => ({ hintMode: 'none', timer: 0 }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1 }),
    defaultContent: () => ({
      words: [
        { id: 'cw_demo1', word: 'GATO',    clue: 'Animal felino doméstico',           row: 0, col: 0, dir: 'H' },
        { id: 'cw_demo2', word: 'GUITARRA', clue: 'Instrumento musical de cuerdas',   row: 0, col: 0, dir: 'V' },
        { id: 'cw_demo3', word: 'ARBOL',   clue: 'Planta con tronco leñoso',          row: 2, col: 2, dir: 'H' },
        { id: 'cw_demo4', word: 'LUNA',    clue: 'Satélite natural de la Tierra',     row: 0, col: 4, dir: 'V' },
      ],
    }),
  };

  static renderPlayer = renderCrosswordPlayer;
  static renderEditor = renderCrosswordEditor;
  static scoreSubmission = scoreCrossword;

  // Crossword is solo-only; no live round payload needed.
  static getRoundPayload(activity) {
    const words = (activity.content?.words || [])
      .filter(w => w.word && w.row != null && w.col != null && w.dir);
    return { words };
  }
}
