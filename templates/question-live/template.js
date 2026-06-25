import { BaseTemplate } from '../base.js';
import { renderQuestionLiveEditor } from './editor.js';
import { renderQuestionLivePlayer } from './player.js';

function newId() { return 'q_' + Math.random().toString(36).slice(2, 8); }

export class QuestionLiveTemplate extends BaseTemplate {
  static meta = {
    name: 'question-live',
    label: 'Pregunta Live',
    icon: 'bi-chat-square-text-fill',
    color: 'warning',
    contentModel: 'items',
    templateVersion: 1,
    aspectRatio: '4/3',
    modes: { solo: false, live: true, async: false, practice: false },
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules: () => ({}),
    defaultScoring: () => ({}),
    defaultLive: () => ({}),
    defaultContent: () => ({
      items: [
        { id: newId(), q: '¿Cuál es la capital de Francia?' },
        { id: newId(), q: '¿Cuánto es 8 × 7?' },
        { id: newId(), q: '¿Quién escribió el Quijote?' },
        { id: newId(), q: '¿Cuál es el río más largo del mundo?' },
        { id: newId(), q: '¿En qué año llegó Colón a América?' },
        { id: newId(), q: '¿Cuál es el planeta más grande del sistema solar?' },
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
