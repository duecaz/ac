import { BaseTemplate } from '../base.js';
import { renderWordsearchPlayer, renderWordsearchRound } from './player.js';
import { renderWordsearchEditor } from './editor.js';
import { scoreWordsearch } from './scorer.js';
import { generateGridAllWords, generateGrid, SIZE_MAP } from './generator.js';

export class WordsearchTemplate extends BaseTemplate {
  static meta = {
    name:            'wordsearch',
    label:           'Sopa de Letras',
    icon:            'bi-grid-3x3',
    color:           'success',
    kind:            'ejercicio',   // familia (norte §4c): quién pone el contenido
    contentModel:    'words',
    templateVersion: 1,
    // El EDITOR se declara aquí (§0: la vista no conoce plantillas concretas):
    // `elemento` es lo que el profe AÑADE y `primerPaso` lo que se lee con la
    // actividad vacía — es lo que enseña, en vez de contenido de muestra que
    // hay que borrar antes de empezar (R-D).
    editor: { elemento: 'palabra', primerPaso: 'Pulsa «Añadir palabra» y escribe las que el alumno tendrá que encontrar.' },
    instructions:    'Encuentra las palabras ocultas arrastrando sobre la sopa de letras.',
    modes:           { solo: true, live: false, async: true, practice: true },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    // La Sopa guarda `words` como cadenas sueltas, no como fichas con pista.
    // Lo DECLARA aquí porque quien lo necesita es el diálogo de IA, y hasta hoy
    // lo averiguaba preguntando `a.template === 'wordsearch'` (§0).
    iaPalabrasComoTexto: true,
    play:            { vs: 'race', teams: 'board', live: [], submit: 'gesto' , reloj: { unidad: 'sopa' } },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules:   () => ({ gridSize: 'medium', directions: 'medium', timer: 300 }),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1 }),   // P5: escala unificada (antes 10)
    defaultContent: () => ({
      words: ['GATO', 'PERRO', 'PÁJARO', 'RATÓN', 'CONEJO',
              'PATO', 'CABALLO', 'VACA', 'OVEJA', 'CERDO'],
    }),
  };

  static renderPlayer = renderWordsearchPlayer;
  static renderEditor = renderWordsearchEditor;
  static scoreSubmission = scoreWordsearch;

  // Cambio de formato (ley de contenido §24): Crucigrama comparte el modelo
  // `words` pero con FORMA distinta (palabras colocadas {word,clue,row,col,dir}
  // vs strings). Al adoptar, quedarse solo con la palabra — antes el switch
  // "directo" pasaba los objetos tal cual y la sopa quedaba inservible.
  static adoptContent(content) {
    const ws = content?.words || [];
    if (!ws.length || typeof ws[0] === 'string') return content;
    return { ...content, words: ws.map(w => String(w?.word || '')).filter(Boolean) };
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
