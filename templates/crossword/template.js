import { BaseTemplate } from '../base.js';
import { renderCrosswordPlayer } from './player.js';
import { renderCrosswordEditor } from './editor.js';
import { buildGrid } from './generator.js';
import { escapeHtml } from '../../core/html.js';
import { emptyHtml } from '../../core/previewKit.js';

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
  return { correct: solved >= total, points: solved * ppc, hits: solved, total };
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

  // Preview de tarjeta: el crucigrama real si tiene palabras colocadas; si no,
  // una cruz decorativa fija para que la tarjeta se lea como crucigrama.
  static previewHtml(act) {
    const words = (act.content?.words || []).filter(w => w.word && w.word.length >= 2 && w.row != null && w.col != null && w.dir);
    if (!words.length) return crosswordPlaceholderHtml(act);
    let maxR = 0, maxC = 0;
    for (const w of words) {
      if (w.dir === 'H') { maxR = Math.max(maxR, w.row); maxC = Math.max(maxC, w.col + w.word.length - 1); }
      else               { maxR = Math.max(maxR, w.row + w.word.length - 1); maxC = Math.max(maxC, w.col); }
    }
    const rows = maxR + 1, cols = maxC + 1;
    if (rows > 20 || cols > 20) return emptyHtml(act);
    const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    for (const w of words) {
      for (let i = 0; i < w.word.length; i++) {
        const r = w.dir === 'H' ? w.row : w.row + i;
        const c = w.dir === 'H' ? w.col + i : w.col;
        grid[r][c] = w.word[i];
      }
    }
    const cellPx = Math.max(14, Math.min(28, Math.floor(300 / Math.max(rows, cols))));
    const cellsHtml = grid.flatMap((row, r) => row.map((l, c) => {
      if (l === null) return `<div style="width:${cellPx}px;height:${cellPx}px;background:#343a40"></div>`;
      return `<div style="width:${cellPx}px;height:${cellPx}px;background:#fff;border:1px solid #adb5bd;display:flex;align-items:center;justify-content:center;font-size:${Math.max(7, cellPx * 0.52)}px;font-weight:800;color:#212529">${l}</div>`;
    })).join('');
    const wordList = words.slice(0, 5).map(w =>
      `<span style="font-size:9px;font-weight:700;color:#0d6efd;margin-right:5px">${w.word}</span>`
    ).join('') + (words.length > 5 ? `<span style="font-size:9px;color:#adb5bd">+${words.length - 5}</span>` : '');
    return `<div style="display:flex;flex-direction:column;height:100%;padding:.5rem;gap:.4rem;align-items:center">
      <div style="display:grid;grid-template-columns:repeat(${cols},${cellPx}px);gap:1px;background:#dee2e6;border:1px solid #dee2e6;border-radius:4px;overflow:hidden">${cellsHtml}</div>
      <div style="display:flex;flex-wrap:wrap;gap:2px;justify-content:center">${wordList}</div>
    </div>`;
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
