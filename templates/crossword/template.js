import { BaseTemplate } from '../base.js';
import { renderCrosswordPlayer } from './player.js';
import { renderCrosswordEditor } from './editor.js';
import { buildGrid } from './generator.js';

function scoreCrossword({ value, activity }) {
  // Crucigrama es solo-only (sin renderRound): este scorer es un STUB para pasar
  // el contrato del registro (panorama-actividades.md §1), no se invoca en un
  // flujo real de ronda hoy. Aun así debe devolver la forma {correct,points} que
  // usan TODOS los llamadores de scoreSubmission (engine.js autoScore, hostLive,
  // studentLive, vsView) — antes devolvía {score,maxScore}, una mina para el día
  // en que Crucigrama sume renderRound (ya tiene getRoundPayload).
  // value = { solvedIds: [...], totalWords: N }; puntuación plana: 1 por palabra.
  const total = value?.totalWords ?? (activity?.content?.words?.length || 1);
  const solved = value?.solvedIds?.length ?? 0;
  const ppc = activity?.scoring?.pointsPerCorrect ?? 1;
  return { correct: solved >= total, points: solved * ppc };
}

export class CrosswordTemplate extends BaseTemplate {
  static meta = {
    name:            'crossword',
    label:           'Crucigrama',
    icon:            'bi-grid',
    color:           'warning',
    contentModel:    'words',
    templateVersion: 1,
    instructions:    'Completa el crucigrama: toca una pista, escribe la palabra y resuélvela.',
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
