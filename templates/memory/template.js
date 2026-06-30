// Memory: face-down grid; flip 2 cards; if same pair.id, stay; else flip back.
// Reuses the 'pairs' content model. The two cards of a pair show left and right.
import { BaseTemplate } from '../base.js';
import { renderMemoryPlayer } from './player.js';
import { renderMemoryEditor } from './editor.js';
import { newPair } from '../../core/contentModels/pairs.js';

export class MemoryTemplate extends BaseTemplate {
  static meta = {
    name: 'memory',
    label: 'Memoria',
    icon: 'bi-shuffle',
    color: 'primary',
    contentModel: 'pairs',
    templateVersion: 1,
    instructions: 'Encuentra las parejas: voltea dos cartas; si coinciden, se quedan descubiertas.',
    aspectRatio: '1/1',
    modes: { solo: true, live: false, async: true, practice: true },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules: () => ({ revealMs: 900, columns: 4 }),
    defaultScoring: () => ({ pointsPerCorrect: 1, pointsPerWrong: 0, maxScore: 0 }),
    defaultLive: () => ({}),
    defaultContent: () => {
      const id = () => 'p_' + Math.random().toString(36).slice(2, 8);
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
  static migrateContent(content) { return content; }
}
