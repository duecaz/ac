import { BaseTemplate } from '../base.js';
import { renderQuestionLiveEditor } from './editor.js';
import { renderQuestionLivePlayer } from './player.js';

function newId() { return 'q_' + Math.random().toString(36).slice(2, 8); }

export class QuestionLiveTemplate extends BaseTemplate {
  static meta = {
    name: 'question-live',
    label: 'Abre Cajas',
    icon: 'bi-grid-3x3-gap-fill',
    color: 'warning',
    contentModel: 'items',
    templateVersion: 1,
    instructions: 'Espera tu turno: cuando salga tu pregunta, respóndela como indique el docente.',
    aspectRatio: '4/3',
    modes: { solo: true, live: true, async: false, practice: false },
    needsImageUpload: false, // images stored inline as data-URLs (no external upload)
    needsAudioUpload: false,
    defaultRules: () => ({ selector: 'boxes' }),
    defaultScoring: () => ({}),
    defaultLive: () => ({}),
    defaultContent: () => ({
      items: [
        { id: newId(), q: '¿Cuál es la capital de Francia?', image: null },
        { id: newId(), q: '¿Cuánto es 8 × 7?', image: null },
        { id: newId(), q: '¿Quién escribió el Quijote?', image: null },
        { id: newId(), q: '¿Cuál es el río más largo del mundo?', image: null },
        { id: newId(), q: '¿En qué año llegó Colón a América?', image: null },
        { id: newId(), q: '¿Cuál es el planeta más grande del sistema solar?', image: null },
      ]
    })
  };
  static renderPlayer = renderQuestionLivePlayer;
  static renderEditor = renderQuestionLiveEditor;
  static migrateContent(content) { return content; }

  // Required by the registry for live-capable templates.
  // Question Live uses manual teacher scoring, so these are not called in game,
  // but must exist to pass validation.
  static getRoundPayload(activity, { itemIndex }) {
    return activity.content?.items?.[itemIndex] ?? null;
  }
  static scoreSubmission() { return { correct: false, points: 0 }; }
}
