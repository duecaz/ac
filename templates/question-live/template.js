import { BaseTemplate } from '../base.js';
import { renderQuestionLiveEditor } from './editor.js';
import { renderQuestionLivePlayer } from './player.js';
import { wheelSvg } from '../wheel/render.js';
import { newItem, migrateLegacyItems } from '../../core/contentModels/items.js';
import { escapeHtml } from '../../core/html.js';


export class QuestionLiveTemplate extends BaseTemplate {
  static meta = {
    name: 'question-live',
    label: 'Abre Cajas',
    icon: 'bi-grid-3x3-gap-fill',
    color: 'warning',
    kind:            'ejercicio',   // familia (norte §4c): quién pone el contenido
    contentModel: 'items',
    templateVersion: 2,   // v2: campo `q` → `question` (vocabulario reservado)
    // El EDITOR se declara aquí (§0: la vista no conoce plantillas concretas):
    // `elemento` es lo que el profe AÑADE y `primerPaso` lo que se lee con la
    // actividad vacía — es lo que enseña, en vez de contenido de muestra que
    // hay que borrar antes de empezar (R-D).
    editor: { elemento: 'pregunta', primerPaso: 'Pulsa «Añadir pregunta» y escribe lo que preguntarás en clase; los puntos los pones tú al responder.' },
    instructions: 'Espera tu turno: cuando salga tu pregunta, respóndela como indique el docente.',
    aspectRatio: '4/3',
    modes: { solo: true, live: true, async: false },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'none', teams: 'none', live: ['claim'] , reloj: { unidad: null, crono: false } },
    defaultRules: () => ({ selector: 'boxes' }),
    defaultScoring: () => ({}),
    defaultLive: () => ({}),
    defaultContent: () => ({
      items: [
        newItem('¿Cuál es la capital de Francia?'),
        newItem('¿Cuánto es 8 × 7?'),
        newItem('¿Quién escribió el Quijote?'),
        newItem('¿Cuál es el río más largo del mundo?'),
        newItem('¿En qué año llegó Colón a América?'),
        newItem('¿Cuál es el planeta más grande del sistema solar?'),
      ]
    })
  };
  static renderPlayer = renderQuestionLivePlayer;
  static renderEditor = renderQuestionLiveEditor;
  // v1 usaba `q`; la hoja compartida lo migra a `question` (idempotente).
  static migrateContent(content) { return migrateLegacyItems(content); }

  // Required by the registry for live-capable templates.
  // Question Live uses manual teacher scoring, so these are not called in game,
  // but must exist to pass validation.
  // ANSWER-SAFETY (R5): whitelist de campos de PANTALLA — nunca el ítem crudo.
  // El modelo `items` hoy no guarda clave de respuesta, pero un passthrough
  // filtraría cualquier campo que un contenido importado traiga de más.
  static getRoundPayload(activity, { itemIndex }) {
    const it = activity.content?.items?.[itemIndex];
    return it ? { id: it.id, question: it.question, image: it.image || null } : null;
  }
  static scoreSubmission() { return { correct: null, points: 0, hits: 0, total: 0 }; }   // puntúa el profe (ql_points): sin mérito automático

}
