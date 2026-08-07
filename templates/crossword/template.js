import { BaseTemplate } from '../base.js';
import { renderCrosswordPlayer } from './player.js';
import { renderCrosswordEditor } from './editor.js';
import { scoreCrosswordSubmission } from './scorer.js';
import { buildGrid, autoLayout } from './generator.js';
import { escapeHtml } from '../../core/html.js';

export class CrosswordTemplate extends BaseTemplate {
  static meta = {
    name:            'crossword',
    label:           'Crucigrama',
    icon:            'bi-grid',
    color:           'warning',
    kind:            'ejercicio',   // familia (norte §4c): quién pone el contenido
    contentModel:    'words',
    templateVersion: 1,
    instructions:    'Completa el crucigrama: toca una pista, escribe la palabra y resuélvela.',
    modes:           { solo: true, live: false, async: true, practice: true },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'none', teams: 'none', live: [] },
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
  static scoreSubmission = scoreCrosswordSubmission;

  // Cambio de formato (ley de contenido §24): desde Sopa llegan strings sin
  // posición — el auto-layout del generador las CRUZA de verdad (antes el
  // switch "directo" dejaba strings y el crucigrama quedaba inservible).
  // Las pistas nacen vacías: el editor es la siguiente parada del gesto.
  static adoptContent(content) {
    const ws = content?.words || [];
    if (!ws.length || typeof ws[0] === 'object') return content;
    return { ...content, words: autoLayout(ws.map(w => ({ word: String(w), clue: '' }))) };
  }

  // ANSWER-SAFETY (R5): el payload de ronda lleva la FORMA del crucigrama
  // (posición, dirección, longitud, pista) pero NUNCA las letras — `word` ES la
  // respuesta. Hoy es solo-only y nadie lo consume en vivo, pero el contrato de
  // getRoundPayload es "apto para enviarse a un alumno" SIEMPRE.
  static getRoundPayload(activity) {
    const words = (activity.content?.words || [])
      .filter(w => w.word && w.row != null && w.col != null && w.dir)
      .map(w => ({ id: w.id, clue: w.clue, row: w.row, col: w.col, dir: w.dir, len: String(w.word).length }));
    return { words };
  }

}

// Cruz decorativa fija para un crucigrama vacío/nuevo.
function crosswordPlaceholderHtml(act) {
  const B = null;
  const pattern = [
    [B, 'C', B, B, B],
    ['S', 'R', 'U', 'Z', B],
    [B, 'U', B, B, B],
    [B, 'C', B, 'P', B],
    [B, 'E', 'R', 'A', B],
  ];
  const cellPx = 46;
  const cells = pattern.flatMap((row) => row.map((l) =>
    l === B
      ? `<div style="width:${cellPx}px;height:${cellPx}px;background:#343a40"></div>`
      : `<div style="width:${cellPx}px;height:${cellPx}px;background:#fff;border:1px solid #adb5bd;display:flex;align-items:center;justify-content:center;font-size:${cellPx * 0.5}px;font-weight:800;color:#212529">${l}</div>`
  )).join('');
  return `<div style="display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center;gap:1rem">
    <div style="display:grid;grid-template-columns:repeat(5,${cellPx}px);gap:2px;background:#dee2e6;border:2px solid #dee2e6;border-radius:6px;overflow:hidden">${cells}</div>
    <div class="fs-4 fw-semibold text-center">${escapeHtml(act.title || 'Crucigrama')}</div>
  </div>`;
}
