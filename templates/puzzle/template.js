// Rompecabezas — JUEGO para inicial (norte §4c): una imagen del banco dividida
// en rejilla; el niño arrastra cada pieza hasta su hueco. Sin lectura, sin
// clave que ponga el docente: el contenido lo trae la app (docs/handoff-juegos-inicial.md).
import { BaseTemplate } from '../../templates/base.js';
import { renderPuzzlePlayer } from './player.js';
import { renderPuzzleEditor } from './editor.js';
import { scorePuzzleSubmission } from './scorer.js';
import { rid } from '../../core/ids.js';

// El tamaño de la rejilla es UNA opción de partida (§28 R2: ya elegida, se
// puede tocar sin salir del juego) Y el valor con el que nace el ítem — el
// editor fija el DEFAULT, el docente puede cambiarlo al lanzar.
const TAMANOS = {
  '2x2': { filas: 2, columnas: 2 },
  '2x3': { filas: 2, columnas: 3 },
  '3x3': { filas: 3, columnas: 3 },
};
function tamanoDe(it) {
  const f = it?.filas || 2, c = it?.columnas || 2;
  return Object.keys(TAMANOS).find(k => TAMANOS[k].filas === f && TAMANOS[k].columnas === c) || '2x2';
}

export class PuzzleTemplate extends BaseTemplate {
  static meta = {
    name: 'puzzle',
    label: 'Rompecabezas',
    icon: 'bi-puzzle-fill',
    color: 'primary',
    kind: 'juego',
    skill: 'Espacial',
    contentModel: 'puzzle',
    templateVersion: 1,
    instructions: 'Arrastra cada pieza hasta su sitio en la imagen.',
    // `generado`: no se AÑADE nada (el dibujo lo trae el banco); sin esto el
    // revisor de contenido (core/activityCheck.js) exige un revisor por modelo.
    editor: {
      generado: true,
      primerPaso: 'Elige un dibujo del banco y el tamaño de la rejilla.',
    },
    panelFit: 'fill',
    aspectRatio: '4/3',
    // JUEGO: sin Tarea (§4c/§4d) y sin VS/Equipos/Live — una mecánica a medias
    // (arrastrar con la clase repartida en dos móviles) nunca aparece a medias.
    modes: { solo: true, live: false, async: false },
    play: {
      vs: 'none', teams: 'none', live: [],
      // El toque ES la respuesta (soltar la pieza en su hueco): CERO botones.
      submit: 'gesto',
      // Sin reloj: nadie corre contra el tiempo a los 3-6 años (§29, sin presión).
      reloj: { unidad: null, crono: false },
      options: [{
        id: 'piezas', label: 'Piezas',
        values: [
          { value: '2x2', label: '4 piezas' },
          { value: '2x3', label: '6 piezas' },
          { value: '3x3', label: '9 piezas' },
        ],
        get: (a) => tamanoDe(a?.content?.items?.[0]),
        set: (a, v) => {
          const t = TAMANOS[v] || TAMANOS['2x2'];
          return {
            ...a,
            content: {
              ...a.content,
              items: (a.content?.items || []).map(it => ({ ...it, filas: t.filas, columnas: t.columnas })),
            },
          };
        },
      }],
    },
    defaultRules:   () => ({}),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 100 }),
    defaultLive:    () => ({}),
    defaultContent: () => ({
      items: [{ id: rid('it_'), dibujo: 'casa', filas: 2, columnas: 2 }],
    }),
  };

  static renderPlayer = renderPuzzlePlayer;
  static renderEditor = renderPuzzleEditor;
  static scoreSubmission = scorePuzzleSubmission;

}
