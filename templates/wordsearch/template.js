import { BaseTemplate } from '../base.js';
import { renderWordsearchPlayer, renderWordsearchRound } from './player.js';
import { renderWordsearchEditor } from './editor.js';
import { scoreWordsearch } from './scorer.js';
import { generateGridAllWords, generateGrid, SIZE_MAP } from './generator.js';
import { emptyHtml } from '../../core/previewKit.js';

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
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'race', teams: 'board', live: 'none' },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules:   () => ({ gridSize: 'medium', directions: 'medium', timer: 0 }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1 }),   // P5: escala unificada (antes 10)
    defaultContent: () => ({
      words: ['GATO', 'PERRO', 'PÁJARO', 'RATÓN', 'CONEJO',
              'PATO', 'CABALLO', 'VACA', 'OVEJA', 'CERDO'],
    }),
  };

  static renderPlayer = renderWordsearchPlayer;
  static renderEditor = renderWordsearchEditor;
  static scoreSubmission = scoreWordsearch;

  // Preview de tarjeta: una rejilla 10×10 con las palabras ya marateadas de color
  // + la lista tachada. Rejilla pequeña para que la miniatura sea rápida.
  static previewHtml(act) {
    const words = (act.content?.words || []).map(w => typeof w === 'string' ? w : (w?.word || '')).filter(Boolean);
    if (!words.length) return emptyHtml(act);
    const { grid, placed, cols } = generateGrid(words.slice(0, 12), { rows: 10, cols: 10, dirs: 'medium' });
    const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#a855f7', '#ec4899'];
    const foundCells = new Map();
    placed.forEach((p, i) => p.cells.forEach(({ r, c }) => foundCells.set(`${r},${c}`, COLORS[i % COLORS.length])));
    const fontSize = Math.max(7, Math.floor((100 / cols) * 0.55));
    const cellsHtml = grid.flatMap((row, r) => row.map((l, c) => {
      const color = foundCells.get(`${r},${c}`);
      const bg = color ? `background:${color}22;color:${color};` : 'color:#adb5bd;';
      return `<span style="display:flex;align-items:center;justify-content:center;aspect-ratio:1;font-weight:800;font-size:${fontSize}px;${bg}">${l}</span>`;
    })).join('');
    const wordList = placed.slice(0, 6).map((p, i) =>
      `<span style="font-size:10px;font-weight:700;color:${COLORS[i % COLORS.length]};text-decoration:line-through;margin-right:6px">${p.word}</span>`
    ).join('') + (placed.length > 6 ? `<span style="font-size:10px;color:#adb5bd">+${placed.length - 6}</span>` : '');
    return `<div style="display:flex;flex-direction:column;height:100%;padding:.5rem;gap:.5rem">
      <div style="flex:1;display:grid;grid-template-columns:repeat(${cols},1fr);gap:1px;background:#dee2e6;border:1px solid #dee2e6;border-radius:6px;overflow:hidden">${cellsHtml}</div>
      <div style="display:flex;flex-wrap:wrap;gap:2px;flex-shrink:0">${wordList}</div>
    </div>`;
  }

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
