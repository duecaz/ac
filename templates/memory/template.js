// Memory: face-down grid; flip 2 cards; if same pair.id, stay; else flip back.
// Reuses the 'pairs' content model. The two cards of a pair show left and right.
import { BaseTemplate } from '../base.js';
import { rid } from '../../core/ids.js';
import { renderMemoryPlayer, DEFAULT_REVEAL_MS } from './player.js';
import { renderMemoryEditor } from './editor.js';
import { scoreMemorySubmission } from './scorer.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').PairsContent} PairsContent
 */

/**
 * Los `rules` que declara ESTA plantilla (`defaultRules`), y de los que es
 * dueña: `ActivityRules` solo describe los cuatro comunes.
 * @typedef {Object} MemoryRules
 * @property {number} [timer]
 * @property {number} [revealMs]
 * @property {number} [columns]
 */

/** @param {Activity} activity @returns {MemoryRules} */
export const memoryRules = (activity) => /** @type {MemoryRules} */ (activity.rules || {});

export class MemoryTemplate extends BaseTemplate {
  /** @type {import('../../kernel/contracts/template.js').TemplateMeta<PairsContent>} */
  static meta = {
    name: 'memory',
    label: 'Memoria',
    icon: 'bi-shuffle',
    color: 'primary',
    kind:            'ejercicio',   // familia (norte §4c): quién pone el contenido
    contentModel: 'pairs',
    templateVersion: 1,
    // El EDITOR se declara aquí (§0: la vista no conoce plantillas concretas):
    // `elemento` es lo que el profe AÑADE y `primerPaso` lo que se lee con la
    // actividad vacía — es lo que enseña, en vez de contenido de muestra que
    // hay que borrar antes de empezar (R-D).
    editor: { elemento: 'par', primerPaso: 'Pulsa «Añadir par» y escribe las dos caras que el alumno tendrá que emparejar.' },
    instructions: 'Encuentra las parejas: voltea dos cartas; si coinciden, se quedan descubiertas.',
    aspectRatio: '1/1',
    modes: { solo: true, live: false, async: true },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    // teams:'propio' — Memoria NO se juega con la ronda genérica: trae su
    // mecánica (mazo compartido, turno que se conserva al acertar) y su vista.
    // Se DECLARA porque si no, la plataforma tiene que preguntar «¿eres
    // memory?», y eso es lo que la ley §0 prohíbe: un modo no conoce plantillas
    // concretas. Estaba preguntado por NOMBRE en siete sitios.
    play:            { vs: 'none', teams: 'propio', live: [] , reloj: { unidad: 'partida' } },
    defaultRules: () => ({ timer: 180, revealMs: DEFAULT_REVEAL_MS, columns: 4 }),
    defaultScoring: () => ({ pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => {
      const id = () => rid('p_');
      return { pairs: [
        { id: id(), left: 'grande',   right: 'pequeño' },
        { id: id(), left: 'rápido',   right: 'lento'   },
        { id: id(), left: 'caliente', right: 'frío'    },
        { id: id(), left: 'alto',     right: 'bajo'    },
        { id: id(), left: 'bonito',   right: 'feo'     },
        { id: id(), left: 'día',      right: 'noche'   },
      ]};
    }
  };
  static renderPlayer = renderMemoryPlayer;
  static renderEditor = renderMemoryEditor;
  // Memoria no tiene renderRound (su modo Equipos usa su propio motor), pero SÍ
  // declara scorer: es la única fuente de puntos, la use el player o una ronda.
  static scoreSubmission = scoreMemorySubmission;
}
